#!/usr/bin/env node
/**
 * Optional oneshot for supermanager-match-live.timer.
 * The Next.js process already polls the same check, so this timer does
 * not have to be enabled when the server cannot install new units.
 *
 *   node scripts/match-live.mjs --fetch
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.warn(`${script} exited ${result.status ?? 1}`);
  }
}

if (process.argv.includes("--fetch")) {
  run("scripts/fetch-fcbq-fixtures-browser.mjs");
  run("scripts/fetch-fcbq-boxscores-browser.mjs");
}

const token = process.env.ADMIN_TOKEN;
const base = process.env.APP_URL || "http://127.0.0.1:4317";
if (!token) {
  console.error("ADMIN_TOKEN missing");
  process.exit(1);
}
const res = await fetch(`${base}/api/admin/weekly`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-admin-token": token,
  },
  body: JSON.stringify({ action: "match-finished" }),
});
const text = await res.text();
console.log(text);
if (!res.ok) process.exit(1);
