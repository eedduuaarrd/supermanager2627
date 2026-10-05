/**
 * Jugadors market list — live roster + season averages from real game rows.
 * Never invents prices or stats; missing data stays null / "—".
 */
import { getLiveRoster } from "@/lib/live-roster";
import {
  fantasyStatFromGame,
  getPlayerGames,
  summarizeGames,
} from "@/lib/player-stats";
import type { Player, Position, TeamId } from "@/lib/types";

export type JugadorListItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  teamId: TeamId;
  position: Position;
  price: number;
  prevPrice: number | null;
  /** Season avg VAL from real games when available; else broker avgVal. */
  avgVal: number | null;
  /** Registered box-score count for this fantasy id. */
  gamesPlayed: number;
  /** Last registered game VAL (null if none). */
  lastVal: number | null;
};

function lastGameValFromGames(
  games: ReturnType<typeof getPlayerGames>,
): number | null {
  if (games.length === 0) return null;
  const ordered = [...games].sort((a, b) => {
    const ja = a.round ?? a.jornada ?? -1;
    const jb = b.round ?? b.jornada ?? -1;
    if (ja !== jb) return ja - jb;
    const da = a.date ?? "";
    const db = b.date ?? "";
    return da.localeCompare(db);
  });
  const last = ordered[ordered.length - 1];
  if (!last) return null;
  const scored = fantasyStatFromGame(last);
  return scored.source === "DNP" ? null : scored.points;
}

export function buildJugadorsList(): JugadorListItem[] {
  const roster = getLiveRoster();
  const items: JugadorListItem[] = roster.map((p: Player) => {
    const games = getPlayerGames(p.id);
    const summary = summarizeGames(games);
    const avgVal =
      summary.avgVal != null
        ? summary.avgVal
        : typeof p.avgVal === "number"
          ? p.avgVal
          : null;

    return {
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl,
      teamId: p.teamId,
      position: p.position,
      price: p.price,
      prevPrice: p.prevPrice ?? null,
      avgVal,
      gamesPlayed: summary.gamesPlayed,
      lastVal: lastGameValFromGames(games),
    };
  });

  // Default: highest market price first; stable name tie-break.
  items.sort((a, b) => {
    if (b.price !== a.price) return b.price - a.price;
    return a.name.localeCompare(b.name, "ca");
  });

  return items;
}
