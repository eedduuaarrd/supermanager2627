#!/usr/bin/env node
/**
 * Weekly jornada ops for Supermanager Balaguer.
 *
 * 1) Refresh FCBQ plantilla stats into player-stats.json (merge, no invented games)
 * 2) Assign untagged game rows (round/jornada null) → current fantasy round
 * 3) Close + score current jornada from those stats (Balaguer VAL; captain ×2; DNP = 0)
 * 4) Open next jornada
 *
 * Usage (on the VPS, app running):
 *   ADMIN_TOKEN=… APP_URL=http://127.0.0.1:4317 node scripts/weekly-jornada.mjs
 *
 * Flags:
 *   --from path     roster snapshot for refresh (default src/data/fcbq-rosters.json)
 *   --assign-only   only map null-round games to current_round (no API)
 *   --refresh-only  only refresh stats
 *   --skip-refresh  skip FCBQ refresh step
 *   --dry-run       print plan without scoring
 *
 * Scoring hits POST /api/admin/weekly { action: "run" } (or close/open).
 * Without ADMIN_TOKEN, falls back to SQLite scoring in-process (same formula).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { computeVal } from "./compute-val.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const STATS = join(root, "src/data/player-stats.json");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const fromPath =
  fromIdx >= 0 ? args[fromIdx + 1] : join(root, "src/data/fcbq-rosters.json");
const assignOnly = args.includes("--assign-only");
const refreshOnly = args.includes("--refresh-only");
const skipRefresh = args.includes("--skip-refresh");
const dryRun = args.includes("--dry-run");

const APP_URL = (process.env.APP_URL || "http://127.0.0.1:4317").replace(
  /\/$/,
  "",
);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

function resolveDataDir() {
  return process.env.DATA_DIR || join(root, "data");
}

function loadStats() {
  return JSON.parse(readFileSync(STATS, "utf8"));
}

function saveStats(data) {
  writeFileSync(STATS, JSON.stringify(data, null, 2) + "\n");
}

function openDb() {
  const Database = require("better-sqlite3");
  const dir = resolveDataDir();
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, "supermanager.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const cur = db.prepare("SELECT value FROM meta WHERE key = ?").get("current_round");
  if (!cur) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "current_round",
      "1",
    );
  }
  const st = db.prepare("SELECT value FROM meta WHERE key = ?").get("round_status");
  if (!st) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "round_status",
      "open",
    );
  }
  return db;
}

function getMeta(db, key, fallback) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

function setMeta(db, key, value) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

function currentRound(db) {
  return Number(getMeta(db, "current_round", "1"));
}

/** Assign games with null round/jornada to a fantasy round (real rows only). */
function assignUntaggedGames(round) {
  const data = loadStats();
  let assigned = 0;
  for (const rec of Object.values(data.players ?? {})) {
    for (const g of rec.games ?? []) {
      const has =
        typeof g.round === "number" || typeof g.jornada === "number";
      if (has) continue;
      g.round = round;
      g.jornada = round;
      assigned += 1;
    }
  }
  saveStats(data);
  return assigned;
}

function fantasyPoints(game) {
  if (!game) return { points: 0, source: "DNP", minutes: 0 };
  const minutes = typeof game.min === "number" ? game.min : 0;
  const points = computeVal({
    pts: game.pts,
    pf: game.pf,
    ftm: game.tlc,
    fta: game.tli,
    pm: game.pm,
  });
  if (points == null) return { points: 0, source: "DNP", minutes };
  return { points, source: "VAL", minutes };
}

function gameForRound(stats, playerId, round) {
  const games = stats.players?.[playerId]?.games ?? [];
  return (
    games.find(
      (g) => g.round === round || g.jornada === round,
    ) ?? null
  );
}

function parsePlayerIds(raw) {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    if (v.every((x) => typeof x === "string")) return v;
    return [];
  } catch {
    return [];
  }
}

