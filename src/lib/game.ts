import {
  CAPTAIN_MULTIPLIER,
  GAME_VERSION,
  INITIAL_BUDGET,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  OPPONENTS,
  WIN_BONUS,
  getPlayer,
  resolvePlayerId,
} from "@/data/roster";
import type {
  GameState,
  LeagueMember,
  Lineup,
  Position,
  RoundResult,
  RoundScore,
} from "@/lib/types";

/** Map legacy / collapsed ids → current fantasy ids; drop unknown. */
export function migratePlayerIdList(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const resolved = resolvePlayerId(raw);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
    if (out.length >= LINEUP_SIZE) break;
  }
  return out;
}

/**
 * Rebuild lineup into ordered position groups (P×3, A×3, B×2).
 * Extra players that overflow a position are dropped.
 */
export function migrateLineupToPositions(ids: string[]): string[] {
  const resolved = migratePlayerIdList(ids);
  const pools: Record<Position, string[]> = { P: [], A: [], B: [] };
  for (const id of resolved) {
    const player = getPlayer(id);
    if (!player) continue;
    pools[player.position].push(id);
  }
  return [
    ...pools.P.slice(0, LINEUP_SLOTS.P),
    ...pools.A.slice(0, LINEUP_SLOTS.A),
    ...pools.B.slice(0, LINEUP_SLOTS.B),
  ];
}

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
    version: GAME_VERSION,
  };
}

export function spentBudget(playerIds: string[]): number {
  return playerIds.reduce((sum, id) => sum + (getPlayer(id)?.price ?? 0), 0);
}

/**
 * Apply buy/sell at current market quotes.
 * Selling a player credits their current price; buying deducts it.
 * `cash` is the persisted efectiu (lineups.budget), not the season ceiling.
 */
export function applyMarketTransfers(
  cash: number,
  fromIds: string[],
  toIds: string[],
): { cash: number; ok: boolean } {
  let next = cash;
  const from = new Set(fromIds.filter(Boolean));
  const to = new Set(toIds.filter(Boolean));
  for (const id of fromIds) {
    if (!id || to.has(id)) continue;
    next += getPlayer(id)?.price ?? 0;
  }
  for (const id of toIds) {
    if (!id || from.has(id)) continue;
    next -= getPlayer(id)?.price ?? 0;
  }
  return { cash: next, ok: next >= 0 };
}

/**
 * Draft remaining cash while editing locally.
 * `cash` + `savedIds` are the last persisted state; `draftIds` is the court.
 */
export function remainingBudget(
  cash: number,
  draftIds: string[],
  savedIds: string[] = draftIds,
): number {
  return applyMarketTransfers(cash, savedIds, draftIds).cash;
}

/** Squad market value = sum of current quotes for players in lineup. */
export function squadMarketValue(playerIds: string[]): number {
  return spentBudget(playerIds);
}

/** Broker patrimoni = efectiu + valor de mercat de l'alineació. */
export function patrimoni(cash: number, playerIds: string[]): number {
  return cash + squadMarketValue(playerIds);
}

export function countByPosition(playerIds: string[]): Record<Position, number> {
  const counts: Record<Position, number> = { P: 0, A: 0, B: 0 };
  for (const id of playerIds) {
    const p = getPlayer(id);
    if (p) counts[p.position] += 1;
  }
  return counts;
}

/**
 * Normalize lineup player ids from DB / API JSON.
 * Supports legacy position-keyed `{ slots: { base, aler, pivot } }` and
 * flat arrays / `{ playerIds }` / `{ slots: (string|null)[] }`.
 * Always rebuilds into ordered P→A→B groups with slot caps.
 */
export function parsePlayerIds(raw: unknown): string[] {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  let ids: string[] = [];

  if (Array.isArray(data)) {
    ids = data.filter((x): x is string => typeof x === "string" && x.length > 0);
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.playerIds)) {
      ids = obj.playerIds.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
    } else if (Array.isArray(obj.slots)) {
      ids = obj.slots.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
    } else if (
      obj.slots &&
      typeof obj.slots === "object" &&
      !Array.isArray(obj.slots)
    ) {
      const slots = obj.slots as Record<string, unknown>;
      // Legacy Catalan keys + short B/A/P keys
      for (const key of ["pivot", "P", "aler", "A", "base", "B"]) {
        const arr = slots[key];
        if (!Array.isArray(arr)) continue;
        for (const id of arr) {
          if (typeof id === "string" && id.length > 0) ids.push(id);
        }
      }
    }
  }

  return migrateLineupToPositions(ids);
}

