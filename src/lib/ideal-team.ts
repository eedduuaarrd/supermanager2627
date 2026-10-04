import { getDb, getCurrentRound } from "@/lib/db";
import { getLiveRoster } from "@/lib/live-roster";
import {
  fantasyStatFromGame,
  getPlayerGameForRound,
} from "@/lib/player-stats";
import { getRoundStatus } from "@/lib/rounds";
import type { Position } from "@/lib/types";

export type IdealScore = {
  playerId: string;
  points: number;
};

export type StoredIdealTeam = {
  round: number;
  playerIds: string[];
  scores: IdealScore[];
  updatedAt: string;
};

export type ScoredIdealPlayer = {
  playerId: string;
  position: Position;
  points: number;
};

/**
 * Caps for the locked ideal team: 2 bases, 3 alers, 3 pivots.
 * These are maximums. A line with fewer real scorers stays short.
 */
export const IDEAL_TEAM_SLOTS = {
  B: 2,
  A: 3,
  P: 3,
} as const;

/**
 * Last jornada whose results are already in (not the one still open).
 * Open jornada 2 → 1. Closed jornada 2 (scored, not advanced yet) → 2.
 * Nothing completed while jornada 1 is still open.
 */
export function lastCompletedRound(
  currentRound: number,
  status: "open" | "closed",
): number | null {
  if (!Number.isInteger(currentRound) || currentRound < 1) return null;
  if (status === "closed") return currentRound;
  if (currentRound > 1) return currentRound - 1;
  return null;
}

/**
 * Best real scorers for the ideal court, ordered like the lineup (P→A→B).
 * Takes at most 3 pivots, 3 alers and 2 bases. A shorter line is kept as the
 * players who actually scored — never padded with an invented player.
 * Returns null only when nobody has a usable score.
 */
export function pickIdealLineup(
  scored: ScoredIdealPlayer[],
): { playerIds: string[]; scores: IdealScore[] } | null {
  const best = new Map<string, ScoredIdealPlayer>();
  for (const row of scored) {
    if (row.position !== "P" && row.position !== "A" && row.position !== "B") {
      continue;
    }
    if (!row.playerId || !Number.isFinite(row.points)) continue;
    const prev = best.get(row.playerId);
    if (!prev || row.points > prev.points) best.set(row.playerId, row);
  }

  const pools: Record<Position, ScoredIdealPlayer[]> = { P: [], A: [], B: [] };
  for (const row of best.values()) pools[row.position].push(row);

  for (const pos of ["P", "A", "B"] as const) {
    pools[pos].sort(
      (a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId),
    );
  }

  const picked = [
    ...pools.P.slice(0, IDEAL_TEAM_SLOTS.P),
    ...pools.A.slice(0, IDEAL_TEAM_SLOTS.A),
    ...pools.B.slice(0, IDEAL_TEAM_SLOTS.B),
  ];
  if (picked.length === 0) return null;
  return {
    playerIds: picked.map((p) => p.playerId),
    scores: picked.map((p) => ({ playerId: p.playerId, points: p.points })),
  };
}

/** Real fantasy VAL for `round`. DNP / missing box score is omitted. */
export function collectScoredPlayers(round: number): ScoredIdealPlayer[] {
  const out: ScoredIdealPlayer[] = [];
  for (const player of getLiveRoster()) {
    const stat = fantasyStatFromGame(getPlayerGameForRound(player.id, round));
    if (stat.source !== "VAL") continue;
    out.push({
      playerId: player.id,
      position: player.position,
      points: stat.points,
    });
  }
  return out;
}

function parseStored(row: {
  round: number;
  player_ids: string;
  scores_json: string;
  updated_at: string;
}): StoredIdealTeam | null {
  let playerIds: unknown;
  let scores: unknown;
  try {
    playerIds = JSON.parse(row.player_ids);
    scores = JSON.parse(row.scores_json);
  } catch {
    return null;
  }
  if (!Array.isArray(playerIds) || !Array.isArray(scores)) return null;
  const ids = playerIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  const parsed: IdealScore[] = [];
  for (const item of scores) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { playerId?: unknown; points?: unknown };
    if (typeof rec.playerId !== "string" || typeof rec.points !== "number") {
      continue;
    }
    if (!Number.isFinite(rec.points)) continue;
    parsed.push({ playerId: rec.playerId, points: rec.points });
  }
  if (ids.length === 0 || parsed.length === 0) return null;
  return {
    round: row.round,
    playerIds: ids,
    scores: parsed,
    updatedAt: row.updated_at,
  };
}

export function readStoredIdealTeam(db = getDb()): StoredIdealTeam | null {
  const row = db
    .prepare(
      `SELECT round, player_ids, scores_json, updated_at
       FROM ideal_lineup WHERE id = 1`,
    )
    .get() as
    | {
        round: number;
        player_ids: string;
        scores_json: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return parseStored(row);
}

export type RefreshIdealResult =
  | { stored: true; round: number; playerIds: string[]; scores: IdealScore[] }
  | {
      stored: false;
      reason: "no-scores";
      round: number;
      keptRound: number | null;
    };

/**
 * Recompute the ideal lineup for `round` from box scores and persist it.
 * A line that is short of real scorers is stored as the players who played.
 * That partial lineup still replaces the previous jornada. The previous row
 * stays only when this jornada has no usable scores at all.
 * `scored` defaults to the real VAL rows for `round`.
 */
export function refreshStoredIdealTeam(
  round: number,
  db = getDb(),
  scored: ScoredIdealPlayer[] = collectScoredPlayers(round),
): RefreshIdealResult {
  const kept = readStoredIdealTeam(db);
  if (scored.length === 0) {
    return {
      stored: false,
      reason: "no-scores",
      round,
      keptRound: kept?.round ?? null,
    };
  }
  const picked = pickIdealLineup(scored);
  if (!picked) {
    return {
      stored: false,
      reason: "no-scores",
      round,
      keptRound: kept?.round ?? null,
    };
  }
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ideal_lineup (id, round, player_ids, scores_json, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       round = excluded.round,
       player_ids = excluded.player_ids,
       scores_json = excluded.scores_json,
       updated_at = excluded.updated_at`,
  ).run(
    round,
    JSON.stringify(picked.playerIds),
    JSON.stringify(picked.scores),
    updatedAt,
  );
  return { stored: true, round, ...picked };
}

export type IdealTeamView = {
  /** Jornada the button labels. Stored lineup when we have one. */
  round: number | null;
  team: StoredIdealTeam | null;
  /**
   * A newer jornada is the last completed one, but it is not the stored
   * lineup (the Sunday job has not written it, or it had no real scores).
   * Null when the label matches the stored team.
   */
  pendingRound: number | null;
};

/**
 * Popup source. Reads the stored lineup.
 * When nothing is stored yet, materializes the last completed jornada once
 * from real VAL so the first view is not empty. Later jornadas are written
 * only by the Sunday job (`refreshStoredIdealTeam`), not on each read.
 */
export function ensureStoredIdealTeam(db = getDb()): IdealTeamView {
  let team = readStoredIdealTeam(db);
  const completed = lastCompletedRound(getCurrentRound(db), getRoundStatus(db));
  if (!team && completed != null) {
    refreshStoredIdealTeam(completed, db);
    team = readStoredIdealTeam(db);
  }
  const pendingRound =
    team && completed != null && team.round !== completed ? completed : null;
  return {
    round: team?.round ?? completed,
    team,
    pendingRound,
  };
}
