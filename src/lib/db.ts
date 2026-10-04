import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_TEAMS_PER_USER = 5;
/** 2 = multi fantasy teams; 3 = weekly jornada rounds meta; 4 = transfer canvis; 5 = cash ledger; 6 = transfer_phase. */
export const SCHEMA_VERSION = "6";

export type TransferPhase = "initial" | "normal";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  team_name: string;
  is_admin: number;
  created_at: string;
  active_team_id: string | null;
};

export type DbFantasyTeam = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  /** `initial` = unlimited canvis until first tip-off lock; then `normal` (max 3). */
  transfer_phase: TransferPhase;
};

export type DbLineup = {
  team_id: string;
  round: number;
  player_ids: string;
  captain_id: string | null;
  confirmed: number;
  confirmed_at: string | null;
  budget: number;
  snapshot_ids: string;
  changes_used: number;
};

export type DbRoundScore = {
  id: number;
  team_id: string;
  round: number;
  points: number;
  opponent: string;
  won: number;
  scores_json: string;
  captain_id: string | null;
  played_at: string;
};

export type DbMeta = {
  key: string;
  value: string;
};

const globalForDb = globalThis as unknown as { __smDb?: Database.Database };

function resolveDbPath() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "supermanager.db");
}

function tableColumns(db: Database.Database, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  ).map((c) => c.name);
}

function migrateToMultiTeams(db: Database.Database) {
  const current = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("schema_version") as DbMeta | undefined;
  if (current?.value === SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS fantasy_teams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      transfer_phase TEXT NOT NULL DEFAULT 'normal'
    );
  `);

  const userCols = tableColumns(db, "users");
  if (!userCols.includes("active_team_id")) {
    db.exec(`ALTER TABLE users ADD COLUMN active_team_id TEXT`);
  }

  const lineupCols = tableColumns(db, "lineups");
  const scoreCols = tableColumns(db, "round_scores");
  const lineupsNeedMigrate = lineupCols.includes("user_id");
  const scoresNeedMigrate = scoreCols.includes("user_id");

  const migrateTx = db.transaction(() => {
    const users = db
      .prepare(
        `SELECT id, display_name, team_name, active_team_id, created_at FROM users`,
      )
      .all() as {
      id: string;
      display_name: string;
      team_name: string;
      active_team_id: string | null;
      created_at: string;
    }[];

    const teamByUser = new Map<string, string>();

    for (const u of users) {
      const existing = db
        .prepare(
          `SELECT id FROM fantasy_teams WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
        )
        .get(u.id) as { id: string } | undefined;

      if (existing) {
        teamByUser.set(u.id, existing.id);
        if (!u.active_team_id) {
          db.prepare(`UPDATE users SET active_team_id = ? WHERE id = ?`).run(
            existing.id,
            u.id,
          );
        }
        continue;
      }

      const teamId = randomUUID();
      const name =
        (u.team_name && u.team_name.trim()) ||
        (u.display_name && u.display_name.trim()) ||
        "Equip 1";
      db.prepare(
        `INSERT INTO fantasy_teams (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`,
      ).run(teamId, u.id, name, u.created_at || new Date().toISOString());
      db.prepare(
        `UPDATE users SET active_team_id = ?, team_name = ? WHERE id = ?`,
      ).run(teamId, name, u.id);
      teamByUser.set(u.id, teamId);
    }

    if (lineupsNeedMigrate) {
      db.exec(`
        CREATE TABLE lineups_v2 (
          team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          player_ids TEXT NOT NULL,
          captain_id TEXT,
          confirmed INTEGER NOT NULL DEFAULT 0,
          confirmed_at TEXT,
          budget INTEGER NOT NULL,
          PRIMARY KEY (team_id, round)
        );
      `);

      const oldRows = db.prepare(`SELECT * FROM lineups`).all() as {
        user_id: string;
        round: number;
        player_ids: string;
        captain_id: string | null;
        confirmed: number;
        confirmed_at: string | null;
        budget: number;
      }[];

      const insert = db.prepare(
        `INSERT OR IGNORE INTO lineups_v2
         (team_id, round, player_ids, captain_id, confirmed, confirmed_at, budget)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const row of oldRows) {
        const teamId = teamByUser.get(row.user_id);
        if (!teamId) continue;
        insert.run(
          teamId,
          row.round,
          row.player_ids,
          row.captain_id,
          row.confirmed,
          row.confirmed_at,
          row.budget,
        );
      }

      db.exec(`DROP TABLE lineups; ALTER TABLE lineups_v2 RENAME TO lineups;`);
    } else if (!lineupCols.includes("team_id")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lineups (
          team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          player_ids TEXT NOT NULL,
          captain_id TEXT,
          confirmed INTEGER NOT NULL DEFAULT 0,
          confirmed_at TEXT,
          budget INTEGER NOT NULL,
          PRIMARY KEY (team_id, round)
        );
      `);
    }

    if (scoresNeedMigrate) {
      db.exec(`
        CREATE TABLE round_scores_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          points INTEGER NOT NULL,
          opponent TEXT NOT NULL,
          won INTEGER NOT NULL DEFAULT 0,
          scores_json TEXT NOT NULL,
          captain_id TEXT,
          played_at TEXT NOT NULL,
          UNIQUE(team_id, round)
        );
      `);

      const oldScores = db.prepare(`SELECT * FROM round_scores`).all() as {
        user_id: string;
        round: number;
        points: number;
        opponent: string;
        won: number;
        scores_json: string;
        captain_id: string | null;
        played_at: string;
      }[];

      const insertScore = db.prepare(
        `INSERT OR IGNORE INTO round_scores_v2
         (team_id, round, points, opponent, won, scores_json, captain_id, played_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const row of oldScores) {
        const teamId = teamByUser.get(row.user_id);
        if (!teamId) continue;
        insertScore.run(
          teamId,
          row.round,
          row.points,
          row.opponent,
          row.won,
          row.scores_json,
          row.captain_id,
          row.played_at,
        );
      }

      db.exec(
        `DROP TABLE round_scores; ALTER TABLE round_scores_v2 RENAME TO round_scores;`,
      );
    } else if (!scoreCols.includes("team_id")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS round_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          points INTEGER NOT NULL,
          opponent TEXT NOT NULL,
          won INTEGER NOT NULL DEFAULT 0,
          scores_json TEXT NOT NULL,
          captain_id TEXT,
          played_at TEXT NOT NULL,
          UNIQUE(team_id, round)
        );
      `);
    }

    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run("schema_version", SCHEMA_VERSION);
  });

  migrateTx();
}

