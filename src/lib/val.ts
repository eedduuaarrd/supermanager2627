/**
 * Supermanager Balaguer fantasy VAL (user-defined).
 * VAL = PTS − PF − missed FT + PM
 * missed FT = max(0, FTA − FTM)
 *
 * Omit a term only when that component is truly unavailable (null/undefined).
 * Never invent fouls or free-throw misses.
 */

export type ValInputs = {
  pts?: number | null;
  pf?: number | null;
  /** Free throws made (FCBQ TLC). */
  ftm?: number | null;
  /** Free throws attempted (FCBQ TLI). */
  fta?: number | null;
  /** Plus/minus (FCBQ PM / onCourtPlusMinus). */
  pm?: number | null;
};

export type ValBreakdown = {
  pts: number | null;
  pf: number | null;
  missedFt: number | null;
  pm: number | null;
  val: number | null;
};

/** Missed free throws from made/attempted; null if either side is missing. */
export function missedFt(
  fta?: number | null,
  ftm?: number | null,
): number | null {
  if (typeof fta !== "number" || typeof ftm !== "number") return null;
  return Math.max(0, fta - ftm);
}

/**
 * Fantasy VAL from box-score components.
 * Returns null when nothing usable is present (no pts and no pm).
 */
export function computeVal(input: ValInputs): number | null {
  const { pts, pf, ftm, fta, pm } = input;
  const hasPts = typeof pts === "number";
  const hasPm = typeof pm === "number";
  if (!hasPts && !hasPm) return null;

  let v = 0;
  if (hasPts) v += pts;
  if (typeof pf === "number") v -= pf;
  const miss = missedFt(fta, ftm);
  if (miss != null) v -= miss;
  if (hasPm) v += pm;
  return v;
}

export function valBreakdown(input: ValInputs): ValBreakdown {
  return {
    pts: typeof input.pts === "number" ? input.pts : null,
    pf: typeof input.pf === "number" ? input.pf : null,
    missedFt: missedFt(input.fta, input.ftm),
    pm: typeof input.pm === "number" ? input.pm : null,
    val: computeVal(input),
  };
}

/** Catalan short footnote shown wherever users see VAL. */
export const VAL_FORMULA_FOOTNOTE_CA =
  "VAL = PTS − faltes personals − TL fallats + ± (plus/minus). Capità ×2.";
