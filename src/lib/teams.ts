import { randomUUID } from "node:crypto";
import {
  getCurrentRound,
  getDb,
  MAX_TEAMS_PER_USER,
  type DbFantasyTeam,
  type DbUser,
  type TransferPhase,
} from "@/lib/db";
import { INITIAL_BUDGET } from "@/data/roster";
import {
  computeLineupLockAt,
  isLineupLocked,
  loadFixtures,
} from "@/lib/fixtures";
import { getLineupLockAt } from "@/lib/rounds";

export type FantasyTeamSummary = {
  id: string;
  name: string;
  createdAt: string;
  transferPhase: TransferPhase;
};

function toSummary(row: {
  id: string;
  name: string;
  created_at: string;
  transfer_phase?: string | null;
}): FantasyTeamSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    transferPhase: row.transfer_phase === "initial" ? "initial" : "normal",
  };
}

export function listTeams(userId: string): FantasyTeamSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, created_at, transfer_phase FROM fantasy_teams
       WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .all(userId) as {
    id: string;
    name: string;
    created_at: string;
    transfer_phase: string | null;
  }[];
  return rows.map(toSummary);
}

export function getTeamForUser(
  userId: string,
  teamId: string,
): DbFantasyTeam | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM fantasy_teams WHERE id = ? AND user_id = ?`)
    .get(teamId, userId) as DbFantasyTeam | undefined;
}

export function getActiveTeam(userId: string): DbFantasyTeam | undefined {
  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as
    | DbUser
    | undefined;
  if (!user) return undefined;

  if (user.active_team_id) {
    const team = getTeamForUser(userId, user.active_team_id);
    if (team) return team;
  }

  const first = db
    .prepare(
      `SELECT * FROM fantasy_teams WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
    )
    .get(userId) as DbFantasyTeam | undefined;
  if (first) {
    db.prepare(`UPDATE users SET active_team_id = ?, team_name = ? WHERE id = ?`).run(
      first.id,
      first.name,
      userId,
    );
  }
  return first;
}

export function requireActiveTeamId(userId: string): string {
  const team = getActiveTeam(userId);
  if (!team) {
    throw new Error("No hi ha cap equip actiu.");
  }
  return team.id;
}

/**
 * Return active team id, creating a default fantasy team when the user
 * exists but has none (migration / purge edge cases).
 */
export function ensureActiveTeamId(
  userId: string,
  fallbackName = "Equip 1",
): string {
  const existing = getActiveTeam(userId);
  if (existing) return existing.id;

  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as
    | DbUser
    | undefined;
  if (!user) {
    throw new Error("No hi ha cap equip actiu.");
  }
  const name =
    (user.team_name && user.team_name.trim()) ||
    (user.display_name && user.display_name.trim()) ||
    fallbackName;
  const created = createTeamForUser(userId, name, { setActive: true });
  if (!created.ok) {
    throw new Error(created.error || "No hi ha cap equip actiu.");
  }
  return created.team.id;
}

export function createTeamForUser(
  userId: string,
  name: string,
  opts?: { setActive?: boolean; createdAt?: string },
): { ok: true; team: FantasyTeamSummary } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Cal un nom d'equip (mín. 2 caràcters)." };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: "El nom de l'equip és massa llarg." };
  }

  const db = getDb();
  const count = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM fantasy_teams WHERE user_id = ?`)
      .get(userId) as { c: number }
  ).c;
  if (count >= MAX_TEAMS_PER_USER) {
    return { ok: false, error: `Màxim ${MAX_TEAMS_PER_USER} equips.` };
  }

  const id = randomUUID();
  const created_at = opts?.createdAt ?? new Date().toISOString();
  const setActive = opts?.setActive !== false || count === 0;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO fantasy_teams (id, user_id, name, created_at, transfer_phase)
       VALUES (?, ?, ?, ?, 'initial')`,
    ).run(id, userId, trimmed, created_at);

    if (setActive) {
      db.prepare(
        `UPDATE users SET active_team_id = ?, team_name = ? WHERE id = ?`,
      ).run(id, trimmed, userId);
    }

    const round = getCurrentRound(db);
    db.prepare(
      `INSERT OR IGNORE INTO lineups
       (team_id, round, player_ids, captain_id, confirmed, confirmed_at, budget)
       VALUES (?, ?, '[]', NULL, 0, NULL, ?)`,
    ).run(id, round, INITIAL_BUDGET);
  });
  tx();

  return {
    ok: true,
    team: {
      id,
      name: trimmed,
      createdAt: created_at,
      transferPhase: "initial",
    },
  };
}

