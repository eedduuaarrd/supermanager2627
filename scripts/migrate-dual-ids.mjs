#!/usr/bin/env node
/**
 * One-shot, idempotent: move data stored under a plain fantasy id that became
 * dual-team (RENAMED_IDS in fcbq-identity.mjs) onto its primary-team id.
 *
 *   player-stats.json  players[old] → players[new] (playerId updated; game rows,
 *                      jornada tags and VAL kept as they are)
 *   market-prices.json prices[old]  → prices[new] (price/prevPrice/pricedGames kept,
 *                      so the quote does not jump back to INITIAL_PRICE)
 *
 *   market-prices.json roster ids with no quote yet (the new second-team ids)
 *                      get the seed quote with pricedGames 0, exactly like every
 *                      id got at launch, so the next tick prices their games
 *                      (otherwise the first tick would only seed them).
 *
 * Saved lineups / round scores need nothing: the app resolves the old id via
 * LEGACY_PLAYER_ID_MAP in src/data/roster.ts. The box-score ingest fills the
 * new id's games (past rows are tagged from the fixture's jornada).
 *
 * Usage:
 *   node scripts/migrate-dual-ids.mjs [--dry-run] [--stats path] [--prices path] [--roster path]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RENAMED_IDS, parseRosterTeams } from "./fcbq-identity.mjs";
import { INITIAL_PRICE } from "./compute-market-price.mjs";

function sameGame(a, b) {
  if (a.matchCallUuid && a.matchCallUuid === b.matchCallUuid) return true;
  return Boolean(a.date) && a.date === b.date && a.teamId === b.teamId;
}

/**
 * Mutates both documents. Returns a list of human-readable changes.
 * `rosterIds` (optional): ids that must have a quote; missing ones are seeded.
 */
export function migrateDualIds(
  stats,
  prices,
  renamed = RENAMED_IDS,
  rosterIds = [],
  updatedAt = new Date().toISOString(),
) {
  const changes = [];
  const players = stats?.players ?? {};
  const quotes = prices?.prices ?? {};
  for (const [oldId, newId] of Object.entries(renamed)) {
    const prev = players[oldId];
    if (prev) {
      const cur = players[newId];
      if (!cur) {
        players[newId] = { ...prev, playerId: newId };
        changes.push(`player-stats: ${oldId} → ${newId} (${(prev.games ?? []).length} game rows)`);
      } else {
        // Ingest already created the new id: keep its rows, add any old row it lacks.
        cur.games = Array.isArray(cur.games) ? cur.games : [];
        let added = 0;
        for (const g of prev.games ?? []) {
          const hit = cur.games.find((x) => sameGame(x, g));
          if (!hit) {
            cur.games.push({ ...g });
            added += 1;
          } else if (hit.jornada == null && hit.round == null && (g.jornada != null || g.round != null)) {
            hit.jornada = g.jornada ?? g.round;
            hit.round = g.round ?? g.jornada;
          }
        }
        changes.push(`player-stats: merged ${oldId} into existing ${newId} (+${added} rows)`);
      }
      delete players[oldId];
    }
    const q = quotes[oldId];
    if (q) {
      if (!quotes[newId]) {
        quotes[newId] = q;
        changes.push(`market-prices: ${oldId} → ${newId} (price ${q.price})`);
      } else {
        changes.push(`market-prices: ${newId} already priced (${quotes[newId].price}); dropped ${oldId} (${q.price})`);
      }
      delete quotes[oldId];
    }
  }
  if (prices && rosterIds.length) {
    prices.prices = quotes;
    for (const id of rosterIds) {
      if (quotes[id]) continue;
      quotes[id] = {
        price: INITIAL_PRICE,
        prevPrice: INITIAL_PRICE,
        avgVal: null,
        theoretical: null,
        updatedAt,
        pricedGames: 0,
      };
      changes.push(`market-prices: seed ${id} at ${INITIAL_PRICE} (pricedGames 0)`);
    }
  }
  return changes;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const dryRun = args.includes("--dry-run");
  const statsPath = opt("--stats", join(root, "src/data/player-stats.json"));
  const pricesPath = opt("--prices", join(root, "src/data/market-prices.json"));
  const rosterPath = opt("--roster", join(root, "src/data/roster.ts"));
  const rosterIds = [...parseRosterTeams(readFileSync(rosterPath, "utf8")).keys()];
  if (!rosterIds.length) throw new Error(`no roster ids in ${rosterPath}`);
  const stats = JSON.parse(readFileSync(statsPath, "utf8"));
  const prices = existsSync(pricesPath)
    ? JSON.parse(readFileSync(pricesPath, "utf8"))
    : { prices: {} };
  const changes = migrateDualIds(stats, prices, RENAMED_IDS, rosterIds);
  if (!changes.length) {
    console.log("migrate-dual-ids: nothing to do");
  } else {
    for (const c of changes) console.log(`${dryRun ? "[dry-run] " : ""}${c}`);
    if (!dryRun) {
      writeFileSync(statsPath, JSON.stringify(stats, null, 2) + "\n");
      writeFileSync(pricesPath, JSON.stringify(prices, null, 2) + "\n");
      console.log(`wrote ${statsPath} and ${pricesPath}`);
    }
  }
}
