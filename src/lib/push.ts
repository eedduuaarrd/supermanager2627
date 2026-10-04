import { getCurrentRound, getDb } from "@/lib/db";
import { firstWeekendKickoff, loadFixtures, type FixturesFile } from "@/lib/fixtures";
import {
  decideIdealPush,
  decideJornadaStartPush,
  idealPushBody,
  jornadaStartPushBody,
  PUSH_TITLE,
  type PushDecision,
} from "@/lib/push-policy";
import { getRoundStatus } from "@/lib/rounds";
import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
};

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type StoredSub = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
};

const DEFAULT_SUBJECT = "https://supercbb.com";

function dataDir(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readVapidFile(): VapidKeys | null {
  const file = path.join(dataDir(), "vapid.json");
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<VapidKeys>;
    if (!parsed.publicKey || !parsed.privateKey) return null;
    return {
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey,
      subject: parsed.subject || process.env.VAPID_SUBJECT || DEFAULT_SUBJECT,
    };
  } catch {
    return null;
  }
}

/** Env keys win. Otherwise reuse or create DATA_DIR/vapid.json (never committed). */
export function ensureVapid(): VapidKeys | null {
  const subject = process.env.VAPID_SUBJECT || DEFAULT_SUBJECT;
  const fromEnv = process.env.VAPID_PUBLIC_KEY;
  const fromEnvPriv = process.env.VAPID_PRIVATE_KEY;
  if (fromEnv && fromEnvPriv) {
    return { publicKey: fromEnv, privateKey: fromEnvPriv, subject };
  }
  if (fromEnv || fromEnvPriv) return null;
  const existing = readVapidFile();
  if (existing) return existing;
  try {
    const generated = webpush.generateVAPIDKeys();
    const keys: VapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
    };
    const file = path.join(dataDir(), "vapid.json");
    fs.writeFileSync(file, JSON.stringify(keys, null, 2) + "\n", { mode: 0o600 });
    return keys;
  } catch {
    return null;
  }
}

export function vapidPublicKey(): string | null {
  return ensureVapid()?.publicKey ?? null;
}

function configure(keys: VapidKeys) {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
}

export function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth`,
    )
    .run(
      input.endpoint,
      input.userId,
      input.p256dh,
      input.auth,
      new Date().toISOString(),
    );
}

export function deletePushSubscription(userId: string, endpoint: string): void {
  getDb()
    .prepare(
      `DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`,
    )
    .run(endpoint, userId);
}

function listSubscriptions(): StoredSub[] {
  return getDb()
    .prepare(
      `SELECT endpoint, user_id, p256dh, auth FROM push_subscriptions`,
    )
    .all() as StoredSub[];
}

function removeSubscription(endpoint: string) {
  getDb().prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

/** Deliver one payload to every stored subscription. Returns how many accepted it. */
export async function deliverToAll(message: PushMessage): Promise<number> {
  const keys = ensureVapid();
  if (!keys) return 0;
  configure(keys);
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/jornada",
  });
  let delivered = 0;
  for (const sub of listSubscriptions()) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      delivered += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) removeSubscription(sub.endpoint);
    }
  }
  return delivered;
}

export function dispatchRow(
  kind: string,
  round: number,
): { outcome: string } | null {
  return (
    (getDb()
      .prepare(
        `SELECT outcome FROM push_dispatch WHERE kind = ? AND round = ?`,
      )
      .get(kind, round) as { outcome: string } | undefined) ?? null
  );
}

function claim(kind: string, round: number, outcome: string): boolean {
  try {
    getDb()
      .prepare(
        `INSERT INTO push_dispatch (kind, round, outcome, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(kind, round, outcome, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

function setOutcome(kind: string, round: number, outcome: string) {
  getDb()
    .prepare(
      `UPDATE push_dispatch SET outcome = ?, created_at = ? WHERE kind = ? AND round = ?`,
    )
    .run(outcome, new Date().toISOString(), kind, round);
}

function release(kind: string, round: number) {
  getDb()
    .prepare(`DELETE FROM push_dispatch WHERE kind = ? AND round = ? AND outcome = 'pending'`)
    .run(kind, round);
}

export type DispatchResult = {
  outcome: "wait" | "sent" | "skipped" | "already" | "no-vapid" | "failed";
  delivered: number;
};

/**
 * Apply a policy decision once per kind+jornada.
 * `send` is injectable so tests do not hit a push service.
 */
export async function dispatchLoggedPush(opts: {
  kind: "ideal" | "jornada-start";
  round: number;
  decision: PushDecision;
  message: PushMessage;
  send?: (message: PushMessage) => Promise<number>;
}): Promise<DispatchResult> {
  if (opts.decision === "wait") return { outcome: "wait", delivered: 0 };
  if (dispatchRow(opts.kind, opts.round)) {
    return { outcome: "already", delivered: 0 };
  }
  if (opts.decision === "skip") {
    if (!claim(opts.kind, opts.round, "skipped")) {
      return { outcome: "already", delivered: 0 };
    }
    return { outcome: "skipped", delivered: 0 };
  }
  const keys = ensureVapid();
  if (!keys) return { outcome: "no-vapid", delivered: 0 };
  if (!claim(opts.kind, opts.round, "pending")) {
    return { outcome: "already", delivered: 0 };
  }
  try {
    const delivered = opts.send
      ? await opts.send(opts.message)
      : await deliverToAll(opts.message);
    setOutcome(opts.kind, opts.round, "sent");
    return { outcome: "sent", delivered };
  } catch {
    release(opts.kind, opts.round);
    return { outcome: "failed", delivered: 0 };
  }
}

/** Sunday job, after a successful ideal-team store. Does nothing on a failed store. */
export async function notifyIdealStored(round: number, stored: boolean) {
  if (dispatchRow("ideal", round)) return { outcome: "already" as const, delivered: 0 };
  const decision = decideIdealPush(stored, false);
  return dispatchLoggedPush({
    kind: "ideal",
    round,
    decision,
    message: {
      title: PUSH_TITLE,
      body: idealPushBody(round),
      url: "/jornada",
    },
  });
}

/** Minute checker: first tip-off of the open jornada's current Madrid week. */
export async function notifyJornadaStart(now = new Date(), fixtures?: FixturesFile) {
  const round = getCurrentRound();
  const kickoff = firstWeekendKickoff(round, fixtures ?? loadFixtures(), now);
  if (dispatchRow("jornada-start", round)) {
    return { outcome: "already" as const, delivered: 0, round, kickoff };
  }
  const decision = decideJornadaStartPush({
    status: getRoundStatus(),
    kickoff,
    nowMs: now.getTime(),
    alreadyDispatched: false,
  });
  const result = await dispatchLoggedPush({
    kind: "jornada-start",
    round,
    decision,
    message: {
      title: PUSH_TITLE,
      body: jornadaStartPushBody(round),
      url: "/jornada",
    },
  });
  return { ...result, round, kickoff };
}
