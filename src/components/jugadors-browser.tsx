"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import {
  formatPrice,
  TEAM_ORDER,
  TEAMS,
  teamLabel,
} from "@/data/roster";
import type { JugadorListItem } from "@/lib/jugadors-list";
import { priceDelta } from "@/lib/market-price";
import type { Position, TeamId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type TeamFilter = "all" | TeamId;
type PosFilter = "all" | Position;
type PriceSort = "desc" | "asc";

function fmtVal(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Broker € delta only — never the full quote (avoids “↑ 11.500 €” confusion). */
function fmtDelta(delta: number): string {
  const abs = formatPrice(Math.abs(delta));
  return delta > 0 ? `+${abs}` : `−${abs}`;
}

/** Shorter chip labels — full name stays in the row. */
const TEAM_CHIP: Record<TeamId, string> = {
  "masc-a": "Teixidó A",
  "masc-b": "Sifonet B",
  "fem-a": "Cudós A",
  "fem-b": "Farratges B",
};

/** Full Catalan position names — never B / A / P letters on this page. */
const POS_LABEL: Record<Position, string> = {
  B: "Base",
  A: "Alero",
  P: "Pivot",
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
      <header className="space-y-2">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-bone">
            Jugadors
          </h1>
          <p className="mt-1 text-sm text-mute">
            Mercat del club · compara per preu i mitjana
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Ordena
          </span>
          <div
            className="inline-flex border border-line bg-panel/50"
            role="group"
            aria-label="Ordenació per preu"
          >
            <button
              type="button"
              aria-pressed={sort === "desc"}
              onClick={() => setSort("desc")}
              className={cn(
                "h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors touch-manipulation",
                sort === "desc"
                  ? "bg-grana text-bone"
                  : "text-mute hover:bg-white/[0.04] hover:text-bone",
              )}
            >
              Preu més alt
            </button>
            <button
              type="button"
              aria-pressed={sort === "asc"}
              onClick={() => setSort("asc")}
              className={cn(
                "h-9 border-l border-line px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors touch-manipulation",
                sort === "asc"
                  ? "bg-grana text-bone"
                  : "text-mute hover:bg-white/[0.04] hover:text-bone",
              )}
            >
              Preu més baix
            </button>
          </div>
        </div>
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
                label={POS_LABEL[p]}
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
            Mitj. · PJ · Últ
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
                    <span>{POS_LABEL[p.position]}</span>
                  </p>
                  <dl className="mt-1.5 flex items-baseline gap-3 text-[11px] tabular-nums">
                    <div className="flex items-baseline gap-1">
                      <dt className="text-[9px] uppercase tracking-[0.12em] text-mute/80">
                        Mitj.
                      </dt>
                      <dd className="font-semibold text-bone">
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

                <MarketQuote price={p.price} prevPrice={p.prevPrice} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MarketQuote({
  price,
  prevPrice,
}: {
  price: number;
  prevPrice: number | null;
}) {
  const delta = priceDelta(price, prevPrice);

  return (
    <div className="shrink-0 self-center text-right">
      <p className="font-display text-lg tabular-nums tracking-wide text-bone">
        {formatPrice(price)}
      </p>
      {delta != null && (
        <p
          className={cn(
            "mt-0.5 text-[11px] tabular-nums",
            delta > 0 ? "text-emerald-400" : "text-red-400",
          )}
          title="Variació vs cotització anterior"
        >
          {fmtDelta(delta)}
        </p>
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center px-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors touch-manipulation",
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
