/**
 * Keep in sync with src/lib/market-price.ts
 * Club-scale broker: theoretical = max(0, avgVal) × 1000; clamp ±15%; round €500.
 */

export const EUR_PER_VAL = 1_000;
export const PRICE_STEP = 500;
export const PRICE_CLAMP_PCT = 0.15;

export function roundToPriceStep(value, step = PRICE_STEP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / step) * step;
}

export function theoreticalPrice(avgVal) {
  if (avgVal == null || !Number.isFinite(avgVal)) return 0;
  return Math.max(0, avgVal) * EUR_PER_VAL;
}

export function computeMarketPrice(avgVal, prevPrice) {
  const theoretical = theoreticalPrice(avgVal);
  if (prevPrice == null || !Number.isFinite(prevPrice) || prevPrice <= 0) {
    return roundToPriceStep(theoretical);
  }
  const lo = prevPrice * (1 - PRICE_CLAMP_PCT);
  const hi = prevPrice * (1 + PRICE_CLAMP_PCT);
  const clamped = Math.min(hi, Math.max(lo, theoretical));
  return roundToPriceStep(clamped);
}

export function nextMarketEntry(avgVal, current, updatedAt = new Date().toISOString()) {
  const prev = current?.price ?? null;
  const price = computeMarketPrice(avgVal, prev);
  return {
    price,
    prevPrice: prev,
    avgVal: avgVal == null || !Number.isFinite(avgVal) ? null : avgVal,
    theoretical: roundToPriceStep(theoreticalPrice(avgVal)),
    updatedAt,
  };
}
