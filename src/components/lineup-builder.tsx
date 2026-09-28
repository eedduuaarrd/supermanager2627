"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourtBoard } from "@/components/court-board";
import { MarketSheet } from "@/components/market-sheet";
import { formatPrice, LINEUP_SIZE } from "@/data/roster";
import {
  issueMessage,
  projectedPoints,
  remainingBudget,
  validateLineup,
} from "@/lib/game";
import type { Lineup, Player } from "@/lib/types";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  UserMinus,
} from "lucide-react";
import { useState } from "react";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const remaining = remainingBudget(budget, lineup.playerIds);
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

  const selectedPlayers = lineup.playerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  const selectedPlayer =
    selectedPlayers.find((p) => p.id === selectedId) ?? null;

  function applyLineup(playerIds: string[], captainId: string | null) {
    setConfirmAttempted(false);
    onChange({
      ...lineup,
      playerIds,
      captainId,
      confirmed: false,
      confirmedAt: null,
    });
  }

  function removePlayer(id: string) {
    if (lineup.confirmed) return;
    const playerIds = lineup.playerIds.filter((x) => x !== id);
    let captainId = lineup.captainId;
    if (captainId === id) captainId = null;
    if (selectedId === id) setSelectedId(null);
    applyLineup(playerIds, captainId);
  }

  function addPlayer(id: string) {
    if (lineup.confirmed) return;
    if (lineup.playerIds.includes(id)) return;
    if (lineup.playerIds.length >= LINEUP_SIZE) return;
    const player = roster.find((p) => p.id === id);
    if (!player) return;
    if (remaining < player.price) return;
    applyLineup([...lineup.playerIds, id], lineup.captainId);
    setSelectedId(null);
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

  function handleEmptySlot() {
    setSelectedId(null);
    setPickerOpen(true);
  }

  function handlePickFromSheet(playerId: string) {
    addPlayer(playerId);
    setPickerOpen(false);
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Compact budget strip */}
      <section className="budget-strip shrink-0 border border-line bg-panel/80 px-3 py-2 backdrop-blur-md">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
              J{currentRound}
              {saving ? " · Desant…" : ""} · restant
              <span className="mx-1 text-white/25">·</span>
              <span
                className={
                  filled === LINEUP_SIZE ? "text-grana-bright" : undefined
                }
              >
                {filled}/{LINEUP_SIZE}
              </span>
            </p>
            <p className="font-display text-xl leading-none text-bone tabular-nums sm:text-2xl">
              {formatPrice(Math.max(0, remaining))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
              Proj.
              {lineup.confirmed ? (
                <Badge className="ml-1.5 align-middle bg-emerald-700 text-[9px] text-white">
                  OK
                </Badge>
              ) : (
                <span className="ml-1.5 normal-case tracking-normal text-mute/80">
                  · capità ×2
                </span>
              )}
            </p>
            <p className="font-display text-lg leading-none text-grana-bright tabular-nums sm:text-xl">
              {projected}
            </p>
          </div>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden bg-white/10">
          <div
            className="h-full bg-grana transition-all duration-500"
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </section>

      {/* Court fills remaining viewport height */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CourtBoard
          players={selectedPlayers}
          captainId={lineup.captainId}
          confirmed={lineup.confirmed}
          selectedId={selectedId}
          onSelect={lineup.confirmed ? undefined : setSelectedId}
          onEmptySlot={lineup.confirmed ? undefined : handleEmptySlot}
          fillHeight
        />
      </section>

      {!lineup.confirmed && incomplete && !showHarshValidation && filled === 0 && (
        <p className="shrink-0 px-0.5 text-center text-xs text-mute">
          Toca + a la pista per afegir un jugador
        </p>
      )}

      {showHarshValidation && (
        <div className="flex shrink-0 gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <ul className="space-y-0.5">
            {validation.issues.map((issue) => (
              <li key={issue}>{issueMessage(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex shrink-0 gap-2 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        disabled={confirming || lineup.confirmed}
        onClick={handleConfirmClick}
        className="h-11 w-full shrink-0 bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright disabled:opacity-60"
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

      <MarketSheet
        open={pickerOpen}
        roster={roster}
        takenIds={lineup.playerIds}
        remainingBudget={remaining}
        lineupFull={filled >= LINEUP_SIZE}
        onPick={handlePickFromSheet}
        onClose={() => setPickerOpen(false)}
      />

      {selectedPlayer && !lineup.confirmed && !pickerOpen && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-ink/95 px-4 py-2.5 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-lg items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-bone">
                {selectedPlayer.name}
              </p>
              <p className="text-xs text-mute">VAL {selectedPlayer.avgVal}</p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={() => setCaptain(selectedPlayer.id)}
              className={
                lineup.captainId === selectedPlayer.id
                  ? "h-11 shrink-0 bg-grana text-bone hover:bg-grana-bright"
                  : "h-11 shrink-0 border border-line bg-panel-2 text-bone hover:bg-white/10"
              }
            >
              <Crown className="size-4" /> Capità
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => removePlayer(selectedPlayer.id)}
              className="h-11 shrink-0 bg-bone text-ink hover:bg-white"
            >
              <UserMinus className="size-4" /> Treure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
