#!/usr/bin/env node
/**
 * Ingest per-game FCBQ box scores into src/data/player-stats.json.
 *
 * Plantilla tables become season averages once PJ>1, so weekend scoring cannot
 * use them. This uses the same Chrome profile as the calendar scrape (reCAPTCHA
 * v3) to obtain the public web JWT, then reads msstats player game logs:
 *   /v1/fcbq/teams/{team}/stats
 *   /v1/fcbq/players/{person}/teams/{team}/stats
 *
 * Writes `ingest.ok` + `ingest.at` on the stats file. Weekend sync treats a
 * missing or stale ingest as fail-closed and does not score or advance.
 *
 * Usage:
 *   node scripts/fetch-fcbq-boxscores-browser.mjs
 *   FCBQ_STATS_OUT=/tmp/player-stats.json node scripts/fetch-fcbq-boxscores-browser.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import puppeteer from "puppeteer-core";
import { CLUB_TEAMS } from "./fetch-fcbq-fixtures.mjs";
import { coverageGaps, mergeTeamLogs } from "./fcbq-boxscores.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = process.env.FCBQ_STATS_OUT || join(root, "src/data/player-stats.json");
const MS = "https://msstats.optimalwayconsulting.com/v1/fcbq";

const args = process.argv.slice(2);
const keepChrome = args.includes("--keep-chrome");
const connectOnly = args.includes("--connect-only");
const PORT = process.env.FCBQ_CDP_PORT || "9335";
const PROFILE =
  process.env.FCBQ_CHROME_PROFILE || join(homedir(), ".cache/fcbq-chrome");
const chromeSh = join(__dirname, "fcbq-chrome.sh");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runChrome(cmd) {
  const r = spawnSync("bash", [chromeSh, cmd], {
    stdio: "inherit",
    env: {
      ...process.env,
      FCBQ_CDP_PORT: PORT,
      FCBQ_CHROME_PROFILE: PROFILE,
    },
  });
  if (r.status !== 0) {
    throw new Error(`fcbq-chrome.sh ${cmd} exited ${r.status}`);
  }
}

function loadExisting() {
  if (!existsSync(OUT)) return { players: {} };
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { players: {} };
  }
}

function writeStats(existing, extra) {
  const players = extra.players ?? existing.players ?? {};
  const out = {
    ...existing,
    extractedAt: new Date().toISOString().slice(0, 10),
    source: "msstats.optimalwayconsulting.com player game logs",
    players,
    ingest: {
      ok: false,
      source: "msstats-player-games",
      ...extra.ingest,
      at: new Date().toISOString(),
    },
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  return out;
}

async function warmUp(page) {
  try {
    await page.goto("https://www.basquetcatala.cat/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    for (let i = 0; i < 20; i++) {
      let st = { captcha: true, ready: false };
      try {
        st = await page.evaluate(() => {
          const title = document.title || "";
          const body = document.body?.innerText || "";
          return {
            captcha:
              /Verificaci/i.test(title) ||
              /CONFIRMA QUE ETS UNA PERSONA/i.test(body),
            ready: /Federaci/i.test(title) || /Bàsquet Català/i.test(title),
          };
        });
      } catch {
        st = { captcha: true, ready: false };
      }
      if (!st.captcha && st.ready) break;
      if (st.captcha) {
        for (const frame of page.frames()) {
          try {
            const box = await frame.$("#recaptcha-anchor");
            if (box) await box.click({ delay: 40 });
          } catch {
            /* ignore */
          }
        }
        try {
          await page.evaluate(() => window.fcbq?.recaptcha?.autoVerify?.());
        } catch {
          /* ignore */
        }
      }
      await sleep(1200);
    }
    await sleep(800);
  } catch (err) {
    console.warn("warm-up:", err.message);
  }
}