/** In-process close+advance when API is unavailable — keep formula in sync with src/lib. */
function scoreLocally() {
  const db = openDb();
  const stats = loadStats();
  const round = currentRound(db);
  const lineups = db
    .prepare("SELECT * FROM lineups WHERE round = ?")
    .all(round);
  const closedAt = new Date().toISOString();
  const CAPTAIN_X = 2;

  const tx = db.transaction(() => {
    for (const row of lineups) {
      const ids = parsePlayerIds(row.player_ids);
      const scores = ids.map((playerId) => {
        const game = gameForRound(stats, playerId, round);
        const { points: base, source, minutes } = fantasyPoints(game);
        const points =
          playerId === row.captain_id ? base * CAPTAIN_X : base;
        return {
          playerId,
          points,
          minutes: Math.round(minutes),
          winBonus: false,
          ...(source === "DNP"
            ? { dnp: true, note: "No ha jugat aquesta jornada (0)" }
            : { statSource: source }),
        };
      });
      const teamPoints = scores.reduce((s, x) => s + x.points, 0);
      db.prepare(
        `INSERT INTO round_scores (team_id, round, points, opponent, won, scores_json, captain_id, played_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT(team_id, round) DO UPDATE SET
           points = excluded.points,
           opponent = excluded.opponent,
           scores_json = excluded.scores_json,
           captain_id = excluded.captain_id,
           played_at = excluded.played_at`,
      ).run(
        row.team_id,
        round,
        teamPoints,
        `FCBQ J${round}`,
        JSON.stringify(scores),
        row.captain_id,
        closedAt,
      );
      db.prepare(
        `UPDATE lineups SET confirmed = 1, confirmed_at = ? WHERE team_id = ? AND round = ?`,
      ).run(closedAt, row.team_id, round);
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
    db.prepare(
      `INSERT INTO rounds (id, label, status, opened_at, scored_at)
       VALUES (?, ?, 'closed', ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'closed', scored_at = excluded.scored_at`,
    ).run(round, `Jornada ${round}`, closedAt, closedAt);
    setMeta(db, "round_status", "closed");

    const next = round + 1;
    setMeta(db, "current_round", String(next));
    setMeta(db, "round_status", "open");
    db.prepare(
      `INSERT INTO rounds (id, label, status, opened_at, scored_at)
       VALUES (?, ?, 'open', ?, NULL)
       ON CONFLICT(id) DO UPDATE SET status = 'open', opened_at = excluded.opened_at, scored_at = NULL`,
    ).run(next, `Jornada ${next}`, closedAt);

    const teams = db.prepare("SELECT id FROM fantasy_teams").all();
    for (const t of teams) {
      const exists = db
        .prepare("SELECT 1 FROM lineups WHERE team_id = ? AND round = ?")
        .get(t.id, next);
      if (!exists) {
        db.prepare(
          `INSERT INTO lineups (team_id, round, player_ids, captain_id, confirmed, confirmed_at, budget)
           VALUES (?, ?, '[]', NULL, 0, NULL, 100000)`,
        ).run(t.id, next);
      }
    }
  });

  tx();
  db.close();
  return { round, scored: lineups.length, nextRound: round + 1 };
}

async function scoreViaApi() {
  const res = await fetch(`${APP_URL}/api/admin/weekly`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {}),
    },
    body: JSON.stringify({ token: ADMIN_TOKEN, action: "run" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function refresh() {
  console.log("→ refresh-fcbq-stats.mjs");
  const r = spawnSync(
    process.execPath,
    [join(root, "scripts/refresh-fcbq-stats.mjs"), "--from", fromPath],
    { stdio: "inherit", cwd: root },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  if (!skipRefresh && !assignOnly) {
    if (!existsSync(fromPath)) {
      console.error("Missing roster snapshot:", fromPath);
      process.exit(1);
    }
    refresh();
  }
  if (refreshOnly) return;

  const db = openDb();
  const round = currentRound(db);
  db.close();

  const assigned = assignUntaggedGames(round);
  console.log(
    `→ assigned ${assigned} untagged game row(s) to jornada ${round}`,
  );

  if (assignOnly || dryRun) {
    console.log(dryRun ? "Dry run — skip score." : "Assign-only done.");
    return;
  }

  try {
    if (ADMIN_TOKEN) {
      console.log(`→ POST ${APP_URL}/api/admin/weekly action=run`);
      const result = await scoreViaApi();
      console.log("OK", result);
    } else {
      console.log("→ local SQLite score (no ADMIN_TOKEN)");
      const result = scoreLocally();
      console.log("OK", result);
      console.log(
        "Note: Next.js may still hold an old DB handle — restart the app after local score.",
      );
    }
  } catch (err) {
    console.warn("API score failed, falling back to local:", err.message);
    const result = scoreLocally();
    console.log("OK (local)", result);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
