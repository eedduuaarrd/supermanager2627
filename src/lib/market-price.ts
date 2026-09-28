/**
 * Club-scale fantasy broker pricing (Balaguer).
 *
 * Inspired by public ACB SuperManager market mechanics at a high level only —
 * not a copy of ACB trademarks, assets, or verbatim rules.
 *
 * Seed: every fantasy id starts at INITIAL_PRICE (15.000 €).
 * On VAL / jornada refresh: theoretical = max(0, avgVal) × €1.000 / VAL point,
 * then clamp ±15% vs previous quote, round to €500, floor ≥ 500.
 * Buy/sell at the current quote. Budget stays 100.000 € (8×15k = 120k >
 * 100k is intentional scarcity).
 */

export const EUR_PER_VAL = 1_000;
/** Alias used in broker docs / ACB-style single-game tables. */
export const PRICE_PER_VAL = EUR_PER_VAL;
export const PRICE_STEP = 500;
/** Flat opening quote for every fantasy id until the first scoring refresh. */
export const INITIAL_PRICE = 15_000;
/** Floor quote — never list a player at 0 €. */
export const MIN_PRICE = PRICE_STEP;
export const PRICE_CLAMP_PCT = 0.15;

/** Catalan footnote for player page / Compte. */
export const MARKET_PRICE_FOOTNOTE_CA =
  "Sortida 15.000 €; després ≈ VAL mitjana × 1.000 € (mín. 500 €, màx. ±15% per actualització). Compres i vendes al preu actual.";

export const BUY_SELL_RULE_CA = "Compra i venda al preu de mercat actual.";

export function roundToPriceStep(value: number, step = PRICE_STEP): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / step) * step;
}

export function applyPriceFloor(price: number, floor = MIN_PRICE): number {
  if (!Number.isFinite(price) || price < floor) return floor;
  return price;
}

/** Theoretical quote from season average fantasy VAL. */
export function theoreticalPrice(avgVal: number | null | undefined): number {
  if (avgVal == null || !Number.isFinite(avgVal)) return 0;
  return Math.max(0, avgVal) * EUR_PER_VAL;
}

/**
 * Next market quote from theoretical + optional previous quote.
 * - No usable previous → flat INITIAL_PRICE (15.000 € seed for everyone).
 * - Previous ≤ 0 → re-seed at INITIAL_PRICE (avoids ±15% lock at 0).
 * - Else clamp theoretical into [prev×0.85, prev×1.15], then round to €500.
 * - Always ≥ MIN_PRICE (500 €) after a performance tick.
 */
export function computeMarketPrice(
  avgVal: number | null | undefined,
  prevPrice?: number | null,
): number {
  if (prevPrice == null || !Number.isFinite(prevPrice) || prevPrice <= 0) {
    return INITIAL_PRICE;
  }

  const theoretical = theoreticalPrice(avgVal);
  const lo = prevPrice * (1 - PRICE_CLAMP_PCT);
  const hi = prevPrice * (1 + PRICE_CLAMP_PCT);
  const clamped = Math.min(hi, Math.max(lo, theoretical));
  return applyPriceFloor(roundToPriceStep(clamped));
}

export type MarketPriceEntry = {
  price: number;
  prevPrice: number | null;
  avgVal: number | null;
  theoretical: number;
  updatedAt: string;
};

/**
 * Apply one price tick: prevPrice ← current price, price ← computeMarketPrice.
 * First seed sets price = prevPrice = INITIAL_PRICE (no fake ↑↓).
 */
export function nextMarketEntry(
  avgVal: number | null | undefined,
  current?: { price: number; prevPrice?: number | null } | null,
  updatedAt = new Date().toISOString(),
): MarketPriceEntry {
  const avg =
    avgVal == null || !Number.isFinite(avgVal) ? null : avgVal;
  const theoretical = applyPriceFloor(
    roundToPriceStep(theoreticalPrice(avgVal)),
  );

  if (current == null || !Number.isFinite(current.price) || current.price <= 0) {
    return {
      price: INITIAL_PRICE,
      prevPrice: INITIAL_PRICE,
      avgVal: avg,
      theoretical,
      updatedAt,
    };
  }

  const prev = current.price;
  const price = computeMarketPrice(avgVal, prev);
  return {
    price,
    prevPrice: prev,
    avgVal: avg,
    theoretical,
    updatedAt,
  };
}

/** ↑ / ↓ / flat vs previous quote. */
export function priceTrend(
  price: number,
  prevPrice?: number | null,
): "up" | "down" | "flat" {
  if (prevPrice == null || !Number.isFinite(prevPrice) || prevPrice === price) {
    return "flat";
  }
  return price > prevPrice ? "up" : "down";
}

/** Absolute € change vs previous quote (null when unknown / flat seed). */
export function priceDelta(
  price: number,
  prevPrice?: number | null,
): number | null {
  if (prevPrice == null || !Number.isFinite(prevPrice)) return null;
  const d = price - prevPrice;
  return d === 0 ? null : d;
}

/** Round to one decimal (broker VAL tables). */
export function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export type NextValThresholds = {
  /** Game VAL to push quote to the +15% band. */
  valUp: number;
  /** Game VAL that holds the quote (theoretical ≈ P). */
  valHold: number;
  /** Game VAL at/below which quote hits the −15% band. */
  valDown: number;
  /** Next printed prices if move max up / hold / max down. */
  priceUp: number;
  priceHold: number;
  priceDown: number;
};

/**
 * ACB-like single-game VAL thresholds for the *next* price tick.
 *
 * With current quote P and PRICE_PER_VAL k:
 *   +15%: VAL ≥ round1(P × 1.15 / k)
 *   hold: VAL ≈ round1(P / k)
 *   −15%: VAL ≤ round1(P × 0.85 / k)
 *
 * Next prices: round500(P×1.15), round500(P), round500(P×0.85), then floor 500.
 * Actual refresh still uses season avgVal × k clamped ±15% (see computeMarketPrice).
 */
export function nextValThresholds(
  currentPrice: number,
  k: number = PRICE_PER_VAL,
): NextValThresholds {
  const P =
    !Number.isFinite(currentPrice) || currentPrice <= 0
      ? INITIAL_PRICE
      : currentPrice;
  const perVal = Number.isFinite(k) && k > 0 ? k : PRICE_PER_VAL;

  return {
    valUp: round1((P * (1 + PRICE_CLAMP_PCT)) / perVal),
    valHold: round1(P / perVal),
    valDown: round1((P * (1 - PRICE_CLAMP_PCT)) / perVal),
    priceUp: applyPriceFloor(roundToPriceStep(P * (1 + PRICE_CLAMP_PCT))),
    priceHold: applyPriceFloor(roundToPriceStep(P)),
    priceDown: applyPriceFloor(roundToPriceStep(P * (1 - PRICE_CLAMP_PCT))),
  };
}
