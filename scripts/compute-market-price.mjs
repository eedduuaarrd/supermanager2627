/**
 * Keep in sync with src/lib/market-price.ts
 * Seed: every id at INITIAL_PRICE 15000 (prevPrice = 15000).
 * Refresh: theoretical = max(0, avgVal) × 1000; clamp ±15% vs prev;
 * round €500; floor MIN_PRICE 500 € (never 0 €).
 */

export const EUR_PER_VAL = 1_000;
export const PRICE_PER_VAL = EUR_PER_VAL;
export const PRICE_STEP = 500;
export const INITIAL_PRICE = 15_000;
export const MIN_PRICE = PRICE_STEP;
export const PRICE_CLAMP_PCT = 0.15;

export function roundToPriceStep(value, step = PRICE_STEP) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / step) * step;
}

export function applyPriceFloor(price, floor = MIN_PRICE) {
  if (!Number.isFinite(price) || price < floor) return floor;
  return price;
}

export function theoreticalPrice(avgVal) {
  if (avgVal == null || !Number.isFinite(avgVal)) return 0;
  return Math.max(0, avgVal) * EUR_PER_VAL;
}

export function computeMarketPrice(avgVal, prevPrice) {
  if (prevPrice == null || !Number.isFinite(prevPrice) || prevPrice <= 0) {
    return INITIAL_PRICE;
  }
  const theoretical = theoreticalPrice(avgVal);
  const lo = prevPrice * (1 - PRICE_CLAMP_PCT);
  const hi = prevPrice * (1 + PRICE_CLAMP_PCT);
  const clamped = Math.min(hi, Math.max(lo, theoretical));
  return applyPriceFloor(roundToPriceStep(clamped));
}

export function nextMarketEntry(avgVal, current, updatedAt = new Date().toISOString()) {
  const avg = avgVal == null || !Number.isFinite(avgVal) ? null : avgVal;
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

export function round1(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * Next-game VAL thresholds. Prefer season-avg solve when n>0:
 *   S = (n+1)×(target)/k − sumVal  for target ∈ {P×1.15, P, P×0.85}
 * Else first-game P÷k table. Keep in sync with src/lib/market-price.ts.
 */
export function nextValThresholds(currentPrice, optsOrK = PRICE_PER_VAL) {
  const opts = typeof optsOrK === "number" ? { k: optsOrK } : optsOrK ?? {};
  const P =
    !Number.isFinite(currentPrice) || currentPrice <= 0
      ? INITIAL_PRICE
      : currentPrice;
  const perVal = Number.isFinite(opts.k) && opts.k > 0 ? opts.k : PRICE_PER_VAL;
  const n =
    typeof opts.gamesPlayed === "number" &&
    Number.isFinite(opts.gamesPlayed) &&
    opts.gamesPlayed > 0
      ? Math.floor(opts.gamesPlayed)
      : 0;
  const sum =
    typeof opts.sumVal === "number" && Number.isFinite(opts.sumVal)
      ? opts.sumVal
      : null;

  const priceUp = applyPriceFloor(roundToPriceStep(P * (1 + PRICE_CLAMP_PCT)));
  const priceHold = applyPriceFloor(roundToPriceStep(P));
  const priceDown = applyPriceFloor(roundToPriceStep(P * (1 - PRICE_CLAMP_PCT)));

  if (n <= 0 || sum == null) {
    return {
      valUp: round1((P * (1 + PRICE_CLAMP_PCT)) / perVal),
      valHold: round1(P / perVal),
      valDown: round1((P * (1 - PRICE_CLAMP_PCT)) / perVal),
      priceUp,
      priceHold,
      priceDown,
      usesSeasonAvg: false,
    };
  }

  const nextN = n + 1;
  const solveS = (targetPrice) =>
    round1((targetPrice / perVal) * nextN - sum);

  return {
    valUp: solveS(P * (1 + PRICE_CLAMP_PCT)),
    valHold: solveS(P),
    valDown: solveS(P * (1 - PRICE_CLAMP_PCT)),
    priceUp,
    priceHold,
    priceDown,
    usesSeasonAvg: true,
  };
}
