import {
  CAPTAIN_MULTIPLIER,
  INITIAL_BUDGET,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  OPPONENTS,
  WIN_BONUS,
  getPlayer,
} from "@/data/roster";
import type {
  GameState,
  LeagueMember,
  Lineup,
  RoundResult,
  RoundScore,
} from "@/lib/types";

export function emptyLineup(): Lineup {
  return {
    playerIds: [],
    captainId: null,
    confirmed: false,
    confirmedAt: null,
  };
}

export function createInitialLeague(managerName: string): LeagueMember[] {
  const rivals: LeagueMember[] = [
    { id: "you", name: managerName || "Tu", isYou: true, totalPoints: 0, lastRoundPoints: 0 },
    { id: "rival-1", name: "Pavelló 1r d'Octubre FC", isYou: false, totalPoints: 0, lastRoundPoints: 0 },
    { id: "rival-2", name: "Grana Forever", isYou: false, totalPoints: 0, lastRoundPoints: 0 },
    { id: "rival-3", name: "Noguera Ballers", isYou: false, totalPoints: 0, lastRoundPoints: 0 },
    { id: "rival-4", name: "Mercadal Fantasy", isYou: false, totalPoints: 0, lastRoundPoints: 0 },
  ];
  return rivals;
}

export function createInitialState(managerName = "Mànager CBB"): GameState {
  return {
    managerName,
    budget: INITIAL_BUDGET,
    lineup: emptyLineup(),
    currentRound: 1,
    history: [],
    league: createInitialLeague(managerName),
    version: 1,
  };
}

export function spentBudget(playerIds: string[]): number {
  return playerIds.reduce((sum, id) => sum + (getPlayer(id)?.price ?? 0), 0);
}

export function remainingBudget(budget: number, playerIds: string[]): number {
  return budget - spentBudget(playerIds);
}

export function countByPosition(playerIds: string[]) {
  const counts = { base: 0, aler: 0, pivot: 0 };
  for (const id of playerIds) {
    const p = getPlayer(id);
    if (p) counts[p.position] += 1;
  }
  return counts;
}

export type LineupIssue =
  | "incomplete"
  | "budget"
  | "positions"
  | "captain"
  | "duplicate";

export function validateLineup(
  lineup: Lineup,
  budget: number,
): { ok: boolean; issues: LineupIssue[] } {
  const issues: LineupIssue[] = [];
  const unique = new Set(lineup.playerIds);

  if (unique.size !== lineup.playerIds.length) issues.push("duplicate");
  if (lineup.playerIds.length !== LINEUP_SIZE) issues.push("incomplete");
  if (remainingBudget(budget, lineup.playerIds) < 0) issues.push("budget");

  const counts = countByPosition(lineup.playerIds);
  if (
    counts.base !== LINEUP_SLOTS.base ||
    counts.aler !== LINEUP_SLOTS.aler ||
    counts.pivot !== LINEUP_SLOTS.pivot
  ) {
    issues.push("positions");
  }

  if (!lineup.captainId || !lineup.playerIds.includes(lineup.captainId)) {
    issues.push("captain");
  }

  return { ok: issues.length === 0, issues };
}

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulatePlayerScore(
  avgVal: number,
  rand: () => number,
  won: boolean,
): RoundScore["points"] {
  const variance = (rand() - 0.45) * 10;
  let val = Math.round(avgVal + variance);
  if (rand() < 0.08) val = Math.max(-2, val - 8); // mal dia / minuts baixos
  if (won && val > 0) val = Math.round(val * (1 + WIN_BONUS));
  return val;
}

export function simulateRound(
  state: GameState,
): { state: GameState; result: RoundResult } | { error: string } {
  const { ok, issues } = validateLineup(state.lineup, state.budget);
  if (!ok || !state.lineup.confirmed) {
    return {
      error:
        issues.includes("incomplete") || !state.lineup.confirmed
          ? "Confirma una alineació vàlida abans de tancar la jornada."
          : "L'alineació no compleix les normes del mercat.",
    };
  }

  const seed =
    state.currentRound * 997 +
    state.lineup.playerIds.reduce((a, id) => a + id.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const won = rand() > 0.42;
  const opponent = OPPONENTS[(state.currentRound - 1) % OPPONENTS.length];

  const scores: RoundScore[] = state.lineup.playerIds.map((playerId) => {
    const player = getPlayer(playerId)!;
    const base = simulatePlayerScore(player.avgVal, rand, won);
    const points =
      playerId === state.lineup.captainId ? base * CAPTAIN_MULTIPLIER : base;
    return {
      playerId,
      points,
      minutes: Math.round(18 + rand() * 16),
      winBonus: won && base > 0,
    };
  });

  const teamPoints = scores.reduce((s, x) => s + x.points, 0);
  const result: RoundResult = {
    round: state.currentRound,
    opponent,
    won,
    captainId: state.lineup.captainId,
    scores,
    teamPoints,
    playedAt: new Date().toISOString(),
  };

  const league = state.league.map((m) => {
    if (m.isYou) {
      return {
        ...m,
        lastRoundPoints: teamPoints,
        totalPoints: m.totalPoints + teamPoints,
      };
    }
    const rivalPts = Math.round(55 + rand() * 45);
    return {
      ...m,
      lastRoundPoints: rivalPts,
      totalPoints: m.totalPoints + rivalPts,
    };
  });

  return {
    result,
    state: {
      ...state,
      currentRound: state.currentRound + 1,
      history: [result, ...state.history],
      league,
      lineup: {
        ...state.lineup,
        confirmed: false,
        confirmedAt: null,
      },
    },
  };
}

export function projectedPoints(lineup: Lineup): number {
  return lineup.playerIds.reduce((sum, id) => {
    const p = getPlayer(id);
    if (!p) return sum;
    const base = p.avgVal;
    return sum + (id === lineup.captainId ? base * CAPTAIN_MULTIPLIER : base);
  }, 0);
}

export function issueMessage(issue: LineupIssue): string {
  switch (issue) {
    case "incomplete":
      return `Calen ${LINEUP_SIZE} jugadors (2 bases, 3 alers, 3 pivots).`;
    case "budget":
      return "Has superat el pressupost disponible.";
    case "positions":
      return "La distribució de posicions no és correcta.";
    case "captain":
      return "Tria un capità de l'alineació (x2 punts).";
    case "duplicate":
      return "No pots repetir jugadors.";
  }
}

export function sortedStandings(league: LeagueMember[]): LeagueMember[] {
  return [...league].sort((a, b) => b.totalPoints - a.totalPoints);
}