async function captureAuthorization(page) {
  let auth = null;
  const onRequest = (req) => {
    const url = req.url();
    if (!/msstats\.optimalwayconsulting\.com\/v1\/fcbq\//.test(url)) return;
    const header = req.headers().authorization;
    if (header && /^Bearer\s+\S+/.test(header)) auth = header;
  };
  page.on("request", onRequest);
  const team = CLUB_TEAMS[0];
  await page.goto(
    `https://www.basquetcatala.cat/estadistica/equip/${team.fcbqTeamId}`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  const start = Date.now();
  while (!auth && Date.now() - start < 45000) {
    let title = "";
    try {
      title = await page.title();
    } catch {
      title = "";
    }
    if (/Verificaci/i.test(title)) {
      for (const frame of page.frames()) {
        try {
          const box = await frame.$("#recaptcha-anchor");
          if (box) await box.click({ delay: 40 });
        } catch {
          /* ignore */
        }
      }
      try {
        await page.evaluate(() => window.fcbq?.recaptcha?.autoVerify?.());
      } catch {
        /* ignore */
      }
    }
    await sleep(500);
  }
  page.off("request", onRequest);
  if (!auth) throw new Error("No s'ha obtingut el JWT públic de msstats");
  return auth;
}

async function msGet(url, authorization) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      authorization,
      federation: "fcbq",
      referer: "https://www.basquetcatala.cat/",
      origin: "https://www.basquetcatala.cat",
      "accept-language": "ca",
    },
  });
  if (!res.ok) {
    throw new Error(`${url} HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchTeamLogs(authorization) {
  const teamLogs = [];
  const errors = [];
  for (const team of CLUB_TEAMS) {
    try {
      const body = await msGet(`${MS}/teams/${team.fcbqTeamId}/stats`, authorization);
      const roster = Array.isArray(body?.roster) ? body.roster : [];
      const players = [];
      for (const person of roster) {
        if (!person?.uuid || !person?.name) continue;
        await sleep(80);
        const log = await msGet(
          `${MS}/players/${person.uuid}/teams/${team.fcbqTeamId}/stats`,
          authorization,
        );
        players.push({
          uuid: person.uuid,
          name: person.name,
          gamesPlayed:
            typeof person.gamesPlayed === "number"
              ? person.gamesPlayed
              : Array.isArray(log?.games)
                ? log.games.length
                : 0,
          games: Array.isArray(log?.games) ? log.games : [],
        });
      }
      teamLogs.push({
        fcbqTeamId: team.fcbqTeamId,
        competition: body?.header?.categoryName ?? null,
        players,
      });
      console.log(`OK ${team.shortName}: ${players.length} jugadors`);
    } catch (err) {
      errors.push(`${team.shortName}: ${err.message}`);
      if (/HTTP 404/.test(err.message)) {
        console.warn("no season stats", team.shortName);
      } else {
        console.warn("FAIL", team.shortName, err.message);
      }
    }
  }
  return { teamLogs, errors };
}

async function withChrome(fn) {
  mkdirSync(PROFILE, { recursive: true });
  let startedHere = false;
  if (!connectOnly) {
    const probe = spawnSync(
      "curl",
      ["-fsS", "--max-time", "2", `http://127.0.0.1:${PORT}/json/version`],
      { encoding: "utf8" },
    );
    if (probe.status !== 0) {
      runChrome("start");
      startedHere = true;
    }
  }
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${PORT}`,
    defaultViewport: null,
    protocolTimeout: 180000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  try {
    return await fn(page);
  } finally {
    try {
      await page.close();
    } catch {
      /* ignore */
    }
    await browser.disconnect();
    if (startedHere && !keepChrome) {
      try {
        runChrome("stop");
      } catch (err) {
        console.warn("chrome stop:", err.message);
      }
    }
  }
}

async function main() {
  const existing = loadExisting();
  let authorization;
  try {
    authorization = await withChrome(async (page) => {
      await warmUp(page);
      return captureAuthorization(page);
    });
  } catch (err) {
    writeStats(existing, {
      ingest: { ok: false, error: err.message, teams: 0 },
    });
    console.error("Box-score ingest failed before fetch:", err.message);
    process.exit(1);
  }

  const { teamLogs, errors } = await fetchTeamLogs(authorization);
  const merged = mergeTeamLogs(existing, teamLogs);
  const gaps = coverageGaps(merged.players, merged.expectations);
  // Team-season 404 is "no published stats" (Lo Sifonet B today), not a scrape
  // outage. Other HTTP failures still fail closed. Weekend scoring only
  // requires box scores for club sides that actually have fantasy players.
  const unavailable = errors.filter((e) => /HTTP 404/.test(e));
  const fatal = errors.filter((e) => !/HTTP 404/.test(e));
  const ok =
    fatal.length === 0 &&
    teamLogs.length + unavailable.length === CLUB_TEAMS.length &&
    merged.expectations.length > 0 &&
    gaps.length === 0;

  writeStats(existing, {
    players: merged.players,
    ingest: {
      ok,
      appended: merged.appended,
      unmapped: merged.unmapped,
      gaps,
      errors: fatal,
      unavailable,
      teams: teamLogs.length,
    },
  });

  console.log(
    `Wrote ${OUT}: appended ${merged.appended}, coverage gaps ${gaps.length}, teams ${teamLogs.length}/${CLUB_TEAMS.length}, ok=${ok}`,
  );
  if (unavailable.length) {
    console.warn("No season stats (404), not blocking:", unavailable.join(" | "));
  }
  if (!ok) {
    if (gaps.length) {
      console.error(
        "Coverage:",
        gaps
          .map((g) => `${g.playerId} PJ=${g.gamesPlayed} stored=${g.stored}`)
          .join(" | "),
      );
    }
    if (errors.length) console.error("Errors:", errors.join(" | "));
    process.exit(1);
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
