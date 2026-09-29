"use client";

import { PlayerRow } from "@/components/player-row";
import { Button } from "@/components/ui/button";
import { TEAM_ORDER, TEAMS } from "@/data/roster";
import type { Player, TeamId } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

interface MarketSheetProps {
  open: boolean;
  roster: Player[];
  takenIds: string[];
  remainingBudget: number;
  lineupFull: boolean;
  onPick: (playerId: string) => void;
  onClose: () => void;
}

export function MarketSheet({
  open,
  roster,
  takenIds,
  remainingBudget,
  lineupFull,
  onPick,
  onClose,
}: MarketSheetProps) {
  const sections = useMemo(() => {
    if (!open) return [] as { teamId: TeamId; players: Player[] }[];

    const available = roster
      .filter((p) => !takenIds.includes(p.id))
      .sort((a, b) => b.price - a.price);

    return TEAM_ORDER.map((teamId) => ({
      teamId,
      players: available.filter((p) => p.teamId === teamId),
    })).filter((s) => s.players.length > 0);
  }, [open, roster, takenIds]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Tancar mercat"
        onClick={onClose}
      />
      <div className="market-sheet relative z-10 mx-auto flex max-h-[min(85dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line border-b-0 bg-ink shadow-[0_-12px_40px_rgba(0,0,0,0.45)] md:max-w-xl lg:max-w-2xl">
        <div className="flex shrink-0 flex-col items-center px-4 pt-2.5 pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="mb-2.5 h-1 w-10 rounded-full bg-white/25" aria-hidden />
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl tracking-wide text-bone">
                Tria un jugador
              </h2>
              <p className="mt-0.5 text-xs text-mute">
                Agrupats per equip · Compra al preu de mercat actual
              </p>
            </div>
            <Button
              type="button"
              size="icon-lg"
              variant="ghost"
              onClick={onClose}
              className="min-h-11 min-w-11 shrink-0 touch-manipulation text-mute hover:bg-white/10 hover:text-bone"
              aria-label="Tancar"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {sections.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-mute">
              No hi ha més jugadors disponibles.
            </div>
          ) : (
            sections.map(({ teamId, players }) => (
              <section key={teamId} className="border-t border-line">
                <header className="sticky top-0 z-[1] bg-ink/95 px-4 py-2.5 backdrop-blur-md">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-grana-bright">
                    {TEAMS[teamId].label}
                  </h3>
                  {!TEAMS[teamId].rosterAvailable && (
                    <p className="mt-0.5 text-[11px] text-mute">
                      Plantilla FCBQ encara no publicada
                    </p>
                  )}
                </header>
                <div>
                  {players.map((player) => {
                    const tooExpensive = remainingBudget < player.price;
                    const disabled = tooExpensive || lineupFull;
                    return (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        action="add"
                        disabled={disabled}
                        onAction={() => {
                          if (disabled) return;
                          onPick(player.id);
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
