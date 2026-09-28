"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourtBoard } from "@/components/court-board";
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
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  UserMinus,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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

function softProgressLabel(
  counts: Record<Position, number>,
  filled: number,
): string {
  const missing: string[] = [];
  (Object.keys(LINEUP_SLOTS) as Position[]).forEach((pos) => {
    const need = LINEUP_SLOTS[pos] - counts[pos];
    if (need > 0) {
      const label = POSITION_LABEL[pos].toLowerCase();
      missing.push(need === 1 ? label : `${need} ${label}s`);
    }
  });
  const miss = missing.length ? ` · falta ${missing.join(", ")}` : "";
  return `${filled}/${LINEUP_SIZE}${miss}`;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const marketRef = useRef<HTMLElement | null>(null);

  const remaining = remainingBudget(budget, lineup.playerIds);
  const counts = countByPosition(lineup.playerIds);
  const validation = validateLineup(lineup, budget);
  const projected = projectedPoints(lineup);
  const spentPct = Math.min(
    100,
    Math.round(((budget - remaining) / budget) * 100),
  );
  const filled = lineup.playerIds.length;
  const incomplete = filled < LINEUP_SIZE;
  const overBudget = remaining < 0;
  const showHarshValidation =
    !lineup.confirmed &&
    (confirmAttempted ||
      overBudget ||
      (filled === LINEUP_SIZE && !validation.ok));

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
    .filter(Boolean) as Player[];

  const selectedPlayer =
    selectedPlayers.find((p) => p.id === selectedId) ?? null;

  function togglePlayer(id: string) {
    if (lineup.confirmed) return;
    const exists = lineup.playerIds.includes(id);
    let playerIds: string[];
    let captainId = lineup.captainId;

    if (exists) {
      playerIds = lineup.playerIds.filter((x) => x !== id);
      if (captainId === id) captainId = null;
      if (selectedId === id) setSelectedId(null);
    } else {
      if (lineup.playerIds.length >= LINEUP_SIZE) return;
      const player = roster.find((p) => p.id === id);
      if (!player) return;
      if (counts[player.position] >= LINEUP_SLOTS[player.position]) return;
      if (remaining < player.price) return;
      playerIds = [...lineup.playerIds, id];
      setSelectedId(null);
    }

    setConfirmAttempted(false);
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

  function handleEmptySlot(position: Position) {
    setFilter(position);
    setSelectedId(null);
    requestAnimationFrame(() => {
      marketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleConfirmClick() {
    if (lineup.confirmed || confirming) return;
    if (!validation.ok) {
      setConfirmAttempted(true);
      return;
    }
    setConfirmAttempted(false);
    onConfirm();
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Compact budget strip — single source of position counts */}
      <section className="budget-strip sticky top-0 z-20 border border-line bg-panel/80 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
              J{currentRound}
              {saving ? " · Desant…" : ""} · restant
            </p>
            <p className="font-display text-2xl leading-none text-bone tabular-nums">
              {formatPrice(Math.max(0, remaining))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
              Proj.
            </p>
            <p className="font-display text-xl leading-none text-grana-bright tabular-nums">
              {projected}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden bg-white/10">
          <div
            className="h-full bg-grana transition-all duration-500"
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-mute">
          {(Object.keys(LINEUP_SLOTS) as Position[]).map((pos) => (
            <span
              key={pos}
              className={
                counts[pos] === LINEUP_SLOTS[pos]
                  ? "text-grana-bright"
                  : "text-mute"
              }
            >
              {POSITION_LABEL[pos]} {counts[pos]}/{LINEUP_SLOTS[pos]}
            </span>
          ))}
          <span
            className={
              filled === LINEUP_SIZE ? "text-grana-bright" : "text-mute"
            }
          >
            · {filled}/{LINEUP_SIZE}
          </span>
        </div>
      </section>

      {/* Court */}
      <section className="overflow-hidden">
        <header className="mb-1.5 flex items-center justify-between px-0.5">
          <h2 className="font-display text-xl tracking-wide text-bone">
            El teu equip
          </h2>
          {lineup.confirmed ? (
            <Badge className="bg-emerald-700 text-white">Confirmada</Badge>
          ) : (
            <p className="text-[11px] text-mute">capità ×2</p>
          )}
        </header>
        <CourtBoard
          players={selectedPlayers}
          captainId={lineup.captainId}
          confirmed={lineup.confirmed}
          selectedId={selectedId}
          onSelect={lineup.confirmed ? undefined : setSelectedId}
          onEmptySlot={lineup.confirmed ? undefined : handleEmptySlot}
        />
      </section>

      {/* Soft progress (incomplete, before confirm attempt) */}
      {!lineup.confirmed && incomplete && !showHarshValidation && filled > 0 && (
        <p className="px-0.5 text-sm text-mute">
          {softProgressLabel(counts, filled)}
        </p>
      )}
      {!lineup.confirmed && filled === 0 && (
        <p className="px-0.5 text-sm text-mute">
          Toca + a la pista o afegeix des del mercat
        </p>
      )}

      {showHarshValidation && (
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
        disabled={confirming || lineup.confirmed}
        onClick={handleConfirmClick}
        className="h-12 w-full bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright disabled:opacity-60"
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

      <section
        ref={marketRef}
        className="overflow-hidden border border-line bg-panel/80"
      >
        <header className="space-y-2.5 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-xl tracking-wide text-bone">
              Mercat CBB
            </h2>
            <p className="mt-0.5 text-xs text-mute">
              Toca un jugador per omplir el següent slot lliure
            </p>
          </div>
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

      {/* Sticky selected-player actions — Fantasy LaLiga style */}
      {selectedPlayer && !lineup.confirmed && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-lg items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-bone">
                {selectedPlayer.name}
              </p>
              <p className="text-xs text-mute">
                {POSITION_LABEL[selectedPlayer.position]} · VAL{" "}
                {selectedPlayer.avgVal}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={() => setCaptain(selectedPlayer.id)}
              className={
                lineup.captainId === selectedPlayer.id
                  ? "h-12 shrink-0 bg-grana text-bone hover:bg-grana-bright"
                  : "h-12 shrink-0 border border-line bg-panel-2 text-bone hover:bg-white/10"
              }
            >
              <Crown className="size-4" /> Capità
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => togglePlayer(selectedPlayer.id)}
              className="h-12 shrink-0 bg-bone text-ink hover:bg-white"
            >
              <UserMinus className="size-4" /> Treure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
