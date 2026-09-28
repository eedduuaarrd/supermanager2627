import { randomUUID } from "node:crypto";
import {
  getCurrentRound,
  getDb,
  MAX_TEAMS_PER_USER,
  type DbFantasyTeam,
  type DbUser,
} from "@/lib/db";
import { INITIAL_BUDGET } from "@/data/roster";

export type FantasyTeamSummary = {
  id: string;
  name: string;
  createdAt: string;
};

export function listTeams(userId: string): FantasyTeamSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, created_at FROM fantasy_teams
       WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .all(userId) as { id: string; name: string; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
  }));
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
      `INSERT INTO fantasy_teams (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`,
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
    team: { id, name: trimmed, createdAt: created_at },
  };
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
    team: { id: team.id, name: team.name, createdAt: team.created_at },
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
    team: { id: teamId, name: trimmed, createdAt: team.created_at },
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
