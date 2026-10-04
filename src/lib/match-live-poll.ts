/**
 * The app process already runs on the VPS. This poll is that path:
 * no new root timer is required. A matching systemd unit exists for
 * hosts that prefer a separate oneshot.
 */
import { loadFixtures } from "@/lib/fixtures";
import { matchNeedsLiveFetch, runMatchLive } from "@/lib/match-live";
import { getDb } from "@/lib/db";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const INTERVAL_MS = 60 * 1000;
let started = false;
let running = false;

function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

function withLock(fn: () => Promise<void>): Promise<void> {
  fs.mkdirSync(dataDir(), { recursive: true });
  const file = path.join(dataDir(), "match-live.lock");
  try {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > 15 * 60 * 1000) fs.unlinkSync(file);
  } catch {
    /* no lock */
  }
  try {
    const fd = fs.openSync(file, "wx");
    fs.closeSync(fd);
  } catch {
    return Promise.resolve();
  }
  return fn().finally(() => {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  });
}

function runScript(script: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

async function refreshLiveFiles() {
  await runScript("scripts/fetch-fcbq-fixtures-browser.mjs");
  await runScript("scripts/fetch-fcbq-boxscores-browser.mjs");
}

export function startMatchLivePoll() {
  if (started) return;
  if (process.env.MATCH_LIVE_POLL === "0") return;
  if (process.env.NODE_ENV !== "production" && process.env.MATCH_LIVE_POLL !== "1") {
    return;
  }
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    void withLock(async () => {
      const fetchLive =
        process.env.NODE_ENV === "production" || process.env.MATCH_LIVE_FETCH === "1";
      if (fetchLive) {
        const baseline = getDb()
          .prepare(`SELECT value FROM meta WHERE key = ?`)
          .get("match_live_since") as { value: string } | undefined;
        const baselineMs = baseline ? Date.parse(baseline.value) : Date.now();
        const needs = matchNeedsLiveFetch(
          loadFixtures(),
          Number.isFinite(baselineMs) ? baselineMs : Date.now(),
          new Date(),
          (key) => {
            const row = getDb()
              .prepare(
                `SELECT outcome FROM match_dispatch WHERE match_key = ?`,
              )
              .get(key) as { outcome: string } | undefined;
            return row?.outcome === "sent" || row?.outcome === "skipped";
          },
        );
        if (needs) await refreshLiveFiles();
      }
      await runMatchLive();
    }).finally(() => {
      running = false;
    });
  };
  setInterval(tick, INTERVAL_MS);
  tick();
}
