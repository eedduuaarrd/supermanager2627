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
import { closeJornada, openNextJornada } from "@/lib/scoring";
import { promoteInitialTeamsIfLocked } from "@/lib/teams";

export const runtime = "nodejs";

type WeeklyAction = "refresh" | "close" | "open" | "run" | "lock";

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
 *
 * Also accepts session cookie for logged-in admin (scripts / curl with session).
 */
export async function POST(req: Request) {
  let body: {
    token?: string;
    action?: WeeklyAction;
    advance?: boolean;
    lockAt?: string | null;
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
      let lockAt: string | null =
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
    actions: ["refresh", "close", "open", "run", "lock"],
  });
}
