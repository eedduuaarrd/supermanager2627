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
import {
  fantasyStatFromGame,
  getPlayerGameForRound,
} from "@/lib/player-stats";
import { markRoundScored, openRound, getRoundStatus } from "@/lib/rounds";
import type { RoundScore } from "@/lib/types";
import { parsePlayerIds, validateLineupSave } from "@/lib/game";
import { requireActiveTeamId } from "@/lib/teams";

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
  if (getRoundStatus(db) === "closed") {
    return {
      ok: false,
      error: "La jornada està tancada. L'alineació ja no es pot modificar.",
    };
  }
  const existing = ensureLineupRow(teamId, round);
  if (existing.confirmed) {
    return {
      ok: false,
      error: "L'alineació d'aquesta jornada està bloquejada.",
    };
  }
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
        : { statSource: source }),
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
    }
  });
  tx();
  return { round: next, roundStatus: "open" };
}

/**
 * @deprecated name kept for admin button — scores from FCBQ, not random sim.
 */
export function simulateJornada() {
  return closeJornada({ advance: true });
}
