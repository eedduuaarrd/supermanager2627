import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import {
  formatLockMessageCa,
  isLineupLocked,
  nextMatchesForClub,
} from "@/lib/fixtures";
import { getLineupLockAt, getRoundRow, getRoundStatus } from "@/lib/rounds";

export const runtime = "nodejs";

/** Current jornada meta for the Inici hub (number + open/closed + lock + next matches). */
export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }

  const round = getCurrentRound();
  const status = getRoundStatus();
  const row = getRoundRow(round);
  const lockAt = getLineupLockAt();
  const locked =
    status === "closed" || isLineupLocked(lockAt);
  const nextMatches = nextMatchesForClub();

  return NextResponse.json({
    round,
    status,
    label: row?.label ?? `Jornada ${round}`,
    openedAt: row?.opened_at ?? null,
    scoredAt: row?.scored_at ?? null,
    lockAt,
    locked,
    lockMessage: locked && lockAt ? formatLockMessageCa(lockAt) : null,
    nextMatches,
    weeklyNote:
      "Cada setmana hi ha jornada nova amb els partits del club.",
  });
}
