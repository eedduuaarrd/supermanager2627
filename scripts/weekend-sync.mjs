#!/usr/bin/env node
/**
 * Weekend sync for Supermanager Balaguer (Sat/Sun 23:59 Europe/Madrid).
 *
 * A fantasy jornada is one Madrid club week (Mon–Sun), not a single day.
 * Both timer runs are safe: Saturday does not close while a Sunday fixture
 * is still ahead, and a second run the same week cannot advance an empty jornada.
 *
 * 1) Ingest per-game box scores (msstats via Chrome). Plantilla PJ>1 averages
 *    are not box scores. Sunday 23:59 still scores the open jornada from the
 *    real rows already in player-stats.json and opens the next one when ingest
 *    fails or a tracked club side has no box (those players stay DNP).
 *    Saturday does not close while a later game in the week is still ahead.
 * 2) Refresh fixtures.json from FCBQ calendars via Chrome CDP (no Edu cookie);
 *    optional FCBQ_COOKIE / --from-api still supported as fallbacks.
 *    The browser fetch gives up after CALENDAR_FETCH_TIMEOUT_MS (and sooner
 *    on "Verificació de seguretat"). Sunday still scores from the file on
 *    disk. Saturday does not advance when that refresh fails.
 * 3) Tag this week's fixtures with the current fantasy jornada
 * 4) Assign this week's untagged game rows; score + open next via ADMIN API
 *    only when the guard allows it
 *    (opening next jornada resets transfer snapshots + canvis counters)
 * 5) Tick broker prices from real stored games (anti-retick if the scored-game
 *    count did not grow). Sunday does this even when ingest failed, so one
 *    missing box does not freeze everyone else. Saturday still waits for ingest.
 * 6) Recompute lineup_lock_at from fixtures tip-offs (null if none published)
 *    Transfer window: Sun 23:59 Madrid → first tip-off; max 3 canvis per team
 * 7) Sunday only: persist the ideal lineup for the jornada this run locks in
 *    (2 bases, 3 alers, 3 pivots). A short line is stored as the players who
 *    scored and replaces the previous team. Saturday does not move it.
 *    No real scores keep the previous stored team.
 *
 * Usage (VPS, app running):
 *   ADMIN_TOKEN=… APP_URL=http://127.0.0.1:4317 node scripts/weekend-sync.mjs
 *
 * Flags:
 *   --from path          unused by the timer (live box scores). Kept so manual
 *                        flags from weekly-jornada do not crash this script.
 *   --from-api path      msstats dump for fixtures
 *   --skip-refresh       skip live box-score ingest (does not score unless
 *                        you also accept stale stats — the timer never sets this)
 *   --skip-fixtures      skip fixtures fetch
 *   --skip-score         refresh+lock only
 *   --skip-prices        skip market price tick
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
  CALENDAR_FETCH_TIMEOUT_MS,
} from "./fetch-fcbq-fixtures.mjs";
import {
  applyAssignments,
  decideWeekendAdvance,
  idealRoundToLock,
  isMadridSunday,
  shouldUpdateMarketPrices,
  weekendSyncShouldFail,
} from "./fcbq-weekend-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const STATS = join(root, "src/data/player-stats.json");
const FIXTURES = join(root, "src/data/fixtures.json");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const fromApiIdx = args.indexOf("--from-api");
const skipRefresh = args.includes("--skip-refresh");
const skipFixtures = args.includes("--skip-fixtures");
const skipScore = args.includes("--skip-score");
const skipPrices = args.includes("--skip-prices");
const dryRun = args.includes("--dry-run");

const APP_URL = (process.env.APP_URL || "http://127.0.0.1:4317").replace(
  /\/$/,
  "",
);
/** Box ingest already throws when the JWT is missing. This caps a hung Chrome. */
const BOX_INGEST_TIMEOUT_MS = 180_000;
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

const SCORED_WEEK_KEY = "weekend_scored_week";

function withDb(fn, fallback) {
  try {
    const db = openDb();
    try {
      return fn(db);
    } finally {
      db.close();
    }
  } catch {
    return fallback;
  }
}

function currentRound() {
  return withDb((db) => {
    const row = db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get("current_round");
    return Number(row?.value ?? 1);
  }, 1);
}

function scoredWeekKey() {
  return withDb((db) => {
    const row = db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(SCORED_WEEK_KEY);
    return row?.value ?? null;
  }, null);
}

function rememberScoredWeek(key) {
  const db = openDb();
  try {
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(SCORED_WEEK_KEY, key);
  } finally {
    db.close();
  }
}

