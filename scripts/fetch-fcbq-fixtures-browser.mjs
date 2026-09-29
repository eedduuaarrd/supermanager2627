#!/usr/bin/env node
/**
 * Refresh fixtures.json from FCBQ team calendars via a real Chrome profile.
 *
 * Why browser: basquetcatala.cat gates curl/msstats behind reCAPTCHA. A normal
 * Chrome process (started by scripts/fcbq-chrome.sh) passes v3 with score ≥0.8
 * and renders calendari_equip_global with Data/Hora tip-offs. Cookie paste from
 * Edu is not required; cookie export alone is also not enough for curl.
 *
 * Usage:
 *   node scripts/fetch-fcbq-fixtures-browser.mjs
 *   FCBQ_CDP_PORT=9335 FCBQ_CHROME_PROFILE=~/.cache/fcbq-chrome node …
 *   node scripts/fetch-fcbq-fixtures-browser.mjs --keep-chrome
 *   node scripts/fetch-fcbq-fixtures-browser.mjs --connect-only   # Chrome already up
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import puppeteer from "puppeteer-core";
import {
  CLUB_TEAMS,
  parseCalendarHtml,
  buildFixturesFile,
} from "./fetch-fcbq-fixtures.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "src/data/fixtures.json");
const CLUB_ID = 402;
const CAL_BASE = `https://www.basquetcatala.cat/partits/calendari_equip_global/${CLUB_ID}`;

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

function loadExistingSync() {
  if (!existsSync(OUT)) return { teams: [] };
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { teams: [] };
  }
}

async function waitForCalendar(page, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await page.evaluate(() => {
      const body = document.body?.innerText || "";
      const title = document.title || "";
      return {
        title,
        hasHora: /Hora/i.test(body) && /\d{2}\/\d{2}\/\d{4}/.test(body),
        captcha:
          /Verificaci/i.test(title) || /CONFIRMA QUE ETS UNA PERSONA/i.test(body),
        blocked: /activitat inusual/i.test(body),
      };
    });
    if (st.hasHora) return "ok";
    if (st.captcha || st.blocked) {
      for (const frame of page.frames()) {
        try {
          const box = await frame.$(
            "#recaptcha-anchor, .recaptcha-checkbox-border",
          );
          if (box) await box.click({ delay: 40 });
        } catch {
          /* frame may have navigated */
        }
      }
      try {
        await page.evaluate(() => {
          window.fcbq?.recaptcha?.autoVerify?.();
        });
      } catch {
        /* ignore */
      }
    }
    await sleep(1200);
  }
  return "timeout";
}

async function warmUp(page) {
  // Seed reCAPTCHA v3 / fcbq_rc on a light page before calendar scrapes.
  try {
    await page.goto("https://www.basquetcatala.cat/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    for (let i = 0; i < 20; i++) {
      const st = await page.evaluate(() => {
        const title = document.title || "";
        const body = document.body?.innerText || "";
        return {
          captcha:
            /Verificaci/i.test(title) ||
            /CONFIRMA QUE ETS UNA PERSONA/i.test(body),
          ready: /Federaci/i.test(title) || /Bàsquet Català/i.test(title),
        };
      });
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
    await sleep(1500);
  } catch (err) {
    console.warn("warm-up:", err.message);
  }
}

async function scrapeTeam(page, team) {
  const url = `${CAL_BASE}/${team.legacyTeamId}`;
  const resp = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const status = resp?.status() ?? 0;
  const ready = await waitForCalendar(page);
  if (ready !== "ok") {
    throw new Error(
      `calendar ${team.legacyTeamId} ${ready} (HTTP ${status}, title=${await page.title()})`,
    );
  }
  const html = await page.content();
  const games = parseCalendarHtml(html, team);
  if (!games.length) {
    throw new Error(`calendar ${team.legacyTeamId} parsed 0 rows`);
  }
  return games;
}

async function main() {
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

  const payloadsByTeam = {};
  const gaps = [];

  try {
    await warmUp(page);
    const pending = [...CLUB_TEAMS];
    // Two passes: first visit + one retry for teams that hit the challenge page.
    for (let pass = 1; pass <= 2 && pending.length; pass++) {
      const batch = pending.splice(0, pending.length);
      for (const team of batch) {
        try {
          const games = await scrapeTeam(page, team);
          payloadsByTeam[team.fcbqTeamId] = { games };
          const withTip = games.filter((g) => g.tipOff).length;
          console.log(
            `OK ${team.shortName}: ${games.length} fixtures (${withTip} tip-offs)`,
          );
        } catch (err) {
          if (pass === 1) {
            console.warn("retry later", team.shortName, err.message);
            pending.push(team);
          } else {
            gaps.push(`${team.shortName}: ${err.message}`);
            console.warn("FAIL", team.shortName, err.message);
          }
        }
        await sleep(1000);
      }
      if (pending.length) {
        console.log(`pass ${pass} incomplete — re-warming (${pending.length} left)`);
        await warmUp(page);
      }
    }
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

  if (Object.keys(payloadsByTeam).length === 0) {
    console.error(
      "Browser calendar fetch failed for all teams — keeping existing fixtures.json",
    );
    if (gaps.length) console.error("Gaps:", gaps.join(" | "));
    process.exit(2);
  }

  const existing = loadExistingSync();
  // Drop prior fetch gaps — only keep structural notes from previous file.
  const existingClean = { ...existing, gaps: [] };
  const out = buildFixturesFile({
    existing: existingClean,
    payloadsByTeam,
    gaps,
    source: `browser:basquetcatala.cat/partits/calendari_equip_global/${CLUB_ID}/{legacyId}`,
  });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const counts = out.teams.map((t) => `${t.shortName}:${t.fixtures.length}`);
  console.log(`Wrote ${OUT} (${counts.join(", ")})`);
  if (gaps.length) console.log("Gaps:", gaps.join(" | "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
