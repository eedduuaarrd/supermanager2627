import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ROSTER, TEAMS, TEAM_ORDER, INITIAL_BUDGET, LINEUP_SLOTS } from "@/data/roster";

export const runtime = "nodejs";

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  return NextResponse.json({
    players: ROSTER,
    teams: TEAM_ORDER.map((id) => TEAMS[id]),
    rules: {
      budget: INITIAL_BUDGET,
      slots: LINEUP_SLOTS,
    },
  });
}
