import playerStatsJson from "@/data/player-stats.json";
import { getPlayer, resolvePlayerId, TEAMS } from "@/data/roster";
import type { TeamId } from "@/lib/types";
import { computeVal } from "@/lib/val";
import fs from "node:fs";
import path from "node:path";

export interface PlayerGameStat {
  date: string | null;
  /** Fantasy jornada this box score counts toward (when known). */
  round: number | null;
  /** Alias of round — kept for JSON clarity. */
  jornada?: number | null;
  opponent: string | null;
  teamId: TeamId;
  fcbqTeamId: string;
  competition?: string;
  min: number | null;
  pts: number | null;
  reb?: number | null;
  ast?: number | null;
  t2c?: number | null;
  t2i?: number | null;
  t3c?: number | null;
  t3i?: number | null;
  /** Free throws made (FCBQ TLC). */
  tlc?: number | null;
  /** Free throws attempted (FCBQ TLI). */
  tli?: number | null;
  /** Personal fouls (FCBQ FC). */
  pf?: number | null;
  /**
   * Fantasy VAL = PTS − PF − missed FT + PM (stored from computeVal).
   * Not the unpublished FCBQ Plantilla VAL column.
   */
  val: number | null;
  /** FCBQ +/- (PM / onCourtPlusMinus). */
  pm?: number | null;
  note?: string;
}

export interface PlayerStatsRecord {
  playerId: string;
  fcbqName?: string;
  fcbqPersonId?: string | null;
  teamId?: TeamId;
  games: PlayerGameStat[];
  source?: string;
  seasonNote?: string;
  number?: number | null;
}

type PlayerStatsFile = {
  extractedAt?: string;
  source?: string;
  teamUrls?: string[];
  notes?: string[];
  players: Record<string, PlayerStatsRecord>;
};

const BUNDLED = playerStatsJson as unknown as PlayerStatsFile;

/** Prefer on-disk JSON so weekly refresh/assign is visible without rebuild. */
function loadData(): PlayerStatsFile {
  try {
    const filePath = path.join(process.cwd(), "src/data/player-stats.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as PlayerStatsFile;
    }
  } catch {
    // fall through to bundled snapshot
  }
  return BUNDLED;
}

function data(): PlayerStatsFile {
  return loadData();
}

export function getPlayerStats(playerId: string): PlayerStatsRecord | null {
  const resolved = resolvePlayerId(playerId) ?? playerId;
  const players = data().players;
  return players[resolved] ?? players[playerId] ?? null;
}

export function getPlayerGames(playerId: string): PlayerGameStat[] {
  const player = getPlayer(playerId);
  const games = getPlayerStats(playerId)?.games ?? [];
  if (!player) return games;
  return games.filter((g) => g.teamId === player.teamId);
}

/** Jornada key on a game row (round or jornada alias). */
export function gameJornada(game: PlayerGameStat): number | null {
  if (typeof game.round === "number") return game.round;
  if (typeof game.jornada === "number") return game.jornada;
  return null;
}

/**
 * Fantasy points from one box score via Balaguer VAL formula
 * (PTS − PF − missed FT + PM). Recalculates from stored fields.
 * Returns DNP (0) when the player has no game / no usable components.
 */
export function fantasyStatFromGame(game: PlayerGameStat | null | undefined): {
  points: number;
  source: "VAL" | "DNP";
  minutes: number;
} {
  if (!game) {
    return { points: 0, source: "DNP", minutes: 0 };
  }
  const minutes = typeof game.min === "number" ? game.min : 0;
  const points = computeVal({
    pts: game.pts,
    pf: game.pf,
    ftm: game.tlc,
    fta: game.tli,
    pm: game.pm,
  });
  if (points == null) {
    return { points: 0, source: "DNP", minutes };
  }
  return { points, source: "VAL", minutes };
}

/** That week's game for a fantasy id (person×team) — dual-team variants stay separate. */
export function getPlayerGameForRound(
  playerId: string,
  round: number,
): PlayerGameStat | null {
  const games = getPlayerGames(playerId);
  return games.find((g) => gameJornada(g) === round) ?? null;
}

/** Season summary from real game rows only — never invent zeros. Uses Balaguer VAL. */
export function summarizeGames(games: PlayerGameStat[]) {
  if (games.length === 0) {
    return {
      gamesPlayed: 0,
      avgVal: null as number | null,
      avgPts: null as number | null,
      avgMin: null as number | null,
      totalVal: null as number | null,
      totalPts: null as number | null,
      usesPmFallback: false,
      pfCoverage: 0,
      ftCoverage: 0,
    };
  }

  const fantasyVals = games
    .map((g) => fantasyStatFromGame(g))
    .filter((x) => x.source !== "DNP")
    .map((x) => x.points);
  const pts = games.map((g) => g.pts).filter((v): v is number => v != null);
  const mins = games.map((g) => g.min).filter((v): v is number => v != null);
  const pfCoverage = games.filter((g) => typeof g.pf === "number").length;
  const ftCoverage = games.filter(
    (g) => typeof g.tlc === "number" && typeof g.tli === "number",
  ).length;

  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null;

  return {
    gamesPlayed: games.length,
    avgVal: avg(fantasyVals),
    avgPts: avg(pts),
    avgMin: avg(mins),
    totalVal: fantasyVals.length
      ? fantasyVals.reduce((a, b) => a + b, 0)
      : null,
    totalPts: pts.length ? pts.reduce((a, b) => a + b, 0) : null,
    usesPmFallback: false,
    pfCoverage,
    ftCoverage,
  };
}

export function buildPlayerDetail(playerId: string) {
  const resolved = resolvePlayerId(playerId);
  if (!resolved) return null;
  const player = getPlayer(resolved);
  if (!player) return null;

  const file = data();
  const stats = getPlayerStats(resolved);
  const games = getPlayerGames(resolved);
  const summary = summarizeGames(games);

  return {
    player,
    teams: [TEAMS[player.teamId]],
    games,
    summary,
    meta: {
      extractedAt: file.extractedAt ?? null,
      source: stats?.source ?? file.source ?? null,
      fcbqPersonId: stats?.fcbqPersonId ?? null,
      seasonNote: stats?.seasonNote ?? null,
    },
  };
}

export function playerStatsCoverage() {
  const file = data();
  const ids = Object.keys(file.players);
  const withGames = ids.filter(
    (id) => (file.players[id].games?.length ?? 0) > 0,
  );
  const gameRows = withGames.reduce(
    (n, id) => n + file.players[id].games.length,
    0,
  );
  return {
    playersInFile: ids.length,
    withGames: withGames.length,
    withoutGames: ids.length - withGames.length,
    gameRows,
    extractedAt: file.extractedAt ?? null,
  };
}
