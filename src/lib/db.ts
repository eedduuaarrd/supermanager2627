import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  team_name: string;
  is_admin: number;
  created_at: string;
};

export type DbLineup = {
  user_id: string;
  round: number;
  player_ids: string;
  captain_id: string | null;
  confirmed: number;
  confirmed_at: string | null;
  budget: number;
};

export type DbRoundScore = {
  id: number;
  user_id: string;
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lineups (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      player_ids TEXT NOT NULL,
      captain_id TEXT,
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_at TEXT,
      budget INTEGER NOT NULL,
      PRIMARY KEY (user_id, round)
    );

    CREATE TABLE IF NOT EXISTS round_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      points INTEGER NOT NULL,
      opponent TEXT NOT NULL,
      won INTEGER NOT NULL DEFAULT 0,
      scores_json TEXT NOT NULL,
      captain_id TEXT,
      played_at TEXT NOT NULL,
      UNIQUE(user_id, round)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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

  globalForDb.__smDb = db;
  return db;
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