function runNode(script, scriptArgs = [], extraEnv = {}, options = {}) {
  const timeoutMs = options.timeoutMs;
  const r = spawnSync(process.execPath, [join(root, script), ...scriptArgs], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...extraEnv },
    ...(timeoutMs ? { timeout: timeoutMs, killSignal: "SIGKILL" } : {}),
  });
  if (r.error) {
    if (r.error.code === "ETIMEDOUT") {
      throw new Error(`${script} timed out after ${timeoutMs}ms`);
    }
    throw new Error(`${script} failed: ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(
      `${script} exited ${r.status}${r.signal ? ` signal=${r.signal}` : ""}`,
    );
  }
}

function loadStats() {
  return JSON.parse(readFileSync(STATS, "utf8"));
}

function saveStats(data) {
  writeFileSync(STATS, JSON.stringify(data, null, 2) + "\n");
}

/** True only when this process just wrote a successful box-score ingest. */
function ingestIsFresh(startedMs) {
  try {
    const ingest = loadStats().ingest;
    if (!ingest?.ok) return false;
    const at = Date.parse(ingest.at);
    return Number.isFinite(at) && at >= startedMs - 5000;
  } catch {
    return false;
  }
}

/** Surface identity misses from this run's ingest in the weekend-sync log. */
function logUnmatchedPlayers(startedMs) {
  try {
    const ingest = loadStats().ingest;
    const at = Date.parse(ingest?.at ?? "");
    if (!Number.isFinite(at) || at < startedMs - 5000) return;
    const unmatched = Array.isArray(ingest.unmatched) ? ingest.unmatched : [];
    if (unmatched.length) {
      log(
        `!!! UNMATCHED FCBQ PLAYERS (${unmatched.length}) — no puntuaran fins que s'afegeixin a fcbq-identity/roster: ${unmatched.join(" | ")}`,
      );
    }
    const offRoster = Array.isArray(ingest.offRoster) ? ingest.offRoster : [];
    for (const o of offRoster) {
      log(`off-roster (ignored): ${o.name} ${o.games} game(s) for ${o.teamId}; roster ${o.playerId}=${(o.rosterTeamIds ?? []).join(",")}`);
    }
  } catch {
    // stats file unreadable: the ingest FAIL line above already says so
  }
}

