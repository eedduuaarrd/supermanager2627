import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound, MAX_TEAMS_PER_USER } from "@/lib/db";
import { listTeams } from "@/lib/teams";

export const runtime = "nodejs";

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user,
    currentRound: getCurrentRound(),
    teams: listTeams(user.id),
    maxTeams: MAX_TEAMS_PER_USER,
  });
}
