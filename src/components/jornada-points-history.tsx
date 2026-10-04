"use client";

import { useManager } from "@/components/manager-provider";
import {
  pastCourtFromHistory,
  toggleHistoryRound,
  type PastCourtView,
} from "@/lib/equip-court";
import type { RoundScore } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type HistoryRow = {
  round: number;
  points: number;
  cumulative: number;
  rank: number | null;
  opponent: string;
  captainId: string | null;
  playedAt: string;
  scores: RoundScore[];
  playerIds?: string[];
};

export function JornadaPointsHistory({
  onPastCourt,
}: {
  /** Selected past jornada, or null when the court should show the current view. */
  onPastCourt?: (court: PastCourtView | null) => void;
}) {
  const { activeTeamId } = useManager();
  const [history, setHistory] = useState<{
    teamId: string | null;
    rows: HistoryRow[] | null;
  }>({ teamId: null, rows: null });
  const [selected, setSelected] = useState<{
    teamId: string | null;
    round: number | null;
  }>({ teamId: null, round: null });
  const onPastCourtRef = useRef(onPastCourt);
  useEffect(() => {
    onPastCourtRef.current = onPastCourt;
  }, [onPastCourt]);
  const rows = history.teamId === activeTeamId ? history.rows : null;
  const selectedRound = selected.teamId === activeTeamId ? selected.round : null;

  useEffect(() => {
    let cancelled = false;
    const teamId = activeTeamId;
    async function load() {
      try {
        const res = await fetch("/api/teams/scores", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setHistory((cur) =>
              cur.teamId === teamId && cur.rows != null ? cur : { teamId, rows: [] },
            );
          }
          return;
        }
        const data = (await res.json()) as { history?: HistoryRow[] };
        if (!cancelled) setHistory({ teamId, rows: data.history ?? [] });
      } catch {
        if (!cancelled) {
          setHistory((cur) =>
            cur.teamId === teamId && cur.rows != null ? cur : { teamId, rows: [] },
          );
        }
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTeamId]);

  useEffect(() => {
    const notify = onPastCourtRef.current;
    if (!notify) return;
    if (selectedRound == null || rows == null) {
      notify(null);
      return;
    }
    const row = rows.find((h) => h.round === selectedRound);
    notify(row ? pastCourtFromHistory(row) : null);
  }, [rows, selectedRound]);

  if (rows == null) {
    return (
      <p className="shrink-0 px-0.5 text-[10px] uppercase tracking-[0.14em] text-mute/70">
        Punts de jornada…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="shrink-0 px-0.5 text-[10px] text-mute/70">
        <span className="uppercase tracking-[0.14em]">Punts de jornada</span>
        <span className="mx-1.5 text-white/20">·</span>
        Encara no n’hi ha
      </p>
    );
  }

  const seasonTotal = rows[rows.length - 1]?.cumulative ?? 0;

  return (
    <div className="shrink-0 space-y-1.5 px-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-mute">
          Punts de jornada
        </p>
        <p className="text-[11px] tabular-nums text-mute">
          Temporada{" "}
          <span className="font-display text-xs text-bone/90">{seasonTotal}</span>
        </p>
      </div>
      <div
        className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Historial de punts per jornada"
      >
        {rows.map((row) => {
          const active = selectedRound === row.round;
          return (
            <button
              key={row.round}
              type="button"
              role="listitem"
              onClick={() =>
                setSelected((cur) => ({
                  teamId: activeTeamId,
                  round: toggleHistoryRound(
                    cur.teamId === activeTeamId ? cur.round : null,
                    row.round,
                  ),
                }))
              }
              className={cn(
                "group relative flex min-w-[4.75rem] shrink-0 flex-col items-stretch overflow-hidden rounded-sm px-2.5 py-1.5 text-left transition-[background-color,box-shadow,border-color] duration-200",
                "border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent",
                "hover:border-white/15 hover:from-white/[0.06]",
                active &&
                  "border-white/18 from-white/[0.07] shadow-[inset_3px_0_0_0_var(--grana-bright)]",
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-[0.18em] text-mute/80",
                  active && "text-mute",
                )}
              >
                J{row.round}
              </span>
              <span className="font-display text-[1.35rem] leading-none tabular-nums tracking-wide text-bone">
                {row.points}
              </span>
              {row.rank != null ? (
                <span
                  title="Posició"
                  className="mt-1 text-[10px] tabular-nums leading-none text-mute/90"
                >
                  #{row.rank}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