export function getTeamTransferPhase(
  teamId: string,
  db = getDb(),
): TransferPhase {
  const row = db
    .prepare(`SELECT transfer_phase FROM fantasy_teams WHERE id = ?`)
    .get(teamId) as { transfer_phase: string | null } | undefined;
  return row?.transfer_phase === "initial" ? "initial" : "normal";
}

/**
 * When tip-off lock is active, flip `initial` → `normal` only for teams that
 * already existed at that tip-off (`created_at <= lockAt`).
 *
 * Teams created mid-lock (or after tip-off) stay `initial` until the *next*
 * jornada tip-off — unlimited canvis once the window reopens.
 */
export function promoteInitialTeamsIfLocked(
  now = new Date(),
  db = getDb(),
): number {
  const lockAt = getLineupLockAt(db);
  if (!lockAt || !isLineupLocked(lockAt, now)) return 0;
  const cutoff = new Date(lockAt).toISOString();
  const result = db
    .prepare(
      `UPDATE fantasy_teams SET transfer_phase = 'normal'
       WHERE transfer_phase = 'initial'
         AND created_at <= ?`,
    )
    .run(cutoff);
  return Number(result.changes ?? 0);
}

/**
 * Repair teams wrongly stuck on `normal` before they experience tip-off.
 * While the current tip-off has not fired, restore `initial` for any team
 * created after the previous jornada's tip-off (empty snapshot / post-lock
 * creates, migration DEFAULT, premature promote).
 */
export function restoreInitialPhaseUntilNextTipOff(
  now = new Date(),
  db = getDb(),
): number {
  const lockAt = getLineupLockAt(db);
  if (isLineupLocked(lockAt, now)) return 0;

  const round = getCurrentRound(db);
  if (round <= 1) return 0;
  const prevLock = computeLineupLockAt(round - 1, loadFixtures());
  if (!prevLock) return 0;
  const cutoff = new Date(prevLock).toISOString();

  const result = db
    .prepare(
      `UPDATE fantasy_teams SET transfer_phase = 'initial'
       WHERE transfer_phase = 'normal'
         AND created_at > ?`,
    )
    .run(cutoff);
  return Number(result.changes ?? 0);
}

/** Force-promote all initial teams (admin / tests). Prefer scoped promote. */
export function promoteAllInitialTeams(db = getDb()): number {
  const result = db
    .prepare(
      `UPDATE fantasy_teams SET transfer_phase = 'normal'
       WHERE transfer_phase = 'initial'`,
    )
    .run();
  return Number(result.changes ?? 0);
}

export function setActiveTeam(
  userId: string,
  teamId: string,
): { ok: true; team: FantasyTeamSummary } | { ok: false; error: string } {
  const team = getTeamForUser(userId, teamId);
  if (!team) return { ok: false, error: "Equip no trobat." };

  const db = getDb();
  db.prepare(
    `UPDATE users SET active_team_id = ?, team_name = ? WHERE id = ?`,
  ).run(team.id, team.name, userId);

  return {
    ok: true,
    team: toSummary(team),
  };
}

export function renameTeam(
  userId: string,
  teamId: string,
  name: string,
): { ok: true; team: FantasyTeamSummary } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Cal un nom d'equip (mín. 2 caràcters)." };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: "El nom de l'equip és massa llarg." };
  }
  const team = getTeamForUser(userId, teamId);
  if (!team) return { ok: false, error: "Equip no trobat." };

  const db = getDb();
  db.prepare(`UPDATE fantasy_teams SET name = ? WHERE id = ?`).run(
    trimmed,
    teamId,
  );
  const user = db.prepare(`SELECT active_team_id FROM users WHERE id = ?`).get(
    userId,
  ) as { active_team_id: string | null };
  if (user?.active_team_id === teamId) {
    db.prepare(`UPDATE users SET team_name = ? WHERE id = ?`).run(
      trimmed,
      userId,
    );
  }

  return {
    ok: true,
    team: toSummary({ ...team, name: trimmed }),
  };
}

export function deleteTeam(
  userId: string,
  teamId: string,
): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const teams = listTeams(userId);
  if (teams.length <= 1) {
    return { ok: false, error: "Cal conservar almenys un equip." };
  }
  const team = getTeamForUser(userId, teamId);
  if (!team) return { ok: false, error: "Equip no trobat." };

  const user = db.prepare(`SELECT active_team_id FROM users WHERE id = ?`).get(
    userId,
  ) as { active_team_id: string | null };

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM fantasy_teams WHERE id = ?`).run(teamId);
    if (user?.active_team_id === teamId) {
      const next = db
        .prepare(
          `SELECT id, name FROM fantasy_teams WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
        )
        .get(userId) as { id: string; name: string };
      db.prepare(
        `UPDATE users SET active_team_id = ?, team_name = ? WHERE id = ?`,
      ).run(next.id, next.name, userId);
    }
  });
  tx();
  return { ok: true };
}
