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
import { ArrowDown, ArrowUp, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type TeamFilter = "all" | TeamId;
type PosFilter = "all" | Position;
type PriceSort = "desc" | "asc";

function fmtVal(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Shorter chip labels — full name stays in the row. */
const TEAM_CHIP: Record<TeamId, string> = {
  "masc-a": "Teixidó A",
  "masc-b": "Sifonet B",
  "fem-a": "Cudós A",
  "fem-b": "Farratges B",
};

const POSITIONS: Position[] = ["B", "A", "P"];

export function JugadorsBrowser({ players }: { players: JugadorListItem[] }) {
  const [team, setTeam] = useState<TeamFilter>("all");
  const [pos, setPos] = useState<PosFilter>("all");
  const [sort, setSort] = useState<PriceSort>("desc");

  const filtersActive = team !== "all" || pos !== "all";

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

  function clearFilters() {
    setTeam("all");
    setPos("all");
  }

  return (
    <div className="flex flex-col gap-4 pb-5">
      <header className="space-y-1">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl tracking-wide text-bone">
            Jugadors
          </h1>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 border border-line px-2.5",
              "text-[11px] font-semibold uppercase tracking-[0.14em] text-bone",
              "transition-colors hover:border-bone/40 hover:bg-white/[0.04] touch-manipulation",
            )}
            aria-label={
              sort === "desc"
                ? "Ordenat de més car a més barat. Canvia a més barat primer."
                : "Ordenat de més barat a més car. Canvia a més car primer."
            }
          >
            Preu
            {sort === "desc" ? (
              <ArrowDown className="size-3.5 text-grana-bright" aria-hidden />
            ) : (
              <ArrowUp className="size-3.5 text-grana-bright" aria-hidden />
            )}
          </button>
        </div>
        <p className="text-sm text-mute">
          Mercat del club · compara per preu i Mitj. VAL
        </p>
      </header>

      <div className="space-y-3" role="search" aria-label="Filtres de jugadors">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-mute">
            Equip
          </p>
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Equip del club"
          >
            <TeamChip
              active={team === "all"}
              onClick={() => setTeam("all")}
              label="Tots"
            />
            {TEAM_ORDER.map((id) => (
              <TeamChip
                key={id}
                active={team === id}
                onClick={() => setTeam(id)}
                label={TEAM_CHIP[id]}
                title={TEAMS[id].label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-mute">
            Posició
          </p>
          <div
            className="grid grid-cols-4 border border-line bg-panel/50"
            role="group"
            aria-label="Posició"
          >
            <PosSeg
              active={pos === "all"}
              onClick={() => setPos("all")}
              label="Totes"
            />
            {POSITIONS.map((p) => (
              <PosSeg
                key={p}
                active={pos === p}
                onClick={() => setPos(p)}
                label={p}
                title={POSITION_LABEL[p]}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
          <span className="tabular-nums text-bone">{filtered.length}</span>
          {filtered.length === 1 ? " jugador" : " jugadors"}
        </p>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-8 items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-grana-bright transition-colors hover:text-bone touch-manipulation"
          >
            <X className="size-3.5" aria-hidden />
            Esborra filtres
          </button>
        ) : (
          <p className="text-[10px] uppercase tracking-[0.12em] text-mute/70">
            VAL · PJ · Últ
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-line px-4 py-14 text-center">
          <p className="text-sm text-bone">
            Cap jugador amb aquests filtres.
          </p>
          <p className="mt-1.5 text-xs text-mute">
            Prova un altre equip o posició, o esborra els filtres.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex min-h-9 items-center border border-line px-3 text-[11px] uppercase tracking-[0.14em] text-grana-bright transition-colors hover:border-grana/60 hover:text-bone touch-manipulation"
            onClick={clearFilters}
          >
            Esborra filtres
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/jugador/${encodeURIComponent(p.id)}`}
                className="group flex items-center gap-3 py-3 transition-colors active:bg-white/[0.04] hover:bg-white/[0.025] touch-manipulation"
              >
                <PlayerAvatar
                  name={p.name}
                  photoUrl={p.photoUrl}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-tight text-bone">
                    {p.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-mute">
                    {teamLabel(p.teamId)}
                    <span className="text-mute/50"> · </span>
                    <span title={POSITION_LABEL[p.position]}>
                      {p.position}
                    </span>
                  </p>
                  <dl className="mt-1.5 flex items-baseline gap-3 text-[11px] tabular-nums">
                    <div className="flex items-baseline gap-1">
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute/80">
                        VAL
                      </dt>
                      <dd className="font-semibold text-grana-bright">
                        {fmtVal(p.avgVal)}
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute/80">
                        PJ
                      </dt>
                      <dd className="text-bone/85">{p.gamesPlayed}</dd>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute/80">
                        Últ
                      </dt>
                      <dd className="text-bone/85">{fmtVal(p.lastVal)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="shrink-0 self-center text-right">
                  <PriceLabel
                    price={p.price}
                    prevPrice={p.prevPrice}
                    className="font-display text-lg font-normal tracking-wide"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamChip({
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
        "inline-flex h-9 shrink-0 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors touch-manipulation",
        active
          ? "bg-grana text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          : "border border-line bg-transparent text-mute hover:border-bone/35 hover:text-bone",
      )}
    >
      {label}
    </button>
  );
}

function PosSeg({
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
        "flex h-9 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors touch-manipulation",
        "border-r border-line last:border-r-0",
        active
          ? "bg-grana/20 text-bone"
          : "text-mute hover:bg-white/[0.04] hover:text-bone",
      )}
    >
      {label}
    </button>
  );
}
