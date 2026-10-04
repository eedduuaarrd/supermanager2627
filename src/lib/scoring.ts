import {
  CAPTAIN_MULTIPLIER,
  INITIAL_BUDGET,
  getPlayer,
  resolvePlayerId,
} from "@/data/roster";
import {
  getCurrentRound,
  getDb,
  type DbLineup,
} from "@/lib/db";
import { livePriceOf } from "@/lib/live-roster";
import {
  fantasyStatFromGame,
  getPlayerGameForRound,
} from "@/lib/player-stats";
import {
  markRoundScored,
  openRound,
  getRoundStatus,
  getLineupLockAt,
} from "@/lib/rounds";
import { formatLockMessageCa, isLineupLocked } from "@/lib/fixtures";
import type { RoundScore } from "@/lib/types";
import {
  applyMarketTransfers,
  migrateLineupToPositions,
  migratePlayerIdList,
  parsePlayerIds,
  spentBudget,
  validateLineupSave,
} from "@/lib/game";
import {
  getTeamTransferPhase,
  promoteInitialTeamsIfLocked,
  requireActiveTeamId,
  restoreInitialPhaseUntilNextTipOff,
} from "@/lib/teams";
import {
  MAX_TRANSFERS,
  countChangesUsed,
  maxChangesExceededCa,
  parseSnapshotIds,
} from "@/lib/transfers";

export type StandingRow = {
  teamId: string;
  userId: string;
  displayName: string;
  teamName: string;
  points: number;
  rank: number;
  isYou: boolean;
};

export type TeamRoundHistoryRow = {
  round: number;
  points: number;
  cumulative: number;
  rank: number | null;
  opponent: string;
  captainId: string | null;
  playedAt: string;
  scores: RoundScore[];
};

