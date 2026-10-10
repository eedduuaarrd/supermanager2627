import { CAPTAIN_MULTIPLIER, resolvePlayerId } from "@/data/roster";

/**
 * What the Equip court prints under a player.
 * - `price`: quote only (lineup still editable, including the next jornada after Sunday close)
 * - `points`: jornada number; captain is raw VAL ×2; "-" until that match ends; 0 if it ended and they did not play
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
  /**
   * Number under each player. Captain is raw VAL ×2. Everyone else is raw VAL.
   * 0 means the match is over and they did not play, or the valuation really was 0.
   * Omitted ids render as "-".
   */
  pointsById: Record<string, number>;
};

/** A club match that can decide "-" versus 0 for players who are not in the score list. */
export type CourtMatchSheet = {
  teamId: string;
  jornada: number | null;
  finished: boolean;
  /** Empty when the result is in but the box sheet has not arrived. */
  boxPlayerIds: string[];
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

/** Plain jornada number. No score yet is "-". A stored 0 stays "0". */
export function pointsCaptionText(points: number | null | undefined): string {
  if (typeof points !== "number" || !Number.isFinite(points)) return "-";
  return formatCourtPoints(points);
}

/**
 * Number printed under a player on the locked court and on a past jornada.
 * Captain is raw VAL ×2, the same figure already stored on `points` and in the
 * jornada total. Everyone else is raw VAL. A finished DNP is 0, including the
 * captain. No score row at all is null ("-" until the match ends).
 * Legacy rows without `val` use `points`, which is already doubled for the captain.
 */
export function courtPlayerPoints(
  score: ScoreLike | undefined,
  isCaptain: boolean,
): number | null {
  if (!score) return null;
  if (score.dnp) return 0;
  if (typeof score.val === "number" && Number.isFinite(score.val)) {
    if (isCaptain && CAPTAIN_MULTIPLIER > 0) return score.val * CAPTAIN_MULTIPLIER;
    return score.val;
  }
  if (typeof score.points !== "number" || !Number.isFinite(score.points)) return null;
  return score.points;
}

function finiteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sameMatch(
  box: { teamId: string; matchCallUuid?: string | null; date?: string | null },
  teamId: string,
  fixture: { matchCallUuid?: string | null; date?: string | null },
): boolean {
  if (box.teamId !== teamId) return false;
  if (fixture.matchCallUuid && box.matchCallUuid === fixture.matchCallUuid) return true;
  const day = fixture.date?.slice(0, 10) ?? "";
  const boxDay = box.date?.slice(0, 10) ?? "";
  return Boolean(day && boxDay && day === boxDay);
}

/** Club matches for one fantasy round, with the players who appear on each box sheet. */
export function buildCourtMatchSheets(input: {
  round: number;
  teams: {
    teamId: string;
    fixtures: {
      jornada?: number | null;
      teamPoints?: number | null;
      opponentPoints?: number | null;
      matchCallUuid?: string | null;
      date?: string | null;
    }[];
  }[];
  boxes: {
    playerId: string;
    teamId: string;
    matchCallUuid?: string | null;
    date?: string | null;
  }[];
}): CourtMatchSheet[] {
  const sheets: CourtMatchSheet[] = [];
  for (const team of input.teams) {
    for (const fixture of team.fixtures) {
      if (fixture.jornada !== input.round) continue;
      const boxPlayerIds = input.boxes
        .filter((box) => sameMatch(box, team.teamId, fixture))
        .map((box) => box.playerId);
      sheets.push({
        teamId: team.teamId,
        jornada: fixture.jornada ?? null,
        finished:
          finiteScore(fixture.teamPoints) && finiteScore(fixture.opponentPoints),
        boxPlayerIds,
      });
    }
  }
  return sheets;
}

/**
 * Numbers for the locked, still-open court.
 * A valuation (including a real 0) wins. Otherwise 0 only when that player's
 * match has a result and a box sheet that does not include them. Everyone
 * else stays off the map so the chip can show "-".
 */
export function pointsForInProgressCourt(input: {
  round: number;
  playerIds: string[];
  scores: ScoreLike[];
  captainId?: string | null;
  teamOf: (playerId: string) => string | null;
  matches: CourtMatchSheet[];
  /**
   * Same per-player jornada figure the player page shows (raw VAL of that
   * player's game tagged to this jornada, 0 for a DNP row), or null when the
   * player has no game for the jornada yet. Captain ×2 is applied here.
   */
  jornadaValOf?: (playerId: string) => number | null;
  /** Lineup captain, used when no score row exists yet. */
  lineupCaptainId?: string | null;
}): Record<string, number> {
  const capRaw = input.captainId ?? input.lineupCaptainId ?? null;
  const captainId = capRaw ? canon(capRaw) : null;
  const out: Record<string, number> = {};
  for (const score of input.scores) {
    const id = canon(score.playerId);
    const raw = courtPlayerPoints(score, captainId != null && id === captainId);
    if (raw == null) continue;
    out[id] = raw;
  }
  for (const playerId of input.playerIds) {
    const id = canon(playerId);
    if (id in out) continue;
    const val = input.jornadaValOf?.(id) ?? null;
    if (typeof val === "number" && Number.isFinite(val)) {
      out[id] = id === captainId && CAPTAIN_MULTIPLIER > 0 ? val * CAPTAIN_MULTIPLIER : val;
      continue;
    }
    const teamId = input.teamOf(id);
    if (!teamId) continue;
    const matches = input.matches.filter(
      (match) => match.teamId === teamId && match.jornada === input.round && match.finished,
    );
    const withSheet = matches.filter((match) => match.boxPlayerIds.length > 0);
    if (withSheet.length === 0) continue;
    const appeared = withSheet.some((match) => match.boxPlayerIds.includes(id));
    if (!appeared) out[id] = 0;
  }
  return out;
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

/**
 * The current jornada pill stays selected while that round is open.
 * That is the lineup window (changes allowed) and the locked live jornada.
 * A closed round does not pin itself.
 */
export function currentJornadaPinned(roundStatus: "open" | "closed"): boolean {
  return roundStatus === "open";
}

export type JornadaChipPoints = {
  round: number;
  points: number;
  cumulative: number;
  rank: number | null;
  /**
   * False only on the placeholder for the open jornada before a score row exists.
   * Omitted or true means the points are the stored jornada total.
   */
  scored?: boolean;
};

/**
 * Pills for the Equip strip.
 * Scored jornadas stay as stored. While the round is open, the current jornada
 * is still a pill before any score row exists: no rank, season total unchanged.
 * The placeholder points stay 0 and are not written as a score. The pill prints
 * "-" until the first match starts.
 */
export function withCurrentJornadaChip(
  rows: readonly JornadaChipPoints[],
  currentRound: number,
  pinCurrent: boolean,
  /** Provisional open-jornada total (sum of the court numbers), not stored. */
  provisionalPoints: number | null = null,
): JornadaChipPoints[] {
  const ordered = [...rows].sort((a, b) => a.round - b.round);
  if (!pinCurrent || !Number.isInteger(currentRound) || currentRound < 1) {
    return ordered;
  }
  if (ordered.some((row) => row.round === currentRound)) return ordered;
  const last = ordered[ordered.length - 1];
  const provisional =
    typeof provisionalPoints === "number" && Number.isFinite(provisionalPoints)
      ? Math.round(provisionalPoints * 10) / 10
      : null;
  const chip: JornadaChipPoints = {
    round: currentRound,
    points: provisional ?? 0,
    cumulative: (last?.cumulative ?? 0) + (provisional ?? 0),
    rank: null,
    scored: provisional != null,
  };
  return [...ordered, chip].sort((a, b) => a.round - b.round);
}

/**
 * Figure on a jornada pill.
 * The open jornada shows "-" until its first match starts. After tip-off, the
 * number is the stored total, or 0 when nobody has scored yet. Past jornadas
 * keep their stored points. The dash is not a score.
 */
export function jornadaPillFigure(input: {
  points: number;
  isCurrent: boolean;
  scored: boolean;
  /** Earliest tip-off of this jornada has been reached, or the jornada is closed. */
  matchStarted: boolean;
  historyLoaded: boolean;
}): string {
  if (input.isCurrent && !input.scored && !input.matchStarted) return "-";
  if (input.isCurrent && !input.scored && !input.historyLoaded) return "…";
  return String(input.points);
}

/**
 * While the jornada is open — lineup window or locked — its pill is selected
 * with no tap. A tapped past pill is the only other selection. Tapping the
 * current pill returns to that court. Edits stay on the open window.
 */
export function historyChipActive(input: {
  round: number;
  selectedRound: number | null;
  currentRound: number;
  pinCurrent: boolean;
}): boolean {
  if (input.selectedRound != null) return input.selectedRound === input.round;
  return input.pinCurrent && input.round === input.currentRound;
}

export function nextHistorySelection(input: {
  selectedRound: number | null;
  tappedRound: number;
  currentRound: number;
  pinCurrent: boolean;
}): number | null {
  if (input.pinCurrent && input.tappedRound === input.currentRound) return null;
  return toggleHistoryRound(input.selectedRound, input.tappedRound);
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
    const raw = courtPlayerPoints(score, captainId != null && id === captainId);
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
