"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  POSITION_LABEL,
  ROSTER,
  TEAM_ORDER,
  TEAMS,
} from "@/data/roster";
import {
  countByPosition,
  issueMessage,
  projectedPoints,
  remainingBudget,
  validateLineup,
} from "@/lib/game";
import type { GameState, Position, TeamId } from "@/lib/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlayerRow } from "@/components/player-row";

interface LineupBuilderProps {
  state: GameState;
  onChange: (next: GameState) => void;
  onConfirm: () => void;
  confirming?: boolean;
  error?: string | null;
}

export function LineupBuilder({
  state,
  onChange,
  onConfirm,
  confirming,
  error,
}: LineupBuilderProps) {
  const [filter, setFilter] = useState<Position | "all">("all");
  const [teamFilter, setTeamFilter] = useState<TeamId | "all">("all");
  const remaining = remainingBudget(state.budget, state.lineup.playerIds);
  const counts = countByPosition(state.lineup.playerIds);
  const validation = validateLineup(state.lineup, state.budget);
  const projected = projectedPoints(state.lineup);
  const spentPct = Math.min(
    100,
    Math.round(((state.budget - remaining) / state.budget) * 100),
  );

  const market = useMemo(() => {
    return ROSTER.filter((p) => {
      if (state.lineup.playerIds.includes(p.id)) return false;
      if (filter !== "all" && p.position !== filter) return false;
      if (teamFilter !== "all" && !p.teamIds.includes(teamFilter)) return false;
      return true;
    }).sort((a, b) => b.price - a.price);
  }, [filter, teamFilter, state.lineup.playerIds]);

  const selectedPlayers = state.lineup.playerIds
    .map((id) => ROSTER.find((p) => p.id === id))
    .filter(Boolean);

  function togglePlayer(id: string) {
    const exists = state.lineup.playerIds.includes(id);
    let playerIds: string[];
    let captainId = state.lineup.captainId;

    if (exists) {
      playerIds = state.lineup.playerIds.filter((x) => x !== id);
      if (captainId === id) captainId = null;
    } else {
      if (state.lineup.playerIds.length >= LINEUP_SIZE) return;
      const player = ROSTER.find((p) => p.id === id);
      if (!player) return;
      if (counts[player.position] >= LINEUP_SLOTS[player.position]) return;
      if (remaining < player.price) return;
      playerIds = [...state.lineup.playerIds, id];
    }

    onChange({
      ...state,
      lineup: {
        ...state.lineup,
        playerIds,
        captainId,
        confirmed: false,
        confirmedAt: null,
      },
    });
  }

  function setCaptain(id: string) {
    onChange({
      ...state,
      lineup: {
        ...state.lineup,
        captainId: id,
        confirmed: false,
        confirmedAt: null,
      },
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-navy/70 p-4 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold/80">
              Mercat · Jornada {state.currentRound}
            </p>
            <p className="mt-1 font-display text-3xl text-cream">
              {formatPrice(Math.max(0, remaining))}
            </p>
            <p className="text-sm text-cream/55">pressupost restant</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-cream/50">Proj. jornada</p>
            <p className="font-display text-2xl text-gold">{projected}</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(LINEUP_SLOTS) as Position[]).map((pos) => (
            <Badge
              key={pos}
              variant="outline"
              className={
                counts[pos] === LINEUP_SLOTS[pos]
                  ? "border-gold/50 text-gold"
                  : "border-white/20 text-cream/70"
              }
            >
              {POSITION_LABEL[pos]} {counts[pos]}/{LINEUP_SLOTS[pos]}
            </Badge>
          ))}
          <Badge
            variant="outline"
            className={
              state.lineup.playerIds.length === LINEUP_SIZE
                ? "border-gold/50 text-gold"
                : "border-white/20 text-cream/70"
            }
          >
            {state.lineup.playerIds.length}/{LINEUP_SIZE} jugadors
          </Badge>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy/60">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-xl tracking-wide text-cream">
            La teva alineació
          </h2>
          {state.lineup.confirmed && (
            <Badge className="bg-emerald-600 text-white">Confirmada</Badge>
          )}
        </header>
        {selectedPlayers.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-medium text-cream">Encara no tens jugadors</p>
            <p className="mt-1 text-sm text-cream/55">
              Afegeix 2 bases, 3 alers i 3 pivots des del mercat. El capità suma el
              doble.
            </p>
          </div>
        ) : (
          <div>
            {selectedPlayers.map((player) =>
              player ? (
                <PlayerRow
                  key={player.id}
                  player={player}
                  selected
                  isCaptain={state.lineup.captainId === player.id}
                  action="remove"
                  onAction={() => togglePlayer(player.id)}
                  onCaptain={() => setCaptain(player.id)}
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      {!validation.ok && selectedPlayers.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-1">
            {validation.issues.map((issue) => (
              <li key={issue}>{issueMessage(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        disabled={!validation.ok || confirming}
        onClick={onConfirm}
        className="h-12 w-full bg-gold font-semibold text-navy-deep hover:bg-gold/90"
      >
        {confirming ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Confirmant…
          </>
        ) : state.lineup.confirmed ? (
          <>
            <CheckCircle2 className="size-4" /> Alineació confirmada
          </>
        ) : (
          "Confirmar alineació"
        )}
      </Button>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy/60">
        <header className="space-y-3 border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-xl tracking-wide text-cream">
            Mercat CBB · FCBQ
          </h2>
          <p className="text-xs text-cream/50">
            {ROSTER.length} jugadors dels sèniors amb estadístiques FCBQ. Lo Sifonet
            B encara no té plantilla publicada.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["all", "base", "aler", "pivot"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "ghost"}
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? "bg-grana text-cream hover:bg-grana-bright"
                    : "text-cream/70 hover:bg-white/10 hover:text-cream"
                }
              >
                {key === "all" ? "Tots" : POSITION_LABEL[key]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={teamFilter === "all" ? "default" : "ghost"}
              onClick={() => setTeamFilter("all")}
              className={
                teamFilter === "all"
                  ? "bg-gold text-navy-deep hover:bg-gold/90"
                  : "text-cream/70 hover:bg-white/10 hover:text-cream"
              }
            >
              Tots els equips
            </Button>
            {TEAM_ORDER.map((tid) => (
              <Button
                key={tid}
                type="button"
                size="sm"
                variant={teamFilter === tid ? "default" : "ghost"}
                onClick={() => setTeamFilter(tid)}
                disabled={!TEAMS[tid].rosterAvailable && tid === "masc-b"}
                className={
                  teamFilter === tid
                    ? "bg-gold text-navy-deep hover:bg-gold/90"
                    : "text-cream/70 hover:bg-white/10 hover:text-cream"
                }
                title={TEAMS[tid].fullName}
              >
                {TEAMS[tid].label}
                {!TEAMS[tid].rosterAvailable ? " · —" : ""}
              </Button>
            ))}
          </div>
        </header>
        {teamFilter === "masc-b" ? (
          <div className="px-4 py-8 text-center text-sm text-cream/55">
            <p className="font-medium text-cream">Lo Sifonet CB Balaguer B</p>
            <p className="mt-1">
              L&apos;FCBQ encara no publica estadístiques ni plantilla per a aquest
              equip (2A Territorial Senior Masculí).
            </p>
          </div>
        ) : market.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-cream/55">
            No hi ha més jugadors amb aquest filtre.
          </div>
        ) : (
          <div>
            {market.map((player) => {
              const posFull = counts[player.position] >= LINEUP_SLOTS[player.position];
              const tooExpensive = remaining < player.price;
              const full = state.lineup.playerIds.length >= LINEUP_SIZE;
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  action="add"
                  disabled={posFull || tooExpensive || full}
                  onAction={() => togglePlayer(player.id)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