/**
 * True when stored lineup JSON needs a rewrite: legacy shapes, collapsed
 * dual-team ids, position overflow, or ids missing from the current roster.
 */
export function needsPlayerIdsMigration(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return true;
    const asStrings = data.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    const migrated = migrateLineupToPositions(asStrings);
    if (migrated.length !== asStrings.length) return true;
    return migrated.some((id, i) => id !== asStrings[i]);
  } catch {
    return true;
  }
}

export type LineupIssue =
  | "incomplete"
  | "budget"
  | "positions"
  | "captain"
  | "duplicate";

/** Soft / full checklist (8 + captain + 3P/3A/2B). UI hints only — does not block autosave. */
export function validateLineup(
  lineup: Lineup,
  cash: number,
  savedIds: string[] = lineup.playerIds,
): { ok: boolean; issues: LineupIssue[] } {
  const issues: LineupIssue[] = [];
  const unique = new Set(lineup.playerIds);

  if (unique.size !== lineup.playerIds.length) issues.push("duplicate");
  if (lineup.playerIds.length !== LINEUP_SIZE) issues.push("incomplete");
  if (remainingBudget(cash, lineup.playerIds, savedIds) < 0) {
    issues.push("budget");
  }

  const counts = countByPosition(lineup.playerIds);
  if (
    counts.P > LINEUP_SLOTS.P ||
    counts.A > LINEUP_SLOTS.A ||
    counts.B > LINEUP_SLOTS.B ||
    (lineup.playerIds.length === LINEUP_SIZE &&
      (counts.P !== LINEUP_SLOTS.P ||
        counts.A !== LINEUP_SLOTS.A ||
        counts.B !== LINEUP_SLOTS.B))
  ) {
    issues.push("positions");
  }

  if (!lineup.captainId || !lineup.playerIds.includes(lineup.captainId)) {
    issues.push("captain");
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Hard rules for persisting a lineup (partial OK: 0–8).
 * Blocks duplicates, overspend, captain not in roster, and position overflow.
 * `cash` / `previousIds` are the last persisted row (buy/sell at current quotes).
 */
export function validateLineupSave(
  playerIds: string[],
  captainId: string | null,
  cash: number,
  previousIds: string[] = [],
): { ok: true; cash: number } | { ok: false; error: string } {
  if (playerIds.length > LINEUP_SIZE) {
    return { ok: false, error: `Com a màxim ${LINEUP_SIZE} jugadors.` };
  }
  if (new Set(playerIds).size !== playerIds.length) {
    return { ok: false, error: "No pots repetir jugadors." };
  }
  for (const id of playerIds) {
    if (!getPlayer(id)) {
      return { ok: false, error: "Jugador desconegut a l'alineació." };
    }
  }
  const counts = countByPosition(playerIds);
  if (
    counts.P > LINEUP_SLOTS.P ||
    counts.A > LINEUP_SLOTS.A ||
    counts.B > LINEUP_SLOTS.B
  ) {
    return {
      ok: false,
      error: "Posició incorrecta: cal 3 pivots, 3 alers i 2 bases.",
    };
  }
  const transfer = applyMarketTransfers(cash, previousIds, playerIds);
  if (!transfer.ok) {
    return { ok: false, error: "Has superat el pressupost disponible." };
  }
  if (captainId && !playerIds.includes(captainId)) {
    return {
      ok: false,
      error: "El capità ha de formar part de l'alineació.",
    };
  }
  return { ok: true, cash: transfer.cash };
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
  const saveCheck = validateLineupSave(
    state.lineup.playerIds,
    state.lineup.captainId,
    state.budget,
    state.lineup.playerIds,
  );
  if (!saveCheck.ok) {
    return { error: saveCheck.error };
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
      return `Calen ${LINEUP_SIZE} jugadors (3 pivots, 3 alers, 2 bases).`;
    case "budget":
      return "Has superat el pressupost disponible.";
    case "positions":
      return "La distribució de posicions no és correcta (3P · 3A · 2B).";
    case "captain":
      return "Tria un capità de l'alineació (x2 punts).";
    case "duplicate":
      return "No pots repetir jugadors.";
  }
}

export function sortedStandings(league: LeagueMember[]): LeagueMember[] {
  return [...league].sort((a, b) => b.totalPoints - a.totalPoints);
}
