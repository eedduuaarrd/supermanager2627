"use client";

import { CourtBoard } from "@/components/court-board";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Player } from "@/lib/types";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type IdealLineup = {
  round: number;
  playerIds: string[];
  scores: { playerId: string; points: number }[];
  updatedAt: string;
};

type IdealTeamSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round: number;
  team: IdealLineup | null;
  pendingRound: number | null;
  roster: Player[] | null;
};

function formatVal(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Ideal lineup popup — same court, photos, and player tap as Equip. */
export function IdealTeamSheet({
  open,
  onOpenChange,
  round,
  team,
  pendingRound,
  roster,
}: IdealTeamSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setSelectedId(null);
    onOpenChange(next);
  }

  const pointsById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const score of team?.scores ?? []) map[score.playerId] = score.points;
    return map;
  }, [team]);

  const players = useMemo(() => {
    if (!team || !roster) return [];
    const byId = new Map(roster.map((p) => [p.id, p]));
    return team.playerIds
      .map((id) => byId.get(id))
      .filter((p): p is Player => Boolean(p));
  }, [roster, team]);

  const selected =
    players.find((p) => p.id === selectedId) ?? null;
  const selectedPoints =
    selected && pointsById[selected.id] != null
      ? pointsById[selected.id]
      : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[60] bg-ink/80 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          className="fixed top-[max(3.25rem,env(safe-area-inset-top))] right-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-2 z-[60] flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-soft text-bone shadow-[0_24px_70px_rgba(0,0,0,0.55)] outline-none"
        >
          <header className="relative shrink-0 border-b border-line px-4 pt-4 pr-12 pb-3">
            <DialogTitle className="font-display text-[22px] tracking-wide text-bone">
              Equip ideal J{round}
            </DialogTitle>
            <p className="mt-1.5 text-[11px] text-mute">
              3 pivots · 3 alers · 2 bases
            </p>
            {pendingRound != null && team && (
              <p className="mt-1 text-[11px] leading-snug text-[#c4b396]">
                L&apos;equip ideal de J{pendingRound} encara no està desat. Es
                mostra el de J{team.round}.
              </p>
            )}
            <DialogPrimitive.Close
              className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-md text-mute hover:bg-ink hover:text-bone"
              aria-label="Tancar"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </header>

          {!team ? (
            <div className="flex flex-1 items-center px-5 py-8">
              <p className="text-sm leading-relaxed text-mute">
                Encara no hi ha un equip ideal desat per a la jornada {round}.
                No s&apos;inventen jugadors ni puntuacions.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col px-2 pt-2 pb-3">
              <CourtBoard
                players={players}
                captainId={null}
                selectedId={selectedId}
                onSelect={setSelectedId}
                caption="ideal"
                jornadaPointsById={pointsById}
                fillHeight
              />
            </div>
          )}

          {selected && (
            <div className="shrink-0 border-t border-line bg-ink/95 px-4 py-3">
              <Link
                href={`/jugador/${selected.id}`}
                className="block min-h-11 touch-manipulation"
              >
                <p className="truncate text-sm font-semibold text-bone underline-offset-2 hover:underline">
                  {selected.name}
                </p>
                <p className="text-xs text-mute">
                  J{round} · VAL{" "}
                  {selectedPoints == null ? "—" : formatVal(selectedPoints)} ·
                  Veure fitxa
                </p>
              </Link>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function IdealTeamButton({
  round,
  onClick,
}: {
  round: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="ml-6 inline-flex h-10 shrink-0 items-center rounded-full border border-bone/40 bg-panel-2 px-3.5 text-sm font-semibold tracking-tight text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-bone/60"
    >
      Equip ideal J{round}
    </button>
  );
}
