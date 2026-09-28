import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { ensureLineupRow, saveLineup } from "@/lib/scoring";
import { INITIAL_BUDGET } from "@/data/roster";

export const runtime = "nodejs";

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const round = getCurrentRound();
  const row = ensureLineupRow(user.id, round);
  return NextResponse.json({
    round,
    budget: row.budget ?? INITIAL_BUDGET,
    lineup: {
      playerIds: JSON.parse(row.player_ids) as string[],
      captainId: row.captain_id,
      confirmed: row.confirmed === 1,
      confirmedAt: row.confirmed_at,
    },
  });
}

export async function PUT(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const body = (await req.json()) as {
    playerIds?: string[];
    captainId?: string | null;
  };
  const playerIds = Array.isArray(body.playerIds) ? body.playerIds : [];
  const captainId =
    typeof body.captainId === "string" || body.captainId === null
      ? body.captainId
      : null;

  const round = getCurrentRound();
  const existing = ensureLineupRow(user.id, round);
  if (existing.confirmed === 1) {
    return NextResponse.json(
      { error: "L'alineació ja està confirmada per aquesta jornada." },
      { status: 409 },
    );
  }

  const row = saveLineup(user.id, playerIds, captainId);
  return NextResponse.json({
    round,
    budget: row.budget,
    lineup: {
      playerIds: JSON.parse(row.player_ids) as string[],
      captainId: row.captain_id,
      confirmed: row.confirmed === 1,
      confirmedAt: row.confirmed_at,
    },
  });
}
