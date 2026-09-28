"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  POSITION_LABEL,
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
import type { Lineup, Player, Position, TeamId } from "@/lib/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlayerRow } from "@/components/player-row";

interface LineupBuilderProps {
  roster: Player[];
  budget: number;
  lineup: Lineup;
  currentRound: number;
  onChange: (lineup: Lineup) => void;
  onConfirm: () => void;
  confirming?: boolean;
  saving?: boolean;
  error?: string | null;
}

export function LineupBuilder({
  roster,
  budget,
  lineup,
  currentRound,
  onChange,
  onConfirm,
  confirming,
  saving,
  error,
}: LineupBuilderProps) {
  const [filter, setFilter] = useState<Position | "all">("all");
  const [teamFilter, setTeamFilter] = useState<TeamId | "all">("all");
  const remaining = remainingBudget(budget, lineup.playerIds);
  const counts = countByPosition(lineup.playerIds);
  const validation = validateLineup(lineup, budget);
  const projected = projectedPoints(lineup);
  const spentPct = Math.min(
    100,
    Math.round(((budget - remaining) / budget) * 100),
  );

  const market = useMemo(() => {
    return roster
      .filter((p) => {
        if (lineup.playerIds.includes(p.id)) return false;
        if (filter !== "all" && p.position !== filter) return false;
        if (teamFilter !== "all" && !p.teamIds.includes(teamFilter)) return false;
        return true;
      })
      .sort((a, b) => b.price - a.price);
  }, [filter, teamFilter, lineup.playerIds, roster]);

  const selectedPlayers = lineup.playerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter(Boolean);

  function togglePlayer(id: string) {
    if (lineup.confirmed) return;
    const exists = lineup.playerIds.includes(id);
    let playerIds: string[];
    let captainId = lineup.captainId;

    if (exists) {
      playerIds = lineup.playerIds.filter((x) => x !== id);
      if (captainId === id) captainId = null;
    } else {
      if (lineup.playerIds.length >= LINEUP_SIZE) return;
      const player = roster.find((p) => p.id === id);
      if (!player) return;
      if (counts[player.position] >= LINEUP_SLOTS[player.position]) return;
      if (remaining < player.price) return;
      playerIds = [...lineup.playerIds, id];
    }

    onChange({
      ...lineup,
      playerIds,
      captainId,
      confirmed: false,
      confirmedAt: null,
    });
  }

  function setCaptain(id: string) {
    if (lineup.confirmed) return;
    onChange({
      ...lineup,
      captainId: id,
      confirmed: false,
      confirmedAt: null,
    });
  }

  return (
    <div className="space-y-4">
      <section className="border border-line bg-panel/90 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mute">
              Mercat · Jornada {currentRound}
              {saving ? " · Desant…" : ""}
            </p>
            <p className="mt-1 font-display text-3xl text-bone">
              {formatPrice(Math.max(0, remaining))}
            </p>
            <p className="text-sm text-mute">pressupost restant</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-mute">Proj. jornada</p>
            <p className="font-display text-2xl text-grana-bright">{projected}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden bg-white/10">
          <div
            className="h-full bg-grana transition-all duration-500"
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
                  ? "border-grana/60 text-grana-bright"
                  : "border-line text-mute"
              }
            >
              {POSITION_LABEL[pos]} {counts[pos]}/{LINEUP_SLOTS[pos]}
            </Badge>
          ))}
          <Badge
            variant="outline"
            className={
              lineup.playerIds.length === LINEUP_SIZE
                ? "border-grana/60 text-grana-bright"
                : "border-line text-mute"
            }
          >
            {lineup.playerIds.length}/{LINEUP_SIZE} jugadors
          </Badge>
        </div>
      </section>

      <section className="overflow-hidden border border-line bg-panel/80">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-xl tracking-wide text-bone">
            Alineació
          </h2>
          {lineup.confirmed && (
            <Badge className="bg-emerald-700 text-white">Confirmada</Badge>
          )}
        </header>
        {selectedPlayers.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-medium text-bone">Sense jugadors</p>
            <p className="mt-1 text-sm text-mute">
              Afegeix 2 bases, 3 alers i 3 pivots. El capità suma el doble.
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
                  isCaptain={lineup.captainId === player.id}
                  action={lineup.confirmed ? "none" : "remove"}
                  onAction={() => togglePlayer(player.id)}
                  onCaptain={
                    lineup.confirmed ? undefined : () => setCaptain(player.id)
                  }
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      {!validation.ok && selectedPlayers.length > 0 && (
        <div className="flex gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-1">
            {validation.issues.map((issue) => (
              <li key={issue}>{issueMessage(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex gap-2 border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        disabled={!validation.ok || confirming || lineup.confirmed}
        onClick={onConfirm}
        className="h-12 w-full bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
      >
        {confirming ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Confirmant…
          </>
        ) : lineup.confirmed ? (
          <>
            <CheckCircle2 className="size-4" /> Alineació confirmada
          </>
        ) : (
          "Confirmar alineació"
        )}
      </Button>

      <section className="overflow-hidden border border-line bg-panel/80">
        <header className="space-y-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-xl tracking-wide text-bone">
            Mercat CBB
          </h2>
          <p className="text-xs text-mute">
            {roster.length} jugadors FCBQ · fotos oficials quan el CDN les
            publiqui; si no, silueta amb inicials.
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
                    ? "bg-grana text-bone hover:bg-grana-bright"
                    : "text-mute hover:bg-white/10 hover:text-bone"
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
                  ? "bg-panel-2 text-bone ring-1 ring-white/20"
                  : "text-mute hover:bg-white/10 hover:text-bone"
              }
            >
              Equips
            </Button>
            {TEAM_ORDER.map((tid) => (
              <Button
                key={tid}
                type="button"
                size="sm"
                variant={teamFilter === tid ? "default" : "ghost"}
                onClick={() => setTeamFilter(tid)}
                className={
                  teamFilter === tid
                    ? "bg-panel-2 text-bone ring-1 ring-white/20"
                    : "text-mute hover:bg-white/10 hover:text-bone"
                }
                title={TEAMS[tid].fullName}
              >
                {TEAMS[tid].label}
              </Button>
            ))}
          </div>
        </header>
        {teamFilter === "masc-b" && !TEAMS["masc-b"].rosterAvailable ? (
          <div className="px-4 py-8 text-center text-sm text-mute">
            <p className="font-medium text-bone">Lo Sifonet CB Balaguer B</p>
            <p className="mt-1">
              L&apos;FCBQ encara no publica plantilla per a aquest equip.
            </p>
          </div>
        ) : market.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-mute">
            No hi ha més jugadors amb aquest filtre.
          </div>
        ) : (
          <div>
            {market.map((player) => {
              const posFull =
                counts[player.position] >= LINEUP_SLOTS[player.position];
              const tooExpensive = remaining < player.price;
              const full = lineup.playerIds.length >= LINEUP_SIZE;
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  action={lineup.confirmed ? "none" : "add"}
                  disabled={
                    lineup.confirmed || posFull || tooExpensive || full
                  }
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
