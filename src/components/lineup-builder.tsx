"use client";

import { CourtBoard } from "@/components/court-board";
import { MarketSheet } from "@/components/market-sheet";
import type { SaveStatus } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import { formatPrice, LINEUP_SIZE } from "@/data/roster";
import {
  issueMessage,
  projectedPoints,
  remainingBudget,
  validateLineup,
} from "@/lib/game";
import type { Lineup, Player } from "@/lib/types";
import { AlertCircle, Crown, UserMinus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface LineupBuilderProps {
  roster: Player[];
  budget: number;
  lineup: Lineup;
  currentRound: number;
  onChange: (lineup: Lineup) => void;
  saving?: boolean;
  saveStatus?: SaveStatus;
  error?: string | null;
  /** Tip-off / jornada lock — court becomes read-only. */
  readOnly?: boolean;
  lockMessage?: string | null;
  changesLabel?: string | null;
  changesRemaining?: number | null;
}

function softProgressLabel(filled: number): string {
  const missing = LINEUP_SIZE - filled;
  if (missing <= 0) return `${filled}/${LINEUP_SIZE}`;
  return `${filled}/${LINEUP_SIZE} · falten ${missing} jugador${missing === 1 ? "" : "s"}`;
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
  lineup,
  currentRound,
  onChange,
  saveStatus,
  error,
  readOnly = false,
  lockMessage = null,
}: LineupBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sheetOpen = selectedId != null && !pickerOpen;

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

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
    overBudget || validation.issues.includes("duplicate");
  const feedback = saveFeedback(saveStatus, error);

  const selectedPlayers = lineup.playerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter(Boolean) as Player[];

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
    if (readOnly) return;
    const playerIds = lineup.playerIds.filter((x) => x !== id);
    let captainId = lineup.captainId;
    if (captainId === id) captainId = null;
    if (selectedId === id) setSelectedId(null);
    applyLineup(playerIds, captainId);
  }

  function addPlayer(id: string) {
    if (readOnly) return;
    if (lineup.playerIds.includes(id)) return;
    if (lineup.playerIds.length >= LINEUP_SIZE) return;
    const player = roster.find((p) => p.id === id);
    if (!player) return;
    if (remaining < player.price) return;
    applyLineup([...lineup.playerIds, id], lineup.captainId);
    setSelectedId(null);
  }

  function setCaptain(id: string) {
    if (readOnly) return;
    onChange({
      ...lineup,
      captainId: id,
      confirmed: false,
      confirmedAt: null,
    });
  }

  function handleEmptySlot() {
    if (readOnly) return;
    setSelectedId(null);
    setPickerOpen(true);
  }

  function handlePickFromSheet(playerId: string) {
    addPlayer(playerId);
    setPickerOpen(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {readOnly ? (
        <div className="shrink-0 border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-50">
          {lockMessage ??
            "Finestra de transferències tancada. Només lectura fins diumenge 23:59 (Madrid)."}
        </div>
      ) : changesLabel ? (
        <div className="shrink-0 border border-line bg-panel/70 px-3 py-2 text-sm text-bone">
          <span className="font-medium text-grana-bright">{changesLabel}</span>
          <span className="mt-0.5 block text-[11px] text-mute">
            Un canvi = afegir un jugador que no era a l&apos;instantània (màx. 3).
          </span>
        </div>
      ) : null}
      <section className="budget-strip shrink-0 border border-line bg-panel/80 px-3.5 py-2.5 backdrop-blur-md sm:py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
              J{currentRound} · {readOnly ? "només lectura" : "restant"}
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
            <p className="mt-1 text-[10px] text-mute">
              Compra i venda al preu de mercat actual
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
              Proj.
              <span className="ml-1.5 normal-case tracking-normal text-mute/80">
                · capità ×2
              </span>
            </p>
            <p className="font-display text-lg leading-none text-grana-bright tabular-nums sm:text-xl">
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-mute">
          {incomplete && filled > 0 ? (
            <span>{softProgressLabel(filled)}</span>
          ) : filled === 0 ? (
            <span>Toca + per afegir</span>
          ) : !lineup.captainId ? (
            <span>Tria un capità (×2)</span>
          ) : (
            <span className="text-grana-bright">Completa</span>
          )}
          {feedback && (
            <span className={feedback.tone} aria-live="polite">
              {feedback.text}
            </span>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0.5">
        <CourtBoard
          players={selectedPlayers}
          captainId={lineup.captainId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEmptySlot={handleEmptySlot}
          fillHeight
        />
      </section>

      {showHarshValidation && (
        <div className="flex shrink-0 gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <ul className="space-y-0.5">
            {validation.issues
              .filter((i) => i === "budget" || i === "duplicate")
              .map((issue) => (
                <li key={issue}>{issueMessage(issue)}</li>
              ))}
          </ul>
        </div>
      )}

      {error && saveStatus === "error" && (
        <div className="flex shrink-0 gap-2 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!readOnly && (
        <MarketSheet
          open={pickerOpen}
          roster={roster}
          takenIds={lineup.playerIds}
          remainingBudget={remaining}
          lineupFull={filled >= LINEUP_SIZE}
          onPick={handlePickFromSheet}
          onClose={() => setPickerOpen(false)}
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
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-md"
          >
            <div className="mx-auto flex w-full max-w-lg items-center gap-2.5">
              <Link
                href={`/jugador/${selectedPlayer.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold text-bone underline-offset-2 hover:underline">
                  {selectedPlayer.name}
                </p>
                <p className="text-xs text-mute">
                  VAL {selectedPlayer.avgVal} · Veure fitxa
                </p>
              </Link>
              {!readOnly && (
                <>
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
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
