import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  TEAMS,
  TEAM_ORDER,
  INITIAL_BUDGET,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  POSITION_LABEL,
} from "@/data/roster";
import { getLiveRoster } from "@/lib/live-roster";

export const runtime = "nodejs";

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  return NextResponse.json({
    players: getLiveRoster(),
    teams: TEAM_ORDER.map((id) => TEAMS[id]),
    rules: {
      budget: INITIAL_BUDGET,
      lineupSize: LINEUP_SIZE,
      lineupSlots: LINEUP_SLOTS,
      positionLabels: POSITION_LABEL,
    },
  });
}
