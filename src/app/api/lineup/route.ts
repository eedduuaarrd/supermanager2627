import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getCurrentRound } from "@/lib/db";
import {
  formatLockMessageCa,
  isLineupLocked,
} from "@/lib/fixtures";
import { getLineupLockAt, getRoundStatus } from "@/lib/rounds";
import { ensureLineupRow, saveLineup } from "@/lib/scoring";
import {
  getTeamTransferPhase,
  promoteInitialTeamsIfLocked,
  requireActiveTeamId,
} from "@/lib/teams";
import { INITIAL_BUDGET, LINEUP_SIZE, resolvePlayerId } from "@/data/roster";
import { parsePlayerIds } from "@/lib/game";
import {
  buildTransferState,
  maxChangesExceededCa,
  parseSnapshotIds,
} from "@/lib/transfers";

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

function lockState() {
  const roundStatus = getRoundStatus();
  const lockAt = getLineupLockAt();
  const tipLocked = isLineupLocked(lockAt);
  // Tip-off reached: flip initial → normal for all fantasy teams still open.
  if (tipLocked) promoteInitialTeamsIfLocked();
  const locked = roundStatus === "closed" || tipLocked;
  const tipMessage =
    tipLocked && lockAt
      ? formatLockMessageCa(lockAt)
      : roundStatus === "closed"
        ? "La jornada està tancada. No es pot modificar l'alineació."
        : null;
  return {
    roundStatus,
    lockAt,
    locked,
    tipLocked,
    tipMessage,
  };
}

function transferPayload(
  teamId: string,
  row: {
    player_ids: string;
    snapshot_ids?: string;
    changes_used?: number;
  },
  lock: ReturnType<typeof lockState>,
) {
  const currentIds = parsePlayerIds(row.player_ids);
  const snapshotIds = parseSnapshotIds(row.snapshot_ids);
  const phase = getTeamTransferPhase(teamId);
  return buildTransferState({
    windowOpen: !lock.locked,
    snapshotIds,
    currentIds,
    lockAt: lock.lockAt,
    tipLockMessage: lock.tipMessage,
    phase,
  });
}

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const teamId = requireActiveTeamId(user.id);
  const round = getCurrentRound();
  const lock = lockState();
  const row = ensureLineupRow(teamId, round);
  const transfer = transferPayload(teamId, row, lock);
  return NextResponse.json({
    round,
    roundStatus: lock.roundStatus,
    lockAt: lock.lockAt,
    locked: lock.locked,
    lockMessage: transfer.message,
    transfer,
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
  const lock = lockState();
  if (lock.locked) {
    const transfer = buildTransferState({
      windowOpen: false,
      snapshotIds: [],
      currentIds: [],
      lockAt: lock.lockAt,
      tipLockMessage: lock.tipMessage,
      phase: "normal",
    });
    return NextResponse.json(
      {
        error:
          transfer.message ??
          "L'alineació està bloquejada. No es pot modificar.",
        lockAt: lock.lockAt,
        locked: true,
        transfer,
      },
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
    const isLimit = result.error === maxChangesExceededCa();
    return NextResponse.json(
      { error: result.error },
      { status: isLimit ? 403 : 400 },
    );
  }

  const round = getCurrentRound();
  const transfer = transferPayload(teamId, result.row, lock);
  return NextResponse.json({
    round,
    roundStatus: lock.roundStatus,
    lockAt: lock.lockAt,
    locked: false,
    lockMessage: transfer.message,
    transfer,
    budget: result.row.budget,
    teamId,
    lineup: lineupPayload(result.row),
  });
}

export async function POST(req: Request) {
  return PUT(req);
}
