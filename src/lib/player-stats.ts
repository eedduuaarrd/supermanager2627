import playerStatsJson from "@/data/player-stats.json";
import { getPlayer, resolvePlayerId, TEAMS } from "@/data/roster";
import type { TeamId } from "@/lib/types";

export interface PlayerGameStat {
  date: string | null;
  round: number | null;
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
  tlc?: number | null;
  tli?: number | null;
  val: number | null;
  note?: string;
}

export interface PlayerStatsRecord {
  playerId: string;
  fcbqName?: string;
  fcbqPersonId?: string | null;
  games: PlayerGameStat[];
  source?: string;
  seasonNote?: string;
}

type PlayerStatsFile = {
  extractedAt?: string;
  source?: string;
  teamUrls?: string[];
  notes?: string[];
  players: Record<string, PlayerStatsRecord>;
};

const DATA = playerStatsJson as unknown as PlayerStatsFile;

export function getPlayerStats(playerId: string): PlayerStatsRecord | null {
  const resolved = resolvePlayerId(playerId) ?? playerId;
  return DATA.players[resolved] ?? DATA.players[playerId] ?? null;
}

export function getPlayerGames(playerId: string): PlayerGameStat[] {
  const player = getPlayer(playerId);
  const games = getPlayerStats(playerId)?.games ?? [];
  if (!player) return games;
  return games.filter((g) => g.teamId === player.teamId);
}

/** Season summary from real game rows only — never invent zeros. */
export function summarizeGames(games: PlayerGameStat[]) {
  if (games.length === 0) {
    return {
      gamesPlayed: 0,
      avgVal: null as number | null,
      avgPts: null as number | null,
      avgMin: null as number | null,
      totalVal: null as number | null,
      totalPts: null as number | null,
    };
  }

  const vals = games.map((g) => g.val).filter((v): v is number => v != null);
  const pts = games.map((g) => g.pts).filter((v): v is number => v != null);
  const mins = games.map((g) => g.min).filter((v): v is number => v != null);

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    gamesPlayed: games.length,
    avgVal: avg(vals),
    avgPts: avg(pts),
    avgMin: avg(mins),
    totalVal: vals.length ? vals.reduce((a, b) => a + b, 0) : null,
    totalPts: pts.length ? pts.reduce((a, b) => a + b, 0) : null,
  };
}

export function buildPlayerDetail(playerId: string) {
  const resolved = resolvePlayerId(playerId);
  if (!resolved) return null;
  const player = getPlayer(resolved);
  if (!player) return null;

  const stats = getPlayerStats(resolved);
  const games = getPlayerGames(resolved);
  const summary = summarizeGames(games);

  return {
    player,
    teams: [TEAMS[player.teamId]],
    games,
    summary,
    meta: {
      extractedAt: DATA.extractedAt ?? null,
      source: stats?.source ?? DATA.source ?? null,
      fcbqPersonId: stats?.fcbqPersonId ?? null,
      seasonNote: stats?.seasonNote ?? null,
    },
  };
}

export function playerStatsCoverage() {
  const ids = Object.keys(DATA.players);
  const withGames = ids.filter((id) => (DATA.players[id].games?.length ?? 0) > 0);
  const gameRows = withGames.reduce(
    (n, id) => n + DATA.players[id].games.length,
    0,
  );
  return {
    playersInFile: ids.length,
    withGames: withGames.length,
    withoutGames: ids.length - withGames.length,
    gameRows,
    extractedAt: DATA.extractedAt ?? null,
  };
}
