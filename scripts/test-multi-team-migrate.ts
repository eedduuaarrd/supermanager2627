import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dir = "/tmp/sm-migrate-test";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
const dbpath = path.join(dir, "supermanager.db");
const db = new Database(dbpath);
db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL, team_name TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE lineups (
    user_id TEXT NOT NULL, round INTEGER NOT NULL, player_ids TEXT NOT NULL,
    captain_id TEXT, confirmed INTEGER NOT NULL DEFAULT 0, confirmed_at TEXT, budget INTEGER NOT NULL,
    PRIMARY KEY (user_id, round)
  );
  CREATE TABLE round_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, round INTEGER NOT NULL,
    points INTEGER NOT NULL, opponent TEXT NOT NULL, won INTEGER NOT NULL DEFAULT 0,
    scores_json TEXT NOT NULL, captain_id TEXT, played_at TEXT NOT NULL, UNIQUE(user_id, round)
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
db.prepare("INSERT INTO meta VALUES (?,?)").run("current_round", "1");
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(
  "u1",
  "a@b.com",
  "hash",
  "Manager",
  "Old Team",
  0,
  "2026-01-01",
);
db.prepare("INSERT INTO lineups VALUES (?,?,?,?,?,?,?)").run(
  "u1",
  1,
  JSON.stringify(["p1"]),
  null,
  0,
  null,
  100000,
);
db.prepare(
  "INSERT INTO round_scores (user_id,round,points,opponent,won,scores_json,captain_id,played_at) VALUES (?,?,?,?,?,?,?,?)",
).run("u1", 1, 42, "Rival", 1, "[]", null, "2026-01-02");
db.close();

process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const migrated = getDb();
  console.log(
    "schema_version",
    migrated.prepare("SELECT value FROM meta WHERE key=?").get("schema_version"),
  );
  console.log("teams", migrated.prepare("SELECT * FROM fantasy_teams").all());
  console.log(
    "users",
    migrated.prepare("SELECT id, team_name, active_team_id FROM users").all(),
  );
  console.log("lineups", migrated.prepare("SELECT * FROM lineups").all());
  console.log(
    "scores",
    migrated.prepare("SELECT team_id, round, points FROM round_scores").all(),
  );
  console.log(
    "lineup cols",
    (
      migrated.prepare("PRAGMA table_info(lineups)").all() as { name: string }[]
    ).map((c) => c.name),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
