import {
  CAPTAIN_MULTIPLIER,
  INITIAL_BUDGET,
  OPPONENTS,
  WIN_BONUS,
  getPlayer,
  resolvePlayerId,
} from "@/data/roster";
import {
  getCurrentRound,
  getDb,
  setCurrentRound,
  type DbLineup,
} from "@/lib/db";
import type { RoundScore } from "@/lib/types";
import { parsePlayerIds, validateLineupSave } from "@/lib/game";
import { requireActiveTeamId } from "@/lib/teams";

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulatePlayerScore(
  avgVal: number,
  rand: () => number,
  won: boolean,
): number {
  const variance = (rand() - 0.45) * 10;
  let val = Math.round(avgVal + variance);
  if (rand() < 0.08) val = Math.max(-2, val - 8);
  if (won && val > 0) val = Math.round(val * (1 + WIN_BONUS));
  return val;
}

export type StandingRow = {
  teamId: string;
  userId: string;
  displayName: string;
  teamName: string;
  points: number;
  rank: number;
  isYou: boolean;
};

export function getStandings(
  scope: "jornada" | "general",
  viewerId?: string,
): { round: number; rows: StandingRow[] } {
  const db = getDb();
  const currentRound = getCurrentRound(db);

  if (scope === "jornada") {
    const targetRound = Math.max(1, currentRound - 1);
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
    rows: rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      isYou: r.userId === viewerId,
    })),
  };
}

/** Read lineup row for a fantasy team and flatten legacy JSON if needed. */
export function ensureLineupRow(teamId: string, round?: number) {
  const db = getDb();
  const r = round ?? getCurrentRound(db);
  const existing = db
    .prepare("SELECT * FROM lineups WHERE team_id = ? AND round = ?")
    .get(teamId, r) as DbLineup | undefined;
  if (existing) return migrateLineupRowIfNeeded(existing);

  db.prepare(
    `INSERT INTO lineups (team_id, round, player_ids, captain_id, confirmed, confirmed_at, budget)
     VALUES (?, ?, '[]', NULL, 0, NULL, ?)`,
  ).run(teamId, r, INITIAL_BUDGET);

  return db
    .prepare("SELECT * FROM lineups WHERE team_id = ? AND round = ?")
    .get(teamId, r) as DbLineup;
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
  if (sameIds && captainId === row.captain_id) return row;

  const db = getDb();
  db.prepare(
    `UPDATE lineups SET player_ids = ?, captain_id = ? WHERE team_id = ? AND round = ?`,
  ).run(JSON.stringify(flat), captainId, row.team_id, row.round);
  return {
    ...row,
    player_ids: JSON.stringify(flat),
    captain_id: captainId,
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

export function saveLineup(
  teamId: string,
  playerIds: string[],
  captainId: string | null,
): { ok: true; row: DbLineup } | { ok: false; error: string } {
  const db = getDb();
  const round = getCurrentRound(db);
  const existing = ensureLineupRow(teamId, round);
  // Migrate collapsed dual-team captain ids the same way as playerIds.
  const resolvedCaptain = resolveCaptainId(captainId, playerIds);
  const check = validateLineupSave(playerIds, resolvedCaptain, existing.budget);
  if (!check.ok) return check;

  db.prepare(
    `UPDATE lineups
     SET player_ids = ?, captain_id = ?, confirmed = 0, confirmed_at = NULL
     WHERE team_id = ? AND round = ?`,
  ).run(JSON.stringify(playerIds), resolvedCaptain, teamId, round);
  return { ok: true, row: ensureLineupRow(teamId, round) };
}

/** Admin closes jornada: score every saved team lineup, then advance. */
export function simulateJornada(): {
  round: number;
  scored: number;
  nextRound: number;
  opponent: string;
} {
  const db = getDb();
  const round = getCurrentRound(db);
  const opponent = OPPONENTS[(round - 1) % OPPONENTS.length];

  const lineups = db
    .prepare(`SELECT * FROM lineups WHERE round = ?`)
    .all(round) as DbLineup[];

  const closedAt = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const row of lineups) {
      const playerIds = parsePlayerIds(row.player_ids);
      const seed =
        round * 997 +
        row.team_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
        playerIds.reduce((a, id) => a + id.charCodeAt(0), 0);
      const rand = seededRandom(seed);
      const won = rand() > 0.42;

      const scores: RoundScore[] = playerIds.map((playerId) => {
        const player = getPlayer(playerId);
        const avg = player?.avgVal ?? 5;
        const base = simulatePlayerScore(avg, rand, won);
        const points =
          playerId === row.captain_id ? base * CAPTAIN_MULTIPLIER : base;
        return {
          playerId,
          points,
          minutes: Math.round(18 + rand() * 16),
          winBonus: won && base > 0,
        };
      });
      const teamPoints = scores.reduce((s, x) => s + x.points, 0);

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
        opponent,
        won ? 1 : 0,
        JSON.stringify(scores),
        row.captain_id,
        closedAt,
      );

      db.prepare(
        `UPDATE lineups SET confirmed = 1, confirmed_at = ? WHERE team_id = ? AND round = ?`,
      ).run(closedAt, row.team_id, round);
    }

    const next = round + 1;
    setCurrentRound(next, db);

    const teams = db.prepare("SELECT id FROM fantasy_teams").all() as {
      id: string;
    }[];
    for (const t of teams) {
      ensureLineupRow(t.id, next);
    }
  });

  tx();

  return {
    round,
    scored: lineups.length,
    nextRound: round + 1,
    opponent,
  };
}
