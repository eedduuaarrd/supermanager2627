"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { PriceLabel } from "@/components/price-label";
import {
  POSITION_LABEL,
  TEAM_ORDER,
  TEAMS,
  teamLabel,
} from "@/data/roster";
import type { JugadorListItem } from "@/lib/jugadors-list";
import type { Position, TeamId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type TeamFilter = "all" | TeamId;
type PosFilter = "all" | Position;
type PriceSort = "desc" | "asc";

function fmtVal(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const POSITIONS: Position[] = ["B", "A", "P"];

export function JugadorsBrowser({ players }: { players: JugadorListItem[] }) {
  const [team, setTeam] = useState<TeamFilter>("all");
  const [pos, setPos] = useState<PosFilter>("all");
  const [sort, setSort] = useState<PriceSort>("desc");

  const filtered = useMemo(() => {
    let list = players;
    if (team !== "all") list = list.filter((p) => p.teamId === team);
    if (pos !== "all") list = list.filter((p) => p.position === pos);
    const copy = [...list];
    copy.sort((a, b) => {
      const delta = sort === "desc" ? b.price - a.price : a.price - b.price;
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name, "ca");
    });
    return copy;
  }, [players, team, pos, sort]);

  return (
    <div className="space-y-3 pb-4">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-wide text-bone">
          Jugadors
        </h1>
        <p className="text-sm text-mute">
          Mercat del club ordenat per preu. Compara mitjanes i entra a la fitxa.
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
          {filtered.length}{" "}
          {filtered.length === 1 ? "jugador" : "jugadors"}
          {team !== "all" || pos !== "all" ? " · filtre actiu" : ""}
        </p>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
          className="inline-flex min-h-9 items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-mute transition-colors hover:text-bone touch-manipulation"
          aria-label={
            sort === "desc"
              ? "Ordenat de més car a més barat. Canvia a més barat primer."
              : "Ordenat de més barat a més car. Canvia a més car primer."
          }
        >
          {sort === "desc" ? (
            <ArrowDownWideNarrow className="size-3.5" aria-hidden />
          ) : (
            <ArrowUpNarrowWide className="size-3.5" aria-hidden />
          )}
          Preu {sort === "desc" ? "↓" : "↑"}
        </button>
      </div>

      <div className="space-y-2" role="search" aria-label="Filtres de jugadors">
        <div
          className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Equip del club"
        >
          <FilterChip
            active={team === "all"}
            onClick={() => setTeam("all")}
            label="Tots"
          />
          {TEAM_ORDER.map((id) => (
            <FilterChip
              key={id}
              active={team === id}
              onClick={() => setTeam(id)}
              label={TEAMS[id].label}
            />
          ))}
        </div>
        <div
          className="flex gap-1"
          role="group"
          aria-label="Posició"
        >
          <FilterChip
            active={pos === "all"}
            onClick={() => setPos("all")}
            label="Totes"
          />
          {POSITIONS.map((p) => (
            <FilterChip
              key={p}
              active={pos === p}
              onClick={() => setPos(p)}
              label={p}
              title={POSITION_LABEL[p]}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-line px-4 py-12 text-center">
          <p className="text-sm text-mute">
            Cap jugador amb aquests filtres.
          </p>
          <button
            type="button"
            className="mt-3 text-xs uppercase tracking-[0.14em] text-grana-bright hover:text-bone"
            onClick={() => {
              setTeam("all");
              setPos("all");
            }}
          >
            Esborra filtres
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/jugador/${encodeURIComponent(p.id)}`}
                className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors active:bg-white/[0.05] hover:bg-white/[0.03] touch-manipulation"
              >
                <PlayerAvatar
                  name={p.name}
                  photoUrl={p.photoUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-bone">
                      {p.name}
                    </p>
                    <PriceLabel
                      price={p.price}
                      prevPrice={p.prevPrice}
                      className="shrink-0 text-sm font-semibold"
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-mute">
                    <span className="text-bone/80">
                      {teamLabel(p.teamId)}
                    </span>
                    <span className="text-mute/70"> · </span>
                    <span title={POSITION_LABEL[p.position]}>{p.position}</span>
                    <span className="text-mute/70"> · </span>
                    <span>
                      Mitj. VAL{" "}
                      <span className="tabular-nums text-grana-bright">
                        {fmtVal(p.avgVal)}
                      </span>
                    </span>
                    <span className="text-mute/70"> · </span>
                    <span className="tabular-nums">PJ {p.gamesPlayed}</span>
                    {p.lastVal != null && (
                      <>
                        <span className="text-mute/70"> · </span>
                        <span className="tabular-nums">
                          Últ {fmtVal(p.lastVal)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center border px-2.5 text-[11px] uppercase tracking-[0.1em] transition-colors touch-manipulation",
        active
          ? "border-grana/80 bg-grana/15 text-bone"
          : "border-line bg-transparent text-mute hover:border-bone/35 hover:text-bone",
      )}
    >
      {label}
    </button>
  );
}
