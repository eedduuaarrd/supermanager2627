#!/usr/bin/env node
/**
 * Weekend sync for Supermanager Balaguer (Sat/Sun 23:59 Europe/Madrid).
 *
 * 1) Refresh plantilla stats → player-stats.json (upsert newcomers, recompute VAL)
 * 2) Refresh fixtures.json from msstats (best-effort; needs FCBQ_COOKIE for live)
 * 3) Tag this week's fixtures with current fantasy jornada
 * 4) Assign untagged game rows → current round; score + open next via ADMIN API
 * 5) Recompute lineup_lock_at from fixtures tip-offs (null if none published)
 *
 * Usage (VPS, app running):
 *   ADMIN_TOKEN=… APP_URL=http://127.0.0.1:4317 node scripts/weekend-sync.mjs
 *
 * Flags:
 *   --from path          roster snapshot (default src/data/fcbq-rosters.json)
 *   --from-api path      msstats dump for fixtures
 *   --skip-refresh       skip plantilla refresh
 *   --skip-fixtures      skip fixtures fetch
 *   --skip-score         refresh+lock only
 *   --dry-run            print plan
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  buildFixturesFile,
  tagJornadaWeek,
  CLUB_TEAMS,
} from "./fetch-fcbq-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const STATS = join(root, "src/data/player-stats.json");
const FIXTURES = join(root, "src/data/fixtures.json");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const fromApiIdx = args.indexOf("--from-api");
const fromPath =
  fromIdx >= 0 ? args[fromIdx + 1] : join(root, "src/data/fcbq-rosters.json");
const skipRefresh = args.includes("--skip-refresh");
const skipFixtures = args.includes("--skip-fixtures");
const skipScore = args.includes("--skip-score");
const dryRun = args.includes("--dry-run");

const APP_URL = (process.env.APP_URL || "http://127.0.0.1:4317").replace(
  /\/$/,
  "",
);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const LOG =
  process.env.WEEKEND_SYNC_LOG ||
  "/var/log/supermanager-weekend-sync.log";

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  try {
    appendFileSync(LOG, msg + "\n");
  } catch {
    // journald / local run without log file is fine
  }
}

function resolveDataDir() {
  return process.env.DATA_DIR || join(root, "data");
}

function openDb() {
  const Database = require("better-sqlite3");
  const db = new Database(join(resolveDataDir(), "supermanager.db"));
  db.pragma("journal_mode = WAL");
  return db;
}

function currentRound() {
  try {
    const db = openDb();
    const row = db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get("current_round");
    db.close();
    return Number(row?.value ?? 1);
  } catch {
    return 1;
  }
}

function runNode(script, scriptArgs = []) {
  const r = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`${script} exited ${r.status}`);
  }
}

function assignUntaggedGames(round) {
  const data = JSON.parse(readFileSync(STATS, "utf8"));
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
  writeFileSync(STATS, JSON.stringify(data, null, 2) + "\n");
  return assigned;
}

function refreshFixtures(round) {
  const fetchArgs = [];
  if (fromApiIdx >= 0) {
    fetchArgs.push("--from-api", args[fromApiIdx + 1]);
  } else if (process.env.FCBQ_COOKIE || args.includes("--live")) {
    fetchArgs.push("--live");
  }
  try {
    runNode("scripts/fetch-fcbq-fixtures.mjs", fetchArgs);
  } catch (err) {
    log(`fixtures fetch warning: ${err.message} — keeping existing file`);
  }
  if (!existsSync(FIXTURES)) {
    const empty = buildFixturesFile({
      existing: { teams: [] },
      payloadsByTeam: {},
      gaps: ["fixtures.json missing before sync"],
    });
    writeFileSync(FIXTURES, JSON.stringify(empty, null, 2) + "\n");
  }
  const file = JSON.parse(readFileSync(FIXTURES, "utf8"));
  // Ensure all 4 club teams exist even if API empty
  const have = new Set((file.teams ?? []).map((t) => t.fcbqTeamId));
  for (const t of CLUB_TEAMS) {
    if (!have.has(t.fcbqTeamId)) {
      file.teams.push({ ...t, fixtures: [] });
    }
  }
  const week = tagJornadaWeek(file, round);
  writeFileSync(FIXTURES, JSON.stringify(file, null, 2) + "\n");
  log(`fixtures tagged jornada ${round} for Madrid week ${week.from}→${week.to}`);
  return file;
}

function computeLockAt(file, round) {
  let min = null;
  for (const team of file.teams ?? []) {
    for (const f of team.fixtures ?? []) {
      if (f.jornada !== round) continue;
      if (typeof f.tipOff !== "string" || !f.tipOff.trim()) continue;
      const ms = Date.parse(f.tipOff);
      if (!Number.isFinite(ms)) continue;
      if (min == null || ms < min) min = ms;
    }
  }
  return min == null ? null : new Date(min).toISOString();
}

async function postAdmin(action, extra = {}) {
  const res = await fetch(`${APP_URL}/api/admin/weekly`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {}),
    },
    body: JSON.stringify({ token: ADMIN_TOKEN, action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function main() {
  log("weekend-sync start");
  const round = currentRound();
  log(`current fantasy jornada=${round}`);

  if (!skipRefresh) {
    if (!existsSync(fromPath)) {
      throw new Error(`Missing roster snapshot: ${fromPath}`);
    }
    log(`refresh-fcbq-stats --from ${fromPath}`);
    if (!dryRun) {
      runNode("scripts/refresh-fcbq-stats.mjs", ["--from", fromPath]);
    }
  }

  let fixturesFile = existsSync(FIXTURES)
    ? JSON.parse(readFileSync(FIXTURES, "utf8"))
    : { teams: [] };
  if (!skipFixtures) {
    fixturesFile = dryRun ? fixturesFile : refreshFixtures(round);
  }

  const lockAt = computeLockAt(fixturesFile, round);
  log(
    lockAt
      ? `lineup_lock_at=${lockAt}`
      : "lineup_lock_at=null (no published tip-offs — lineup stays open)",
  );

  if (dryRun) {
    log("dry-run — skip assign/score/lock API");
    return;
  }

  if (!skipScore) {
    const assigned = assignUntaggedGames(round);
    log(`assigned ${assigned} untagged game row(s) to jornada ${round}`);
    if (!ADMIN_TOKEN) {
      log("WARN: no ADMIN_TOKEN — falling back to weekly-jornada local score");
      runNode("scripts/weekly-jornada.mjs", [
        "--skip-refresh",
        ...(fromIdx >= 0 ? ["--from", fromPath] : []),
      ]);
    } else {
      log(`POST ${APP_URL}/api/admin/weekly action=run`);
      const result = await postAdmin("run");
      log(`score OK ${JSON.stringify(result)}`);
    }
  }

  // After score+advance, lock applies to the NEW open jornada from remaining tip-offs.
  const nextRound = currentRound();
  if (!skipFixtures) {
    fixturesFile = JSON.parse(readFileSync(FIXTURES, "utf8"));
    tagJornadaWeek(fixturesFile, nextRound);
    writeFileSync(FIXTURES, JSON.stringify(fixturesFile, null, 2) + "\n");
  }
  const nextLock = computeLockAt(
    existsSync(FIXTURES)
      ? JSON.parse(readFileSync(FIXTURES, "utf8"))
      : fixturesFile,
    nextRound,
  );
  if (ADMIN_TOKEN) {
    const lockResult = await postAdmin("lock", { lockAt: nextLock });
    log(`lock OK ${JSON.stringify(lockResult)}`);
  } else {
    log(`skip API lock (no token); computed lockAt=${nextLock}`);
  }

  log("weekend-sync done");
}

main().catch((err) => {
  log(`FAIL ${err.stack || err.message || err}`);
  process.exit(1);
});
