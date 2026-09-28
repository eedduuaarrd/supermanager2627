#!/usr/bin/env node
/**
 * Recompute broker market prices from player-stats.json (Balaguer VAL averages).
 * Writes src/data/market-prices.json (roster overlays this at runtime).
 *
 * Usage:
 *   node scripts/update-market-prices.mjs           # clamp vs previous quotes
 *   node scripts/update-market-prices.mjs --seed    # ignore previous (first deploy)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVal } from "./compute-val.mjs";
import {
  nextMarketEntry,
  theoreticalPrice,
  roundToPriceStep,
} from "./compute-market-price.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const STATS = join(root, "src/data/player-stats.json");
const OUT = join(root, "src/data/market-prices.json");
const ROSTER = join(root, "src/data/roster.ts");

const seedOnly = process.argv.includes("--seed");

function avgFantasyVal(games) {
  if (!Array.isArray(games) || games.length === 0) return null;
  const vals = [];
  for (const g of games) {
    const v = computeVal({
      pts: g.pts,
      pf: g.pf,
      ftm: g.tlc,
      fta: g.tli,
      pm: g.pm,
    });
    if (typeof v === "number") vals.push(v);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function loadPrev() {
  if (seedOnly || !existsSync(OUT)) return { prices: {} };
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { prices: {} };
  }
}

function rosterIds() {
  const src = readFileSync(ROSTER, "utf8");
  const ids = [];
  const re = /^\s+id: "([^"]+)",$/gm;
  let m;
  while ((m = re.exec(src))) {
    const id = m[1];
    if (
      id === "masc-a" ||
      id === "masc-b" ||
      id === "fem-a" ||
      id === "fem-b"
    ) {
      continue;
    }
    ids.push(id);
  }
  return [...new Set(ids)];
}

const stats = JSON.parse(readFileSync(STATS, "utf8"));
const prevFile = loadPrev();
const ids = rosterIds();
const updatedAt = new Date().toISOString();
const prices = {};

for (const id of ids) {
  const rec = stats.players?.[id];
  const avgVal = avgFantasyVal(rec?.games ?? []);
  const current = seedOnly ? null : (prevFile.prices?.[id] ?? null);
  prices[id] = nextMarketEntry(avgVal, current, updatedAt);
}

const out = {
  updatedAt: updatedAt.slice(0, 10),
  formula:
    "theoretical = max(0, avgVal) × 1000; clamp ±15%; round 500; floor MIN_PRICE 500",
  notes: [
    "Club-scale broker pricing for Supermanager Balaguer.",
    "Dual-team fantasy ids are priced separately.",
    "Never list 0 € — floor is MIN_PRICE (500 €).",
    "Roster overlays these quotes at runtime (applyMarketPrices).",
    "Refresh: node scripts/update-market-prices.mjs",
    "Seed (ignore prev): node scripts/update-market-prices.mjs --seed",
  ],
  prices,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

const nonzero = Object.values(prices).filter((p) => p.price > 0).length;
const sample = Object.entries(prices)
  .sort((a, b) => b[1].price - a[1].price)
  .slice(0, 5)
  .map(([id, p]) => `${id}=${p.price}`)
  .join(", ");
console.log(
  `Wrote ${OUT}: ${ids.length} players, ${nonzero} with price>0. Top: ${sample}`,
);
console.log(
  `Example theoretical Ares: ${roundToPriceStep(theoreticalPrice(34))}`,
);
