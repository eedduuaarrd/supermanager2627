import { CAPTAIN_MULTIPLIER, resolvePlayerId } from "@/data/roster";

/**
 * What the Equip court prints under a player.
 * - `price`: quote only (lineup still editable, including the next jornada after Sunday close)
 * - `points`: raw jornada VAL, or "-" when that player has no score (not yet played, or DNP)
 * - `ideal`: Equip ideal popup — "VAL n" / "VAL —", unchanged
 */
export type CourtCaptionMode = "price" | "points" | "ideal";

export type CourtChipCaption =
  | { kind: "price" }
  | { kind: "points"; text: string }
  | { kind: "ideal"; value: number | null }
  | { kind: "season" };

export type PastCourtView = {
  round: number;
  playerIds: string[];
  captainId: string | null;
  /** Raw VAL for players who actually played. Omitted ids render as "-". */
  pointsById: Record<string, number>;
};

type ScoreLike = {
  playerId: string;
  points?: number;
  val?: number;
  dnp?: boolean;
};

function canon(id: string): string {
  return resolvePlayerId(id) ?? id;
}

/** One decimal when needed, same rounding the court already used for VAL. */
export function formatCourtPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Plain jornada number. Missing, DNP, and non-finite values are a single "-". */
export function pointsCaptionText(points: number | null | undefined): string {
  if (typeof points !== "number" || !Number.isFinite(points)) return "-";
  return formatCourtPoints(points);
}

/**
 * Unmultiplied fantasy VAL. Captain ×2 lives on `points` and in the team total only.
 * DNP is null so the chip can show "-", not 0.
 */
export function rawCourtVal(
  score: ScoreLike | undefined,
  isCaptain: boolean,
): number | null {
  if (!score || score.dnp) return null;
  if (typeof score.val === "number" && Number.isFinite(score.val)) return score.val;
  if (typeof score.points !== "number" || !Number.isFinite(score.points)) return null;
  if (isCaptain && CAPTAIN_MULTIPLIER > 0) return score.points / CAPTAIN_MULTIPLIER;
  return score.points;
}

export function courtChipCaption(input: {
  mode: CourtCaptionMode;
  playerId: string;
  pointsById?: Record<string, number>;
  /** Ideal popup only: players missing from the map keep the season line. */
  idealOnlyKnown?: boolean;
}): CourtChipCaption {
  if (input.mode === "price") return { kind: "price" };
  if (input.mode === "points") {
    const known = input.pointsById != null && input.playerId in input.pointsById;
    return {
      kind: "points",
      text: pointsCaptionText(known ? input.pointsById![input.playerId] : null),
    };
  }
  if (!input.pointsById || !(input.playerId in input.pointsById)) {
    if (input.idealOnlyKnown && input.pointsById) return { kind: "season" };
    return { kind: "ideal", value: null };
  }
  const value = input.pointsById[input.playerId];
  return {
    kind: "ideal",
    value: typeof value === "number" && Number.isFinite(value) ? value : null,
  };
}

/** Clicking the open chip again clears it; any other chip selects that jornada. */
export function toggleHistoryRound(
  selected: number | null,
  round: number,
): number | null {
  return selected === round ? null : round;
}

export function pastCourtFromHistory(row: {
  round: number;
  captainId: string | null;
  playerIds?: string[];
  scores: ScoreLike[];
}): PastCourtView {
  const captainId = row.captainId ? canon(row.captainId) : null;
  const fromLineup = (row.playerIds ?? []).map(canon).filter((id) => id.length > 0);
  const fromScores = row.scores.map((score) => canon(score.playerId));
  const playerIds = fromLineup.length > 0 ? fromLineup : fromScores;
  const pointsById: Record<string, number> = {};
  for (const score of row.scores) {
    const id = canon(score.playerId);
    const raw = rawCourtVal(score, captainId != null && id === captainId);
    if (raw == null) continue;
    pointsById[id] = raw;
  }
  return { round: row.round, playerIds, captainId, pointsById };
}

/**
 * Equip court contents.
 * Past jornada replaces the current lineup with that round's players and raw points.
 * Clearing the selection returns to the locked jornada (points) or the open window (price).
 */
export function resolveEquipCourt(input: {
  lineupLocked: boolean;
  roundStatus: "open" | "closed";
  current: {
    playerIds: string[];
    captainId: string | null;
    pointsById: Record<string, number>;
  };
  past: PastCourtView | null;
}): {
  source: "current" | "past";
  caption: "price" | "points";
  playerIds: string[];
  captainId: string | null;
  pointsById: Record<string, number>;
} {
  if (input.past) {
    return {
      source: "past",
      caption: "points",
      playerIds: input.past.playerIds,
      captainId: input.past.captainId,
      pointsById: input.past.pointsById,
    };
  }
  const scoring = input.lineupLocked && input.roundStatus === "open";
  return {
    source: "current",
    caption: scoring ? "points" : "price",
    playerIds: input.current.playerIds,
    captainId: input.current.captainId,
    pointsById: scoring ? input.current.pointsById : {},
  };
}