export function getDb(): Database.Database {
  if (globalForDb.__smDb) return globalForDb.__smDb;

  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      active_team_id TEXT
    );

    CREATE TABLE IF NOT EXISTS fantasy_teams (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      transfer_phase TEXT NOT NULL DEFAULT 'normal'
    );

    CREATE TABLE IF NOT EXISTS lineups (
      team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      player_ids TEXT NOT NULL,
      captain_id TEXT,
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_at TEXT,
      budget INTEGER NOT NULL,
      snapshot_ids TEXT NOT NULL DEFAULT '[]',
      changes_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (team_id, round)
    );

    CREATE TABLE IF NOT EXISTS round_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      points INTEGER NOT NULL,
      opponent TEXT NOT NULL,
      won INTEGER NOT NULL DEFAULT 0,
      scores_json TEXT NOT NULL,
      captain_id TEXT,
      played_at TEXT NOT NULL,
      UNIQUE(team_id, round)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT,
      scored_at TEXT
    );

    -- Singleton (id = 1): ideal lineup locked by the Sunday 23:59 Madrid job.
    CREATE TABLE IF NOT EXISTS ideal_lineup (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      round INTEGER NOT NULL,
      player_ids TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- One row per kind+jornada. outcome sent | skipped | pending.
    -- Stops a later run from notifying a jornada that already started or finished.
    CREATE TABLE IF NOT EXISTS push_dispatch (
      kind TEXT NOT NULL,
      round INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (kind, round)
    );
  `);

  const current = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("current_round") as DbMeta | undefined;
  if (!current) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "current_round",
      "1",
    );
  }

  const status = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("round_status") as DbMeta | undefined;
  if (!status) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "round_status",
      "open",
    );
  }

  migrateToMultiTeams(db);
  migrateWeeklyRounds(db);
  migrateTransferWindow(db);
  migrateTransferPhase(db);
  // Cash ledger conversion runs from scoring.ensureLineupRow (needs roster prices).

  globalForDb.__smDb = db;
  return db;
}

/**
 * transfer_phase: new teams start as `initial` (unlimited canvis until tip-off).
 * Existing teams are backfilled as `normal` so the 3-cap already applies.
 */
function migrateTransferPhase(db: Database.Database) {
  const cols = tableColumns(db, "fantasy_teams");
  if (!cols.includes("transfer_phase")) {
    db.exec(
      `ALTER TABLE fantasy_teams ADD COLUMN transfer_phase TEXT NOT NULL DEFAULT 'normal'`,
    );
  }
  db.prepare(
    `UPDATE fantasy_teams SET transfer_phase = 'normal'
     WHERE transfer_phase IS NULL OR transfer_phase = ''`,
  ).run();
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run("schema_version", SCHEMA_VERSION);
}

function migrateTransferWindow(db: Database.Database) {
  const cols = tableColumns(db, "lineups");
  if (!cols.includes("snapshot_ids")) {
    db.exec(`ALTER TABLE lineups ADD COLUMN snapshot_ids TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!cols.includes("changes_used")) {
    db.exec(
      `ALTER TABLE lineups ADD COLUMN changes_used INTEGER NOT NULL DEFAULT 0`,
    );
  }

  const rows = db
    .prepare(
      `SELECT team_id, round, player_ids, snapshot_ids FROM lineups
       WHERE snapshot_ids IS NULL OR snapshot_ids = '' OR snapshot_ids = '[]'`,
    )
    .all() as {
    team_id: string;
    round: number;
    player_ids: string;
    snapshot_ids: string;
  }[];

  const upd = db.prepare(
    `UPDATE lineups SET snapshot_ids = ?, changes_used = 0
     WHERE team_id = ? AND round = ?`,
  );
  for (const row of rows) {
    let ids: unknown;
    try {
      ids = JSON.parse(row.player_ids);
    } catch {
      ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) continue;
    const snapEmpty =
      !row.snapshot_ids ||
      row.snapshot_ids === "[]" ||
      row.snapshot_ids.trim() === "";
    if (!snapEmpty) continue;
    upd.run(JSON.stringify(ids), row.team_id, row.round);
  }

  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run("schema_version", SCHEMA_VERSION);
}

