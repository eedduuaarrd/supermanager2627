/**
 * Live broker roster — prefer on-disk market-prices.json so weekend-sync
 * ticks are visible without a Next rebuild (same pattern as fixtures /
 * player-stats).
 */
import {
  overlayMarketPrices,
  ROSTER,
  ROSTER_SEED,
  resolvePlayerId,
  type MarketPricesFile,
} from "@/data/roster";
import type { Player } from "@/lib/types";
import fs from "node:fs";
import path from "node:path";

function marketPriceCandidates(): string[] {
  const out: string[] = [];
  if (process.env.MARKET_PRICES_PATH) {
    out.push(process.env.MARKET_PRICES_PATH);
  }
  if (process.env.DATA_DIR) {
    out.push(path.join(process.env.DATA_DIR, "market-prices.json"));
  }
  out.push(path.join(process.cwd(), "src/data/market-prices.json"));
  return out;
}

/** Prefer on-disk JSON so price ticks apply without rebuild. */
export function loadMarketPricesFile(): MarketPricesFile | null {
  for (const filePath of marketPriceCandidates()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as MarketPricesFile;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function getLiveRoster(): Player[] {
  const file = loadMarketPricesFile();
  if (!file) return ROSTER;
  return overlayMarketPrices(ROSTER_SEED, file);
}

export function getLivePlayer(id: string): Player | undefined {
  const resolved = resolvePlayerId(id);
  if (!resolved) return undefined;
  return getLiveRoster().find((p) => p.id === resolved);
}

export function livePriceOf(id: string): number {
  return getLivePlayer(id)?.price ?? 0;
}
