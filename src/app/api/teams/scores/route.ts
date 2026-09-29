import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import { getRoundStatus } from "@/lib/rounds";
import { getTeamRoundHistory } from "@/lib/scoring";
import { ensureActiveTeamId } from "@/lib/teams";

export const runtime = "nodejs";

/** Points history for the active fantasy team (`round_scores`). */
export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  let teamId: string;
  try {
    teamId = ensureActiveTeamId(user.id, user.teamName || user.displayName);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No hi ha cap equip actiu.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  const history = getTeamRoundHistory(teamId);
  return NextResponse.json({
    teamId,
    round: getCurrentRound(),
    roundStatus: getRoundStatus(),
    history,
  });
}