function migrateWeeklyRounds(db: Database.Database) {
  const current = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("schema_version") as DbMeta | undefined;
  if (current?.value === SCHEMA_VERSION) {
    // Still ensure jornada 1 row exists on warm restarts.
    const round = Number(
      (
        db
          .prepare("SELECT value FROM meta WHERE key = ?")
          .get("current_round") as DbMeta | undefined
      )?.value ?? 1,
    );
    const row = db
      .prepare("SELECT id FROM rounds WHERE id = ?")
      .get(round) as { id: number } | undefined;
    if (!row) {
      db.prepare(
        `INSERT INTO rounds (id, label, status, opened_at, scored_at)
         VALUES (?, ?, 'open', ?, NULL)`,
      ).run(round, `Jornada ${round}`, new Date().toISOString());
    }
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT,
      scored_at TEXT
    );
  `);

  const statusRow = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("round_status") as DbMeta | undefined;
  if (!statusRow) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "round_status",
      "open",
    );
  }

  const round = Number(
    (
      db
        .prepare("SELECT value FROM meta WHERE key = ?")
        .get("current_round") as DbMeta | undefined
    )?.value ?? 1,
  );
  const existing = db
    .prepare("SELECT id FROM rounds WHERE id = ?")
    .get(round) as { id: number } | undefined;
  if (!existing) {
    db.prepare(
      `INSERT INTO rounds (id, label, status, opened_at, scored_at)
       VALUES (?, ?, 'open', ?, NULL)`,
    ).run(round, `Jornada ${round}`, new Date().toISOString());
  }

  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run("schema_version", SCHEMA_VERSION);
}

export function getCurrentRound(db = getDb()): number {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("current_round") as DbMeta | undefined;
  return Number(row?.value ?? 1);
}

export function setCurrentRound(round: number, db = getDb()) {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run("current_round", String(round));
}
