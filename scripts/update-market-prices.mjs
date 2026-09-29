#!/usr/bin/env node
/**
 * Recompute broker market prices from player-stats.json (Balaguer VAL averages).
 * Writes src/data/market-prices.json (roster overlays this at runtime).
 *
 * Usage:
 *   node scripts/update-market-prices.mjs           # tick only if new games
 *   node scripts/update-market-prices.mjs --seed    # flat INITIAL_PRICE for all
 *   node scripts/update-market-prices.mjs --force   # tick even without new games
 *
 * Seed sets price = prevPrice = 10000 (no fake ↑↓). First refresh after seed
 * uses 10000 as prev for the ±15% clamp toward avgVal × €1000/VAL.
 * Re-runs with the same game count do NOT move prices (ACB-style).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVal } from "./compute-val.mjs";
import {
  INITIAL_PRICE,
  MIN_PRICE,
  nextMarketEntry,
  shouldTickPrice,
  theoreticalPrice,
  applyPriceFloor,
  roundToPriceStep,
} from "./compute-market-price.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const STATS = join(root, "src/data/player-stats.json");
const OUT = join(root, "src/data/market-prices.json");
const ROSTER = join(root, "src/data/roster.ts");

const seedOnly = process.argv.includes("--seed");
const forceTick = process.argv.includes("--force");

function fantasyVals(games) {
  if (!Array.isArray(games) || games.length === 0) return [];
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
  return vals;
}

function avgFantasyVal(vals) {
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
let skipped = 0;
let ticked = 0;

for (const id of ids) {
  const rec = stats.players?.[id];
  const vals = fantasyVals(rec?.games ?? []);
  const gamesPlayed = vals.length;
  const avgVal = avgFantasyVal(vals);
  const theoretical = applyPriceFloor(
    roundToPriceStep(theoreticalPrice(avgVal)),
  );

  if (seedOnly) {
    prices[id] = {
      price: INITIAL_PRICE,
      prevPrice: INITIAL_PRICE,
      avgVal,
      theoretical,
      updatedAt,
      pricedGames: 0,
    };
    continue;
  }

  const current = prevFile.prices?.[id] ?? null;

  if (!shouldTickPrice(current, gamesPlayed, forceTick)) {
    skipped += 1;
    prices[id] = {
      price: current.price,
      prevPrice: current.prevPrice ?? current.price,
      avgVal,
      theoretical,
      updatedAt,
      pricedGames:
        typeof current.pricedGames === "number"
          ? current.pricedGames
          : gamesPlayed,
    };
    continue;
  }

  ticked += 1;
  prices[id] = nextMarketEntry(avgVal, current, updatedAt, gamesPlayed);
}

const out = {
  updatedAt: updatedAt.slice(0, 10),
  formula:
    "seed INITIAL_PRICE 10000; refresh: theoretical = max(0, avgVal) × 1000; clamp ±15% vs prev; round 500; floor MIN_PRICE 500; tick only when gamesPlayed increases",
  notes: [
    "Club-scale broker pricing for Supermanager Balaguer.",
    "Every fantasy id seeds at INITIAL_PRICE 10000 (prevPrice = 10000).",
    "Prices only move when scored game count grows (or --force).",
    "Dual-team fantasy ids are priced separately.",
    "Never list 0 € — floor is MIN_PRICE (500 €).",
    "Budget stays 100000: 8×10000=80000 leaves headroom under 100k.",
    "Roster overlays these quotes at runtime (applyMarketPrices).",
    "Refresh: node scripts/update-market-prices.mjs",
    "Seed (flat 10000): node scripts/update-market-prices.mjs --seed",
    "Force tick: node scripts/update-market-prices.mjs --force",
  ],
  prices,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

const all = Object.values(prices);
const zeros = all.filter((p) => !p.price || p.price === 0);
const belowFloor = all.filter((p) => p.price > 0 && p.price < MIN_PRICE);
if (zeros.length || belowFloor.length) {
  console.error(
    `ABORT: ${zeros.length} zero-price and ${belowFloor.length} below-floor quotes — floor is ${MIN_PRICE}`,
  );
  process.exit(1);
}

const nonzero = all.filter((p) => p.price > 0).length;
const atSeed = all.filter((p) => p.price === INITIAL_PRICE).length;
const moved = all.filter(
  (p) => p.prevPrice != null && p.prevPrice !== p.price,
).length;
const sample = Object.entries(prices)
  .sort((a, b) => b[1].price - a[1].price)
  .slice(0, 5)
  .map(([id, p]) => `${id}=${p.price}`)
  .join(", ");
console.log(
  `Wrote ${OUT}: ${ids.length} players, ${nonzero} with price>0, ${atSeed} at seed ${INITIAL_PRICE}, ${moved} moved vs prev, ticked=${ticked} skipped=${skipped}. Top: ${sample}`,
);
console.log(
  `Example theoretical Ares: ${roundToPriceStep(theoreticalPrice(34))}; first clamp from seed: ${roundToPriceStep(INITIAL_PRICE * 1.15)}`,
);