function refreshFixtures(round) {
  const fetchArgs = [];
  let useBrowser = false;
  let ok = true;
  if (fromApiIdx >= 0) {
    fetchArgs.push("--from-api", args[fromApiIdx + 1]);
  } else if (args.includes("--from-calendar")) {
    const i = args.indexOf("--from-calendar");
    fetchArgs.push("--from-calendar", args[i + 1]);
  } else if (args.includes("--calendar") && process.env.FCBQ_COOKIE) {
    // Curl calendar with pasted cookie (legacy / emergency).
    fetchArgs.push("--calendar");
  } else if (args.includes("--live") && process.env.FCBQ_COOKIE) {
    fetchArgs.push("--live");
  } else if (!args.includes("--skip-browser")) {
    // Default: headless Chrome on the VPS scrapes calendars (reCAPTCHA v3).
    useBrowser = true;
  }
  const fetchTimeout = { timeoutMs: CALENDAR_FETCH_TIMEOUT_MS };
  try {
    if (useBrowser) {
      runNode("scripts/fetch-fcbq-fixtures-browser.mjs", [], {}, fetchTimeout);
    } else if (fetchArgs.length || process.env.FCBQ_COOKIE) {
      runNode("scripts/fetch-fcbq-fixtures.mjs", fetchArgs, {}, fetchTimeout);
    } else {
      ok = false;
      log("fixtures: no browser/cookie/api source — keeping existing fixtures");
    }
  } catch (err) {
    ok = false;
    log(
      `fixtures fetch FAIL: ${err.message} — keeping existing fixtures`,
    );
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
  return { file, ok };
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
  const startedMs = Date.now();
  log("weekend-sync start");
  const round = currentRound();
  log(`current fantasy jornada=${round}`);

  let ingestOk = false;
  if (dryRun) {
    log("dry-run — skip live box-score ingest");
  } else if (skipRefresh) {
    log("skip box-score ingest (--skip-refresh)");
  } else {
    log("fetch-fcbq-boxscores-browser");
    try {
      runNode(
        "scripts/fetch-fcbq-boxscores-browser.mjs",
        [],
        {},
        { timeoutMs: BOX_INGEST_TIMEOUT_MS },
      );
      ingestOk = ingestIsFresh(startedMs);
      if (!ingestOk) {
        log("stats ingest FAIL: box-score file is not a fresh ok ingest");
      }
    } catch (err) {
      ingestOk = false;
      log(`stats ingest FAIL: ${err.message}`);
    }
    logUnmatchedPlayers(startedMs);
  }

  let fixturesFile = existsSync(FIXTURES)
    ? JSON.parse(readFileSync(FIXTURES, "utf8"))
    : { teams: [] };
  let fixturesOk = skipFixtures;
  if (!skipFixtures && !dryRun) {
    const refreshed = refreshFixtures(round);
    fixturesFile = refreshed.file;
    fixturesOk = refreshed.ok;
  }

  const stats = existsSync(STATS) ? loadStats() : { players: {} };
  const decision = decideWeekendAdvance({
    round,
    fixturesFile,
    stats,
    now: new Date(),
    scoredWeekKey: scoredWeekKey(),
    ingestOk: dryRun ? true : ingestOk,
    fixturesOk: dryRun ? true : fixturesOk,
  });
  const missingNote = decision.missing?.length
    ? ` missing=${decision.missing.map((m) => `${m.teamId}@${m.date}`).join(",")}`
    : "";
  log(
    `score decision: ${decision.reason} advance=${decision.advance} week=${decision.week.from}→${decision.week.to}${missingNote}`,
  );

  const lockAt = computeLockAt(fixturesFile, round);
  log(
    lockAt
      ? `lineup_lock_at=${lockAt}`
      : "lineup_lock_at=null (no published tip-offs — lineup stays open)",
  );

  const sunday = isMadridSunday(new Date());
  if (dryRun) {
    const previewTarget = idealRoundToLock({
      isSunday: sunday,
      currentRound: round,
      advance: decision.advance,
      reason: decision.reason,
    });
    log(
      previewTarget == null
        ? "ideal team: unchanged (not a Sunday lock-in)"
        : `ideal team: would lock J${previewTarget}`,
    );
    log("dry-run — hypothetical decision from files on disk; no scrape, no score");
    return;
  }

  // JWT miss, a failed box ingest, or a calendar security/timeout must not
  // fail Sunday once this pass scores. They still fail the run when it does
  // not score (Saturday, or Sunday while a later game is still ahead).
  let hardFail = weekendSyncShouldFail({
    fixturesOk,
    ingestOk,
    advance: decision.advance,
    reason: decision.reason,
  });
  let scoreApplied = false;

  if (!skipScore && (ingestOk || decision.advance)) {
    const assigned = applyAssignments(stats, decision.assignments);
    if (assigned > 0) saveStats(stats);
    log(`assigned ${assigned} game row(s) (this club week / already-tagged fixtures only)`);
  }

  if (!skipScore && decision.advance) {
    if (!ADMIN_TOKEN) {
      hardFail = true;
      log("FAIL: no ADMIN_TOKEN — not scoring (refusing a blind local advance)");
    } else {
      try {
        log(`POST ${APP_URL}/api/admin/weekly action=run`);
        const result = await postAdmin("run");
        log(`score OK ${JSON.stringify(result)}`);
        scoreApplied = true;
        try {
          rememberScoredWeek(decision.week.key);
          log(`weekend_scored_week=${decision.week.key}`);
        } catch (err) {
          log(`WARN: could not store weekend_scored_week (${err.message})`);
        }
      } catch (err) {
        hardFail = true;
        log(`score FAIL: ${err.message} — did not advance`);
      }
    }
  } else if (!skipScore) {
    log(`skip score/advance: ${decision.reason}`);
  }

  // Sunday 23:59 Madrid: store the ideal team for the jornada just locked in.
  // A failed score this run must not pretend the open jornada is finished.
  const idealTarget = idealRoundToLock({
    isSunday: sunday,
    currentRound: round,
    advance: scoreApplied,
    reason: decision.reason,
  });
  if (!sunday) {
    log("ideal team: skip (not Sunday Europe/Madrid)");
  } else if (idealTarget == null) {
    log("ideal team: unchanged (jornada not ready — keeping last stored lineup)");
  } else if (!ADMIN_TOKEN) {
    log(`ideal team: skip J${idealTarget} (no ADMIN_TOKEN)`);
  } else {
    try {
      log(`POST ${APP_URL}/api/admin/weekly action=ideal round=${idealTarget}`);
      const ideal = await postAdmin("ideal", { round: idealTarget });
      if (ideal.stored) {
        log(`ideal team J${idealTarget} stored`);
        if (ideal.push) log(`ideal push ${JSON.stringify(ideal.push)}`);
      } else {
        log(
          `ideal team unchanged: ${ideal.reason} for J${idealTarget} (keeping J${ideal.keptRound ?? "none"})`,
        );
      }
    } catch (err) {
      hardFail = true;
      log(`ideal team FAIL: ${err.message}`);
    }
  }

  // Prices come from games already in player-stats.json. Sunday ticks even
  // when ingest failed. The script skips anyone whose scored-game count
  // did not grow. Writes market-prices.json; the app reads it at runtime.
  if (
    shouldUpdateMarketPrices({
      skipPrices,
      ingestOk,
      isSunday: sunday,
    })
  ) {
    try {
      log(
        ingestOk
          ? "update-market-prices (normal tick, anti-retick)"
          : "update-market-prices (stored games, anti-retick)",
      );
      runNode("scripts/update-market-prices.mjs");
    } catch (err) {
      hardFail = true;
      log(`prices FAIL: ${err.message}`);
    }
  } else if (!skipPrices) {
    log("skip market prices (stats ingest did not succeed)");
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
    try {
      const lockResult = await postAdmin("lock", { lockAt: nextLock });
      log(`lock OK ${JSON.stringify(lockResult)}`);
    } catch (err) {
      hardFail = true;
      log(`lock FAIL: ${err.message}`);
    }
  } else {
    log(`skip API lock (no token); computed lockAt=${nextLock}`);
  }

  if (!skipScore && decision.reason === "missing-box-scores") {
    hardFail = true;
  }

  if (hardFail) {
    log("weekend-sync FAIL — score/advance was not applied");
    process.exit(1);
  }
  log("weekend-sync done");
}

main().catch((err) => {
  log(`FAIL ${err.stack || err.message || err}`);
  process.exit(1);
});
