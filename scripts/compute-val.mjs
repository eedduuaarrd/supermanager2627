/**
 * Keep in sync with src/lib/val.ts
 * VAL = PTS − PF − missed FT + PM; missed FT = max(0, FTA − FTM)
 */
export function missedFt(fta, ftm) {
  if (typeof fta !== "number" || typeof ftm !== "number") return null;
  return Math.max(0, fta - ftm);
}

export function computeVal({ pts, pf, ftm, fta, pm }) {
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
