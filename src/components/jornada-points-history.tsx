"use client";

import { useManager } from "@/components/manager-provider";
import { getPlayer, shortName } from "@/data/roster";
import type { RoundScore } from "@/lib/types";
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";

type HistoryRow = {
  round: number;
  points: number;
  cumulative: number;
  rank: number | null;
  opponent: string;
  captainId: string | null;
  playedAt: string;
  scores: RoundScore[];
};

export function JornadaPointsHistory() {
  const { activeTeamId } = useManager();
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setSelected(null);
    (async () => {
      try {
        const res = await fetch("/api/teams/scores", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setHistory([]);
          return;
        }
        const data = (await res.json()) as { history?: HistoryRow[] };
        if (!cancelled) setHistory(data.history ?? []);
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  if (history == null) {
    return (
      <div className="shrink-0 px-0.5 py-1">
        <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
          Punts de jornada
        </p>
        <p className="mt-1 text-xs text-mute/70">Carregant…</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="shrink-0 px-0.5 py-1">
        <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
          Punts de jornada
        </p>
        <p className="mt-1 text-sm text-mute">
          Encara no hi ha punts de jornada.
        </p>
      </div>
    );
  }

  const detail = selected != null ? history.find((h) => h.round === selected) : null;

  return (
    <div className="shrink-0 space-y-1.5 px-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
          Punts de jornada
        </p>
        <p className="font-display text-xs tabular-nums text-bone/80">
          Total {history[history.length - 1]?.cumulative ?? 0}
        </p>
      </div>
      <div
        className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Historial de punts per jornada"
      >
        {history.map((row) => {
          const active = selected === row.round;
          return (
            <button
              key={row.round}
              type="button"
              role="listitem"
              onClick={() =>
                setSelected((cur) => (cur === row.round ? null : row.round))
              }
              className={`flex min-w-[4.5rem] shrink-0 flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                active
                  ? "border-grana/60 bg-grana/15 text-bone"
                  : "border-line/60 bg-panel-2/40 text-bone hover:border-line"
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.12em] text-mute">
                J{row.round}
              </span>
              <span className="font-display text-base leading-tight tabular-nums">
                {row.points}
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-mute">
                Σ {row.cumulative}
                {row.rank != null ? ` · #${row.rank}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {detail ? (
        <div className="rounded-md border border-line/50 bg-ink-soft/60 px-2.5 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs text-bone">
              Jornada {detail.round}
              <span className="text-mute"> · {detail.points} pts</span>
              {detail.rank != null ? (
                <span className="text-mute"> · #{detail.rank}</span>
              ) : null}
            </p>
            <button
              type="button"
              className="text-[10px] uppercase tracking-[0.12em] text-mute hover:text-bone"
              onClick={() => setSelected(null)}
            >
              Tancar
            </button>
          </div>
          {detail.opponent ? (
            <p className="mt-0.5 truncate text-[11px] text-mute">{detail.opponent}</p>
          ) : null}
          {detail.scores.length > 0 ? (
            <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
              {detail.scores
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((s) => {
                  const player = getPlayer(s.playerId);
                  const name = player
                    ? shortName(player.name)
                    : s.playerId.slice(0, 10);
                  const isCaptain =
                    detail.captainId != null && s.playerId === detail.captainId;
                  return (
                    <li
                      key={s.playerId}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate text-bone/90">
                        {isCaptain ? (
                          <Crown className="size-3 shrink-0 text-grana-bright" />
                        ) : null}
                        <span className="truncate">{name}</span>
                        {s.dnp ? (
                          <span className="shrink-0 text-[10px] text-mute">
                            DNP
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-bone">
                        {s.points}
                      </span>
                    </li>
                  );
                })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
