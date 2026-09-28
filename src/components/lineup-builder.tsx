"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourtBoard } from "@/components/court-board";
import { MarketSheet } from "@/components/market-sheet";
import {
  formatPrice,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  POSITION_LABEL,
} from "@/data/roster";
import {
  countByPosition,
  issueMessage,
  projectedPoints,
  remainingBudget,
  validateLineup,
} from "@/lib/game";
import type { Lineup, Player, Position } from "@/lib/types";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<null | {
    slotIndex: number;
    position: Position;
  }>(null);

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
    if (counts[player.position] >= LINEUP_SLOTS[player.position]) return;
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

  function handleEmptySlot(slot: { slotIndex: number; position: Position }) {
    setSelectedId(null);
    setPickerSlot(slot);
  }

  function handlePickFromSheet(playerId: string) {
    addPlayer(playerId);
    setPickerSlot(null);
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

      {/* Court-only view */}
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
          Toca + a la pista per afegir un jugador
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

      <MarketSheet
        open={pickerSlot != null}
        position={pickerSlot?.position ?? null}
        roster={roster}
        takenIds={lineup.playerIds}
        remainingBudget={remaining}
        positionCounts={counts}
        lineupFull={filled >= LINEUP_SIZE}
        onPick={handlePickFromSheet}
        onClose={() => setPickerSlot(null)}
      />

      {/* Sticky selected-player actions — Fantasy LaLiga style */}
      {selectedPlayer && !lineup.confirmed && pickerSlot == null && (
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
              onClick={() => removePlayer(selectedPlayer.id)}
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