/** Scored jornadas for one fantasy team, oldest → newest, with cumulative + rank. */
export function getTeamRoundHistory(teamId: string): TeamRoundHistoryRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT round, points, opponent, scores_json, captain_id, played_at
       FROM round_scores
       WHERE team_id = ?
       ORDER BY round ASC`,
    )
    .all(teamId) as {
    round: number;
    points: number;
    opponent: string;
    scores_json: string;
    captain_id: string | null;
    played_at: string;
  }[];

  if (rows.length === 0) return [];

  const rounds = rows.map((r) => r.round);
  const placeholders = rounds.map(() => "?").join(",");
  const peerScores = db
    .prepare(
      `SELECT team_id, round, points FROM round_scores WHERE round IN (${placeholders})`,
    )
    .all(...rounds) as { team_id: string; round: number; points: number }[];

  const byRound = new Map<number, { team_id: string; points: number }[]>();
  for (const p of peerScores) {
    const list = byRound.get(p.round) ?? [];
    list.push({ team_id: p.team_id, points: p.points });
    byRound.set(p.round, list);
  }

  let cumulative = 0;
  return rows.map((row) => {
    cumulative += row.points;
    const peers = byRound.get(row.round) ?? [];
    peers.sort((a, b) => b.points - a.points || a.team_id.localeCompare(b.team_id));
    const rankIdx = peers.findIndex((p) => p.team_id === teamId);
    let scores: RoundScore[] = [];
    try {
      scores = JSON.parse(row.scores_json) as RoundScore[];
      if (!Array.isArray(scores)) scores = [];
    } catch {
      scores = [];
    }
    return {
      round: row.round,
      points: row.points,
      cumulative,
      rank: rankIdx >= 0 ? rankIdx + 1 : null,
      opponent: row.opponent,
      captainId: row.captain_id,
      playedAt: row.played_at,
      scores,
    };
  });
}

export function getStandings(
  scope: "jornada" | "general",
  viewerId?: string,
): { round: number; rows: StandingRow[]; roundStatus: "open" | "closed" } {
  const db = getDb();
  const currentRound = getCurrentRound(db);
  const roundStatus = getRoundStatus(db);

  if (scope === "jornada") {
    // Show last scored jornada when current is open with no scores yet.
    const hasCurrent = db
      .prepare(`SELECT 1 FROM round_scores WHERE round = ? LIMIT 1`)
      .get(currentRound);
    const targetRound = hasCurrent
      ? currentRound
      : Math.max(1, currentRound - (roundStatus === "open" ? 1 : 0));
    const rows = db
      .prepare(
        `SELECT t.id AS teamId, u.id AS userId, u.display_name AS displayName,
                t.name AS teamName, COALESCE(rs.points, 0) AS points
         FROM fantasy_teams t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN round_scores rs ON rs.team_id = t.id AND rs.round = ?
         ORDER BY points DESC, t.name ASC`,
      )
      .all(targetRound) as Omit<StandingRow, "rank" | "isYou">[];

    return {
      round: targetRound,
      roundStatus,
      rows: rows.map((r, i) => ({
        ...r,
        rank: i + 1,
        isYou: r.userId === viewerId,
      })),
    };
  }

  const rows = db
    .prepare(
      `SELECT t.id AS teamId, u.id AS userId, u.display_name AS displayName,
              t.name AS teamName, COALESCE(SUM(rs.points), 0) AS points
       FROM fantasy_teams t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN round_scores rs ON rs.team_id = t.id
       GROUP BY t.id
       ORDER BY points DESC, t.name ASC`,
    )
    .all() as Omit<StandingRow, "rank" | "isYou">[];

  return {
    round: currentRound,
    roundStatus,
    rows: rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      isYou: r.userId === viewerId,
    })),
  };
}

function resolveCaptainId(
  captainId: string | null,
  playerIds: string[],
): string | null {
  if (!captainId) return null;
  const mapped = resolvePlayerId(captainId);
  if (mapped && playerIds.includes(mapped)) return mapped;
  return null;
}

let cashLedgerMigrated = false;

/**
 * One-shot: convert legacy mark-to-market rows (budget left at INITIAL while the
 * squad was only charged in the UI) into real efectiu = INITIAL − market value.
 */
export function migrateCashLedgerOnce(db = getDb()) {
  if (cashLedgerMigrated) return;
  const flag = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("cash_ledger_v1") as { value: string } | undefined;
  if (flag?.value === "1") {
    cashLedgerMigrated = true;
    return;
  }

  const rows = db
    .prepare(`SELECT team_id, round, player_ids, budget FROM lineups`)
    .all() as {
    team_id: string;
    round: number;
    player_ids: string;
    budget: number;
  }[];

  const upd = db.prepare(
    `UPDATE lineups SET budget = ? WHERE team_id = ? AND round = ?`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (row.budget !== INITIAL_BUDGET) continue;
      const ids = parsePlayerIds(row.player_ids);
      if (ids.length === 0) continue;
      const cash = Math.max(0, INITIAL_BUDGET - spentBudget(ids, livePriceOf));
      upd.run(cash, row.team_id, row.round);
    }
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run("cash_ledger_v1", "1");
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run("schema_version", "5");
  });
  tx();
  cashLedgerMigrated = true;
}

/** Read lineup row for a fantasy team and flatten legacy JSON if needed. */
export function ensureLineupRow(teamId: string, round?: number) {
  migrateCashLedgerOnce();
  const db = getDb();
  const r = round ?? getCurrentRound(db);
  const existing = db
    .prepare("SELECT * FROM lineups WHERE team_id = ? AND round = ?")
    .get(teamId, r) as DbLineup | undefined;
  if (existing) return migrateLineupRowIfNeeded(existing);

  const prev = db
    .prepare(`SELECT * FROM lineups WHERE team_id = ? AND round = ?`)
    .get(teamId, r - 1) as DbLineup | undefined;
  const carryIds = prev ? parsePlayerIds(prev.player_ids) : [];
  const carryCaptain = prev
    ? resolveCaptainId(prev.captain_id, carryIds)
    : null;
  // Carry efectiu across jornadas (do not reset to INITIAL while keeping the squad).
  const carryCash = prev?.budget ?? INITIAL_BUDGET;

  db.prepare(
    `INSERT INTO lineups
     (team_id, round, player_ids, captain_id, confirmed, confirmed_at, budget,
      snapshot_ids, changes_used)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, 0)`,
  ).run(
    teamId,
    r,
    JSON.stringify(carryIds),
    carryCaptain,
    carryCash,
    JSON.stringify(carryIds),
  );

  return db
    .prepare("SELECT * FROM lineups WHERE team_id = ? AND round = ?")
    .get(teamId, r) as DbLineup;
}

export function resetTransferSnapshot(
  teamId: string,
  round: number,
  db = getDb(),
) {
  const row = ensureLineupRow(teamId, round);
  const ids = parsePlayerIds(row.player_ids);
  db.prepare(
    `UPDATE lineups SET snapshot_ids = ?, changes_used = 0
     WHERE team_id = ? AND round = ?`,
  ).run(JSON.stringify(ids), teamId, round);
}

export function resetAllTransferWindows(round?: number, db = getDb()) {
  const r = round ?? getCurrentRound(db);
  const teams = db.prepare("SELECT id FROM fantasy_teams").all() as {
    id: string;
  }[];
  for (const t of teams) {
    ensureLineupRow(t.id, r);
    resetTransferSnapshot(t.id, r, db);
  }
}

/** Convenience: ensure lineup for the user's active team. */
export function ensureActiveLineup(userId: string, round?: number) {
  return ensureLineupRow(requireActiveTeamId(userId), round);
}

function migrateLineupRowIfNeeded(row: DbLineup): DbLineup {
  const flat = parsePlayerIds(row.player_ids);
  const captainId = resolveCaptainId(row.captain_id, flat);
  const sameIds = (() => {
    try {
      const raw = JSON.parse(row.player_ids) as unknown;
      return (
        Array.isArray(raw) &&
        raw.length === flat.length &&
        flat.every((id, i) => id === raw[i])
      );
    } catch {
      return false;
    }
  })();

  let nextBudget = row.budget;
  let budgetChanged = false;
  if (!sameIds) {
    // Refund market price of players dropped by id/position migration.
    try {
      const raw = JSON.parse(row.player_ids) as unknown;
      let previous: string[] = [];
      if (Array.isArray(raw)) {
        previous = raw.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        );
      } else if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.playerIds)) {
          previous = obj.playerIds.filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          );
        } else if (Array.isArray(obj.slots)) {
          previous = obj.slots.filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          );
        } else if (obj.slots && typeof obj.slots === "object") {
          const slots = obj.slots as Record<string, unknown>;
          for (const key of ["pivot", "P", "aler", "A", "base", "B"]) {
            const arr = slots[key];
            if (!Array.isArray(arr)) continue;
            for (const id of arr) {
              if (typeof id === "string" && id.length > 0) previous.push(id);
            }
          }
        }
      }
      const before = migratePlayerIdList(previous);
      const transfer = applyMarketTransfers(
        row.budget,
        before,
        flat,
        livePriceOf,
      );
      if (transfer.cash !== row.budget) {
        nextBudget = Math.max(0, transfer.cash);
        budgetChanged = true;
      }
    } catch {
      /* keep budget */
    }
  }

  if (sameIds && captainId === row.captain_id && !budgetChanged) return row;

  const db = getDb();
  db.prepare(
    `UPDATE lineups SET player_ids = ?, captain_id = ?, budget = ?
     WHERE team_id = ? AND round = ?`,
  ).run(JSON.stringify(flat), captainId, nextBudget, row.team_id, row.round);
  return {
    ...row,
    player_ids: JSON.stringify(flat),
    captain_id: captainId,
    budget: nextBudget,
  };
}

export function saveLineup(
  teamId: string,
  playerIds: string[],
  captainId: string | null,
): { ok: true; row: DbLineup } | { ok: false; error: string } {
  const db = getDb();
  const round = getCurrentRound(db);
  if (getRoundStatus(db) === "closed") {
    return {
      ok: false,
      error: "La jornada està tancada. L'alineació ja no es pot modificar.",
    };
  }
  const lockAt = getLineupLockAt(db);
  if (isLineupLocked(lockAt)) {
    promoteInitialTeamsIfLocked(new Date(), db);
    return {
      ok: false,
      error: formatLockMessageCa(lockAt!),
    };
  }
  restoreInitialPhaseUntilNextTipOff(new Date(), db);
  const existing = ensureLineupRow(teamId, round);
  if (existing.confirmed) {
    return {
      ok: false,
      error: "L'alineació d'aquesta jornada està bloquejada.",
    };
  }
  // Normalize to ordered P→A→B groups; drop overflow / unknown ids.
  const normalizedIds = migrateLineupToPositions(playerIds);
  // Migrate collapsed dual-team captain ids the same way as playerIds.
  const resolvedCaptain = resolveCaptainId(captainId, normalizedIds);
  const previousIds = parsePlayerIds(existing.player_ids);
  const check = validateLineupSave(
    normalizedIds,
    resolvedCaptain,
    existing.budget,
    previousIds,
    livePriceOf,
  );
  if (!check.ok) return check;

  const phase = getTeamTransferPhase(teamId, db);
  const snapshotIds = parseSnapshotIds(existing.snapshot_ids);
  const changesUsed = countChangesUsed(snapshotIds, normalizedIds);
  // Initial roster: unlimited canvis until first tip-off lock flips phase.
  if (phase !== "initial" && changesUsed > MAX_TRANSFERS) {
    return { ok: false, error: maxChangesExceededCa(MAX_TRANSFERS) };
  }

  db.prepare(
    `UPDATE lineups
     SET player_ids = ?, captain_id = ?, confirmed = 0, confirmed_at = NULL,
         changes_used = ?, budget = ?
     WHERE team_id = ? AND round = ?`,
  ).run(
    JSON.stringify(normalizedIds),
    resolvedCaptain,
    changesUsed,
    check.cash,
    teamId,
    round,
  );
  return { ok: true, row: ensureLineupRow(teamId, round) };
}

function scoreLineupFromFcbq(
  row: DbLineup,
  round: number,
): { teamPoints: number; scores: RoundScore[]; label: string } {
  const playerIds = parsePlayerIds(row.player_ids);
  const scores: RoundScore[] = playerIds.map((playerId) => {
    const game = getPlayerGameForRound(playerId, round);
    const { points: base, source, minutes } = fantasyStatFromGame(game);
    const points =
      playerId === row.captain_id ? base * CAPTAIN_MULTIPLIER : base;
    return {
      playerId,
      points,
      minutes: Math.round(minutes),
      winBonus: false,
      // Extended fields consumed by UI via scores_json
      ...(source === "DNP"
        ? { dnp: true, note: "No ha jugat aquesta jornada (0)" }
        : { statSource: source, val: base }),
    } as RoundScore;
  });
  const teamPoints = scores.reduce((s, x) => s + x.points, 0);

  // Opponent label from first real game row among the lineup (club week).
  let label = `FCBQ J${round}`;
  for (const id of playerIds) {
    const g = getPlayerGameForRound(id, round);
    if (g?.opponent) {
      label = g.opponent;
      break;
    }
    if (g) {
      const p = getPlayer(id);
      if (p) {
        label = `Partits club · J${round}`;
        break;
      }
    }
  }

  return { teamPoints, scores, label };
}

/**
 * Close current jornada using that week's FCBQ box scores (Balaguer VAL).
 * Locks lineups; does not invent games — DNP → 0.
 * Optionally opens the next jornada when `advance` is true.
 */
export function closeJornada(options?: {
  advance?: boolean;
}): {
  round: number;
  scored: number;
  nextRound: number | null;
  opponent: string;
  roundStatus: "open" | "closed";
} {
  const db = getDb();
  const round = getCurrentRound(db);
  const advance = options?.advance !== false;

  const lineups = db
    .prepare(`SELECT * FROM lineups WHERE round = ?`)
    .all(round) as DbLineup[];

  const closedAt = new Date().toISOString();
  let opponent = `FCBQ J${round}`;

  const tx = db.transaction(() => {
    for (const row of lineups) {
      const { teamPoints, scores, label } = scoreLineupFromFcbq(row, round);
      if (label) opponent = label;

      db.prepare(
        `INSERT INTO round_scores (team_id, round, points, opponent, won, scores_json, captain_id, played_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(team_id, round) DO UPDATE SET
           points = excluded.points,
           opponent = excluded.opponent,
           won = excluded.won,
           scores_json = excluded.scores_json,
           captain_id = excluded.captain_id,
           played_at = excluded.played_at`,
      ).run(
        row.team_id,
        round,
        teamPoints,
        label,
        0, // no invented W/L bonus
        JSON.stringify(scores),
        row.captain_id,
        closedAt,
      );

      db.prepare(
        `UPDATE lineups SET confirmed = 1, confirmed_at = ? WHERE team_id = ? AND round = ?`,
      ).run(closedAt, row.team_id, round);
    }

    markRoundScored(round, closedAt, db);

    if (advance) {
      const next = round + 1;
      openRound(next, db);
      const teams = db.prepare("SELECT id FROM fantasy_teams").all() as {
        id: string;
      }[];
      for (const t of teams) {
        ensureLineupRow(t.id, next);
        resetTransferSnapshot(t.id, next, db);
      }
    }
  });

  tx();

  const nextRound = advance ? round + 1 : null;
  return {
    round,
    scored: lineups.length,
    nextRound,
    opponent,
    roundStatus: advance ? "open" : "closed",
  };
}

/** Open the next jornada after a close without advance, or ensure current is open. */
export function openNextJornada(): {
  round: number;
  roundStatus: "open";
} {
  const db = getDb();
  const current = getCurrentRound(db);
  const status = getRoundStatus(db);
  if (status === "open") {
    return { round: current, roundStatus: "open" };
  }
  const next = current + 1;
  const tx = db.transaction(() => {
    openRound(next, db);
    const teams = db.prepare("SELECT id FROM fantasy_teams").all() as {
      id: string;
    }[];
    for (const t of teams) {
      ensureLineupRow(t.id, next);
      resetTransferSnapshot(t.id, next, db);
    }
  });
  tx();
  return { round: next, roundStatus: "open" };
}

/**
 * @deprecated name kept for API compatibility — scores from FCBQ, not random sim.
 */
export function simulateJornada() {
  return closeJornada({ advance: true });
}
