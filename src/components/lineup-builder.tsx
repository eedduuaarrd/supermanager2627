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
  onChange: (lineup: Lineup) => void;
  saving?: boolean;
  saveStatus?: SaveStatus;
  error?: string | null;
  /** Tip-off / jornada lock — court becomes read-only. */
  readOnly?: boolean;
  lockMessage?: string | null;
}

function softHint(filled: number, hasCaptain: boolean): string | null {
  if (filled === 0) return "Toca + per afegir";
  if (filled < LINEUP_SIZE) {
    const missing = LINEUP_SIZE - filled;
    return `Falten ${missing}`;
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
  lineup,
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
  const filled = lineup.playerIds.length;
  const overBudget = remaining < 0;
  const showHarshValidation =
    overBudget || validation.issues.includes("duplicate");
  const feedback = saveFeedback(saveStatus, error);
  const hint = softHint(filled, Boolean(lineup.captainId));

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
    <div className="flex h-full min-h-0 flex-col gap-2">
      {readOnly ? (
        <div className="shrink-0 px-0.5 py-1 text-sm text-amber-100/90">
          {lockMessage ??
            "Finestra de transferències tancada. Només lectura fins diumenge 23:59 (Madrid)."}
        </div>
      ) : null}
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
        <p className="shrink-0 tabular-nums text-mute/70">
          {projected > 0 ? (
            <span title="Punts projectats (capità ×2)">≈{projected}</span>
          ) : null}
          {feedback ? (
            <span className={`ml-2 ${feedback.tone}`} aria-live="polite">
              {feedback.text}
            </span>
          ) : null}
        </p>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        <div className="flex shrink-0 gap-2 px-0.5 py-1 text-xs text-amber-100/90">
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
        <div
          role="alert"
          className="flex shrink-0 gap-2 border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100"
        >
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
