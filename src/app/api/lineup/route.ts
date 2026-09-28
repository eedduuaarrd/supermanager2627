import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { getRoundStatus } from "@/lib/rounds";
import { ensureLineupRow, saveLineup } from "@/lib/scoring";
import { requireActiveTeamId } from "@/lib/teams";
import { INITIAL_BUDGET, LINEUP_SIZE, resolvePlayerId } from "@/data/roster";
import { parsePlayerIds } from "@/lib/game";

export const runtime = "nodejs";

function lineupPayload(row: {
  player_ids: string;
  captain_id: string | null;
  confirmed: number;
  confirmed_at: string | null;
}) {
  const playerIds = parsePlayerIds(row.player_ids);
  let captainId: string | null = null;
  if (row.captain_id) {
    const mapped = resolvePlayerId(row.captain_id);
    if (mapped && playerIds.includes(mapped)) captainId = mapped;
  }
  return {
    playerIds,
    captainId,
    confirmed: row.confirmed === 1,
    confirmedAt: row.confirmed_at,
  };
}

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const teamId = requireActiveTeamId(user.id);
  const round = getCurrentRound();
  const roundStatus = getRoundStatus();
  const row = ensureLineupRow(teamId, round);
  return NextResponse.json({
    round,
    roundStatus,
    budget: row.budget ?? INITIAL_BUDGET,
    teamId,
    lineup: lineupPayload(row),
  });
}

export async function PUT(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  if (getRoundStatus() === "closed") {
    return NextResponse.json(
      { error: "La jornada està tancada. No es pot modificar l'alineació." },
      { status: 403 },
    );
  }
  const teamId = requireActiveTeamId(user.id);
  const body = (await req.json()) as {
    playerIds?: string[];
    captainId?: string | null;
  };
  const playerIds = parsePlayerIds(body.playerIds ?? []).slice(0, LINEUP_SIZE);
  const rawCaptain =
    typeof body.captainId === "string" || body.captainId === null
      ? body.captainId
      : null;
  const captainId =
    typeof rawCaptain === "string" ? resolvePlayerId(rawCaptain) : rawCaptain;

  const result = saveLineup(teamId, playerIds, captainId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const round = getCurrentRound();
  return NextResponse.json({
    round,
    roundStatus: getRoundStatus(),
    budget: result.row.budget,
    teamId,
    lineup: lineupPayload(result.row),
  });
}

/** Alias for older clients — same as PUT. */
export async function POST(req: Request) {
  return PUT(req);
}
