import {
  CAPTAIN_MULTIPLIER,
  INITIAL_BUDGET,
  OPPONENTS,
  WIN_BONUS,
  getPlayer,
} from "@/data/roster";
import {
  getCurrentRound,
  getDb,
  setCurrentRound,
  type DbLineup,
} from "@/lib/db";
import type { RoundScore } from "@/lib/types";
import { validateLineup } from "@/lib/game";

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
        `SELECT u.id AS userId, u.display_name AS displayName, u.team_name AS teamName,
                COALESCE(rs.points, 0) AS points
         FROM users u
         LEFT JOIN round_scores rs ON rs.user_id = u.id AND rs.round = ?
         ORDER BY points DESC, u.team_name ASC`,
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
      `SELECT u.id AS userId, u.display_name AS displayName, u.team_name AS teamName,
              COALESCE(SUM(rs.points), 0) AS points
       FROM users u
       LEFT JOIN round_scores rs ON rs.user_id = u.id
       GROUP BY u.id
       ORDER BY points DESC, u.team_name ASC`,
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

export function ensureLineupRow(userId: string, round?: number) {
  const db = getDb();
  const r = round ?? getCurrentRound(db);
  const existing = db
    .prepare("SELECT * FROM lineups WHERE user_id = ? AND round = ?")
    .get(userId, r) as DbLineup | undefined;
  if (existing) return existing;

  db.prepare(
    `INSERT INTO lineups (user_id, round, player_ids, captain_id, confirmed, confirmed_at, budget)
     VALUES (?, ?, '[]', NULL, 0, NULL, ?)`,
  ).run(userId, r, INITIAL_BUDGET);

  return db
    .prepare("SELECT * FROM lineups WHERE user_id = ? AND round = ?")
    .get(userId, r) as DbLineup;
}

export function saveLineup(
  userId: string,
  playerIds: string[],
  captainId: string | null,
) {
  const db = getDb();
  const round = getCurrentRound(db);
  ensureLineupRow(userId, round);
  db.prepare(
    `UPDATE lineups
     SET player_ids = ?, captain_id = ?, confirmed = 0, confirmed_at = NULL
     WHERE user_id = ? AND round = ?`,
  ).run(JSON.stringify(playerIds), captainId, userId, round);
  return ensureLineupRow(userId, round);
}

export function confirmLineup(userId: string): { ok: true } | { error: string } {
  const db = getDb();
  const round = getCurrentRound(db);
  const row = ensureLineupRow(userId, round);
  const playerIds = JSON.parse(row.player_ids) as string[];
  const lineup = {
    playerIds,
    captainId: row.captain_id,
    confirmed: false,
    confirmedAt: null,
  };
  const { ok, issues } = validateLineup(lineup, row.budget);
  if (!ok) {
    return {
      error:
        issues[0] === "captain"
          ? "Tria un capità abans de confirmar."
          : "L'alineació no compleix les normes (2/3/3 i pressupost).",
    };
  }
  db.prepare(
    `UPDATE lineups SET confirmed = 1, confirmed_at = ? WHERE user_id = ? AND round = ?`,
  ).run(new Date().toISOString(), userId, round);
  return { ok: true };
}

/** Close current jornada for all confirmed lineups; advance round. Admin-gated at API. */
export function simulateJornada(): {
  round: number;
  scored: number;
  nextRound: number;
  opponent: string;
} {
  const db = getDb();
  const round = getCurrentRound(db);
  const opponent = OPPONENTS[(round - 1) % OPPONENTS.length];

  const confirmed = db
    .prepare(
      `SELECT * FROM lineups WHERE round = ? AND confirmed = 1`,
    )
    .all(round) as DbLineup[];

  const tx = db.transaction(() => {
    for (const row of confirmed) {
      const playerIds = JSON.parse(row.player_ids) as string[];
      const seed =
        round * 997 +
        row.user_id
          .split("")
          .reduce((a, c) => a + c.charCodeAt(0), 0) +
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
        `INSERT INTO round_scores (user_id, round, points, opponent, won, scores_json, captain_id, played_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, round) DO UPDATE SET
           points = excluded.points,
           opponent = excluded.opponent,
           won = excluded.won,
           scores_json = excluded.scores_json,
           captain_id = excluded.captain_id,
           played_at = excluded.played_at`,
      ).run(
        row.user_id,
        round,
        teamPoints,
        opponent,
        won ? 1 : 0,
        JSON.stringify(scores),
        row.captain_id,
        new Date().toISOString(),
      );
    }

    const next = round + 1;
    setCurrentRound(next, db);

    // Seed empty lineup rows for next round for all users
    const users = db.prepare("SELECT id FROM users").all() as { id: string }[];
    for (const u of users) {
      ensureLineupRow(u.id, next);
    }
  });

  tx();

  return {
    round,
    scored: confirmed.length,
    nextRound: round + 1,
    opponent,
  };
}
