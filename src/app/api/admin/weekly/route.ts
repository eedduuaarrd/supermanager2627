import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { getRoundStatus } from "@/lib/rounds";
import { closeJornada, openNextJornada } from "@/lib/scoring";

export const runtime = "nodejs";

type WeeklyAction = "refresh" | "close" | "open" | "run";

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
 * Body: { token?, action: "refresh"|"close"|"open"|"run" }
 * - refresh: no-op here (stats refresh is `node scripts/refresh-fcbq-stats.mjs`); returns status
 * - close: score current jornada from FCBQ game rows, lock lineups (no advance)
 * - open: open next jornada after a close
 * - run: close + advance (score + open next) — typical weekly cron step after refresh
 *
 * Also accepts session cookie for logged-in admin (UI).
 */
export async function POST(req: Request) {
  let body: { token?: string; action?: WeeklyAction; advance?: boolean } = {};
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
        hint: "Executa: node scripts/refresh-fcbq-stats.mjs [--from path] i després action=run",
        round: getCurrentRound(),
        roundStatus: getRoundStatus(),
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
    actions: ["refresh", "close", "open", "run"],
  });
}
