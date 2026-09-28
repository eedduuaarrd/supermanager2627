import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { confirmLineup, ensureLineupRow } from "@/lib/scoring";
import { getCurrentRound } from "@/lib/db";
import { parsePlayerIds } from "@/lib/game";

export const runtime = "nodejs";

export async function POST() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const result = confirmLineup(user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const round = getCurrentRound();
  const row = ensureLineupRow(user.id, round);
  return NextResponse.json({
    ok: true,
    round,
    lineup: {
      playerIds: parsePlayerIds(row.player_ids),
      captainId: row.captain_id,
      confirmed: row.confirmed === 1,
      confirmedAt: row.confirmed_at,
    },
  });
}
