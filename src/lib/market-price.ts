/**
 * Club-scale fantasy broker pricing (Balaguer).
 *
 * Inspired by public ACB SuperManager market mechanics at a high level only —
 * not a copy of ACB trademarks, assets, or verbatim rules.
 *
 * theoretical = max(0, avgVal) × €1.000 / VAL point
 * (keeps ~100 VAL-points of squad capacity under a 100.000 € budget,
 * matching the public ACB budget÷€/VAL ratio at club scale)
 * Updates clamp ±15% vs previous quote, then round to nearest €500.
 */

export const EUR_PER_VAL = 1_000;
export const PRICE_STEP = 500;
/** Floor quote — never list a player at 0 €. */
export const MIN_PRICE = PRICE_STEP;
export const PRICE_CLAMP_PCT = 0.15;

/** Catalan footnote for player page / Compte. */
export const MARKET_PRICE_FOOTNOTE_CA =
  "Preu ≈ VAL mitjana × 1.000 € (mín. 500 €, màx. ±15% per jornada). Compres i vendes al preu actual.";

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
 * - No usable previous → seed from theoretical (rounded, floored).
 * - Previous ≤ 0 → re-seed from theoretical (avoids ±15% lock at 0).
 * - Else clamp theoretical into [prev×0.85, prev×1.15], then round to €500.
 * - Always ≥ MIN_PRICE (500 €).
 */
export function computeMarketPrice(
  avgVal: number | null | undefined,
  prevPrice?: number | null,
): number {
  const theoretical = theoreticalPrice(avgVal);

  if (prevPrice == null || !Number.isFinite(prevPrice) || prevPrice <= 0) {
    return applyPriceFloor(roundToPriceStep(theoretical));
  }

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
 * First seed sets prevPrice = null.
 */
export function nextMarketEntry(
  avgVal: number | null | undefined,
  current?: { price: number; prevPrice?: number | null } | null,
  updatedAt = new Date().toISOString(),
): MarketPriceEntry {
  const prev = current?.price ?? null;
  const price = computeMarketPrice(avgVal, prev);
  return {
    price,
    prevPrice: prev,
    avgVal: avgVal == null || !Number.isFinite(avgVal) ? null : avgVal,
    theoretical: applyPriceFloor(roundToPriceStep(theoreticalPrice(avgVal))),
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
