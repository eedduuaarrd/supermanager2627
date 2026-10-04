import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import {
  computeLineupLockAt,
  isLineupLocked,
  loadFixtures,
} from "@/lib/fixtures";
import {
  getLineupLockAt,
  getRoundStatus,
  setLineupLockAt,
} from "@/lib/rounds";
import { refreshStoredIdealTeam } from "@/lib/ideal-team";
import { runMatchLive } from "@/lib/match-live";
import { notifyIdealStored, notifyJornadaStart } from "@/lib/push";
import { closeJornada, openNextJornada } from "@/lib/scoring";
import { promoteInitialTeamsIfLocked } from "@/lib/teams";

export const runtime = "nodejs";

type WeeklyAction =
  | "refresh"
  | "close"
  | "open"
  | "run"
  | "lock"
  | "ideal"
  | "jornada-start"
  | "match-finished";

function authorize(req: Request, bodyToken?: string): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  const header =
    req.headers.get("x-admin-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (adminToken && (bodyToken === adminToken || header === adminToken)) {
    return true;
  }
  return false;
}

/**
 * Weekly jornada ops.
 * Body: { token?, action: "refresh"|"close"|"open"|"run"|"lock", lockAt? }
 * - refresh: hint for scripts/weekend-sync.mjs (stats+fixtures live outside Next)
 * - close: score current jornada from FCBQ game rows, lock lineups (no advance)
 * - open: open next jornada after a close
 * - run: close + advance (score + open next) — typical weekend cron after refresh
 * - lock: recompute/store lineup_lock_at from fixtures.json (or body.lockAt);
 *   if tip-off already passed, promote transfer_phase initial → normal
 * - ideal: persist the ideal lineup for `round` from fantasy VAL.
 *   Incomplete scores leave the previous stored lineup in place.
 *   A successful store pushes "equip ideal" to subscribed users (once).
 * - jornada-start: if the open jornada's first tip-off of this Madrid week
 *   is within the last 20 minutes, push that it has started (once).
 *   Already started or already finished is recorded as skipped, not sent.
 * - match-finished: push and score each club game that has a real final
 *   box score and tipped off after this check first ran. Older games are
 *   skipped. Does not change ideal or jornada-start.
 *
 * Also accepts session cookie for logged-in admin (scripts / curl with session).
 */
export async function POST(req: Request) {
  let body: {
    token?: string;
    action?: WeeklyAction;
    advance?: boolean;
    lockAt?: string | null;
    round?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const session = await readSession();
  const tokenOk = authorize(req, body.token);
  if (!tokenOk && !session?.isAdmin) {
    return NextResponse.json(
      { error: "No autoritzat. Cal ADMIN_TOKEN o sessió d'administrador." },
      { status: 403 },
    );
  }

  const action: WeeklyAction = body.action ?? "run";

  try {
    if (action === "refresh") {
      return NextResponse.json({
        ok: true,
        action: "refresh",
        hint: "Executa: node scripts/weekend-sync.mjs (o refresh-fcbq-stats + weekly-jornada)",
        round: getCurrentRound(),
        roundStatus: getRoundStatus(),
        lockAt: getLineupLockAt(),
      });
    }

    if (action === "lock") {
      const round = getCurrentRound();
      const lockAt: string | null =
        body.lockAt === undefined
          ? computeLineupLockAt(round, loadFixtures())
          : body.lockAt;
      // Reject invented / invalid timestamps
      if (lockAt && !Number.isFinite(Date.parse(lockAt))) {
        return NextResponse.json(
          { error: "lockAt ISO invàlid." },
          { status: 400 },
        );
      }
      setLineupLockAt(lockAt);
      const promoted = isLineupLocked(lockAt)
        ? promoteInitialTeamsIfLocked()
        : 0;
      return NextResponse.json({
        ok: true,
        action: "lock",
        round,
        lockAt,
        promotedInitialTeams: promoted,
        note:
          lockAt == null
            ? "Sense tip-off publicat: alineació oberta."
            : isLineupLocked(lockAt)
              ? "lineup_lock_at assolit: fase initial → normal (només equips creats abans del tip-off)."
              : "lineup_lock_at actualitzat des de fixtures.",
      });
    }

    if (action === "ideal") {
      const round = body.round;
      if (!Number.isInteger(round) || round == null || round < 1) {
        return NextResponse.json(
          { error: "Cal una jornada vàlida (round)." },
          { status: 400 },
        );
      }
      const result = refreshStoredIdealTeam(round);
      const push = result.stored
        ? await notifyIdealStored(round, true)
        : { outcome: "wait" as const, delivered: 0 };
      return NextResponse.json({ ok: true, action: "ideal", ...result, push });
    }

    if (action === "jornada-start") {
      const push = await notifyJornadaStart();
      return NextResponse.json({ ok: true, action: "jornada-start", push });
    }

    if (action === "match-finished") {
      const live = await runMatchLive();
      return NextResponse.json({ ok: true, action: "match-finished", ...live });
    }

    if (action === "close") {
      const result = closeJornada({ advance: false });
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "open") {
      const result = openNextJornada();
      return NextResponse.json({ ok: true, action, ...result });
    }

    // run = close + open next (default weekly)
    const result = closeJornada({ advance: true });
    return NextResponse.json({ ok: true, action: "run", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error setmanal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    round: getCurrentRound(),
    roundStatus: getRoundStatus(),
    lockAt: getLineupLockAt(),
    actions: ["refresh", "close", "open", "run", "lock", "ideal", "jornada-start", "match-finished"],
  });
}
