import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { getRoundStatus } from "@/lib/rounds";
import { getTeamRoundHistory } from "@/lib/scoring";
import { requireActiveTeamId } from "@/lib/teams";

export const runtime = "nodejs";

/** Points history for the active fantasy team (`round_scores`). */
export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const teamId = requireActiveTeamId(user.id);
  const history = getTeamRoundHistory(teamId);
  return NextResponse.json({
    teamId,
    round: getCurrentRound(),
    roundStatus: getRoundStatus(),
    history,
  });
}
