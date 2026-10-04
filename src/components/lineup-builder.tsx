"use client";

import { CourtBoard } from "@/components/court-board";
import { MarketSheet } from "@/components/market-sheet";
import type { SaveStatus } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  getPlayer,
  LINEUP_SIZE,
  LINEUP_SLOTS,
  POSITION_LABEL,
} from "@/data/roster";
import { formatCourtPoints } from "@/lib/equip-court";
import {
  countByPosition,
  issueMessage,
  remainingBudget,
  validateLineup,
} from "@/lib/game";
import type { Lineup, Player, Position } from "@/lib/types";
import { AlertCircle, Crown, UserMinus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface LineupBuilderProps {
  roster: Player[];
  budget: number;
  /** Last persisted ids (cash ledger baseline). Defaults to current lineup. */
  savedPlayerIds?: string[];
  lineup: Lineup;
  onChange: (lineup: Lineup) => void;
  saving?: boolean;
  saveStatus?: SaveStatus;
  error?: string | null;
  /** Tip-off / jornada lock — court becomes read-only. */
  readOnly?: boolean;
  /**
   * `points`: raw jornada number, or "-" when that player has no score.
   * `price`: quote only (editable window, and the next jornada after Sunday close).
   */
  caption?: "price" | "points";
  /** Raw VAL by player id. Used only when `caption` is `points`. */
  playedVals?: Record<string, number>;
  /**
   * When set, the court shows this squad instead of the editable lineup
   * (a past jornada). Edits stay disabled and the lock banner stays hidden.
   */
  courtPlayerIds?: string[];
  courtCaptainId?: string | null;
}

function softHint(
  filled: number,
  hasCaptain: boolean,
  counts: Record<Position, number>,
): string | null {
  if (filled === 0) return "Toca + per afegir";
  if (filled < LINEUP_SIZE) {
    const missing: string[] = [];
    (Object.keys(LINEUP_SLOTS) as Position[]).forEach((pos) => {
      const need = LINEUP_SLOTS[pos] - counts[pos];
      if (need > 0) {
        const label = POSITION_LABEL[pos].toLowerCase();
        missing.push(need === 1 ? label : `${need} ${label}s`);
      }
    });
    return missing.length ? `Falta ${missing.join(", ")}` : `Falten ${LINEUP_SIZE - filled}`;
  }
  if (!hasCaptain) return "Tria capità";
  return null;
}

function saveFeedback(
  status: SaveStatus | undefined,
  error?: string | null,
): { text: string; tone: string } | null {
  if (status === "saving") return { text: "Desant…", tone: "text-mute" };
  if (status === "saved") return { text: "Desat", tone: "text-emerald-400" };
  if (status === "error" || error)
    return { text: "Error en desar", tone: "text-red-300" };
  return null;
}

export function LineupBuilder({
  roster,
  budget,
  savedPlayerIds,
  lineup,
  onChange,
  saveStatus,
  error,
  readOnly = false,
  caption = "price",
  playedVals,
  courtPlayerIds,
  courtCaptainId = null,
}: LineupBuilderProps) {
  const historyView = courtPlayerIds != null;
  const editsLocked = readOnly || historyView;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<null | {
    slotIndex: number;
    position: Position;
  }>(null);

  const sheetOpen = selectedId != null && pickerSlot == null;

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const committedIds = savedPlayerIds ?? lineup.playerIds;
  const priceOf = (id: string) =>
    roster.find((p) => p.id === id)?.price ?? 0;
  const remaining = remainingBudget(
    budget,
    lineup.playerIds,
    committedIds,
    priceOf,
  );
  const counts = countByPosition(lineup.playerIds);
  const validation = validateLineup(lineup, budget, committedIds, priceOf);
  const filled = lineup.playerIds.length;
  const overBudget = remaining < 0;
  const showHarshValidation =
    overBudget ||
    validation.issues.includes("duplicate") ||
    validation.issues.includes("positions");
  const feedback = saveFeedback(saveStatus, error);
  const hint = softHint(filled, Boolean(lineup.captainId), counts);

  const displayIds = courtPlayerIds ?? lineup.playerIds;
  const displayCaptainId = historyView ? courtCaptainId : lineup.captainId;
  const selectedPlayers = displayIds
    .map((id) => roster.find((p) => p.id === id) ?? getPlayer(id))
    .filter((p): p is Player => Boolean(p));

  const selectedPlayer =
    selectedPlayers.find((p) => p.id === selectedId) ?? null;

  function applyLineup(playerIds: string[], captainId: string | null) {
    onChange({
      ...lineup,
      playerIds,
      captainId,
      confirmed: false,
      confirmedAt: null,
    });
  }

  function removePlayer(id: string) {
    if (editsLocked) return;
    const playerIds = lineup.playerIds.filter((x) => x !== id);
    let captainId = lineup.captainId;
    if (captainId === id) captainId = null;
    if (selectedId === id) setSelectedId(null);
    applyLineup(playerIds, captainId);
  }

  function addPlayer(id: string, position: Position) {
    if (editsLocked) return;
    if (lineup.playerIds.includes(id)) return;
    if (lineup.playerIds.length >= LINEUP_SIZE) return;
    const player = roster.find((p) => p.id === id);
    if (!player) return;
    if (player.position !== position) return;
    if (counts[position] >= LINEUP_SLOTS[position]) return;
    if (remaining < player.price) return;
    applyLineup([...lineup.playerIds, id], lineup.captainId);
    setSelectedId(null);
  }

  function setCaptain(id: string) {
    if (editsLocked) return;
    onChange({
      ...lineup,
      captainId: id,
      confirmed: false,
      confirmedAt: null,
    });
  }

  function handleEmptySlot(slot: { slotIndex: number; position: Position }) {
    if (editsLocked) return;
    setSelectedId(null);
    setPickerSlot(slot);
  }

  function handlePickFromSheet(playerId: string) {
    if (!pickerSlot) return;
    addPlayer(playerId, pickerSlot.position);
    setPickerSlot(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-baseline justify-between gap-2 px-0.5 text-xs text-mute">
        <p className="min-w-0 tabular-nums" aria-label="Pressupost i places">
          <span className={filled === LINEUP_SIZE ? "text-bone/80" : undefined}>
            {filled}/{LINEUP_SIZE}
          </span>
          <span className="mx-1.5 text-white/20">·</span>
          <span className={overBudget ? "text-amber-200" : "text-bone"}>
            {formatPrice(remaining)}
          </span>
          {hint ? (
            <>
              <span className="mx-1.5 text-white/20">·</span>
              <span>{hint}</span>
            </>
          ) : null}
        </p>
        <p className="shrink-0 tabular-nums">
          {feedback ? (
            <span className={feedback.tone} aria-live="polite">
              {feedback.text}
            </span>
          ) : null}
        </p>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CourtBoard
          players={selectedPlayers}
          captainId={displayCaptainId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEmptySlot={editsLocked ? undefined : handleEmptySlot}
          fillHeight
          caption={caption}
          jornadaPointsById={caption === "points" ? (playedVals ?? {}) : undefined}
        />
      </section>

      {showHarshValidation && (
        <div className="flex shrink-0 gap-2 px-0.5 py-1 text-xs text-amber-100/90">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <ul className="space-y-0.5">
            {validation.issues
              .filter(
                (i) =>
                  i === "budget" || i === "duplicate" || i === "positions",
              )
              .map((issue) => (
                <li key={issue}>{issueMessage(issue)}</li>
              ))}
          </ul>
        </div>
      )}

      {error && saveStatus === "error" && (
        <div
          role="alert"
          className="flex shrink-0 gap-2 border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!editsLocked && (
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
      )}

      {sheetOpen && selectedPlayer && (
        <>
          <button
            type="button"
            aria-label="Tancar accions"
            className="fixed inset-0 z-[35] cursor-default bg-black/25"
            onClick={() => setSelectedId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Accions per a ${selectedPlayer.name}`}
            className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 border-t border-line bg-ink/95 px-4 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md"
          >
            <div className="mx-auto flex w-full max-w-lg items-center gap-2.5 md:max-w-xl lg:max-w-2xl">
              <Link
                href={`/jugador/${selectedPlayer.id}`}
                className="min-h-11 min-w-0 flex-1 touch-manipulation py-1"
              >
                <p className="truncate text-sm font-semibold text-bone underline-offset-2 hover:underline">
                  {selectedPlayer.name}
                </p>
                <p className="text-xs text-mute">
                  {caption === "points"
                    ? `${
                        playedVals && selectedPlayer.id in playedVals
                          ? formatCourtPoints(playedVals[selectedPlayer.id])
                          : "-"
                      } · Veure fitxa`
                    : `VAL ${selectedPlayer.avgVal} · Veure fitxa`}
                </p>
              </Link>
              {!editsLocked && (
                <>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCaptain(selectedPlayer.id)}
                    className={
                      lineup.captainId === selectedPlayer.id
                        ? "h-11 min-h-11 shrink-0 touch-manipulation bg-grana text-bone hover:bg-grana-bright"
                        : "h-11 min-h-11 shrink-0 touch-manipulation border border-line bg-panel-2 text-bone hover:bg-white/10"
                    }
                  >
                    <Crown className="size-4" /> Capità
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => removePlayer(selectedPlayer.id)}
                    className="h-11 min-h-11 shrink-0 touch-manipulation bg-bone text-ink hover:bg-white"
                  >
                    <UserMinus className="size-4" /> Treure
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
