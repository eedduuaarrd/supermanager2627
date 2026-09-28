"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { formatPrice, LINEUP_SIZE } from "@/data/roster";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Plus } from "lucide-react";
import type { CSSProperties } from "react";

type SlotDef = {
  key: string;
  left: string;
  top: string;
};

/**
 * Flat half-court grid (looking toward the hoop).
 * 8 equal slots — any mix of players; no position labels.
 * left/top mark the CHIP CIRCLE center; labels sit below outside the circle.
 */
const SLOTS: SlotDef[] = [
  { key: "s0", left: "18%", top: "22%" },
  { key: "s1", left: "50%", top: "22%" },
  { key: "s2", left: "82%", top: "22%" },
  { key: "s3", left: "18%", top: "50%" },
  { key: "s4", left: "50%", top: "50%" },
  { key: "s5", left: "82%", top: "50%" },
  { key: "s6", left: "32%", top: "78%" },
  { key: "s7", left: "68%", top: "78%" },
];

function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 10);
  const last = parts[parts.length - 1];
  return last.length > 9 ? `${last.slice(0, 8)}…` : last;
}

/** Dense playerIds map to slots in order; trailing slots stay empty. */
function assignSlots(players: Player[]): (Player | null)[] {
  return SLOTS.map((_, i) => players[i] ?? null);
}

interface CourtBoardProps {
  players: Player[];
  captainId: string | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onEmptySlot?: (slot: { slotIndex: number }) => void;
  /** Fill remaining flex height without forcing page scroll. */
  fillHeight?: boolean;
}

export function CourtBoard({
  players,
  captainId,
  selectedId,
  onSelect,
  onEmptySlot,
  fillHeight,
}: CourtBoardProps) {
  const filled = assignSlots(players);

  return (
    <div
      className={cn(
        "court-board relative overflow-hidden border border-line",
        fillHeight && "flex h-full min-h-0 w-full items-center justify-center",
      )}
    >
      <div
        className={cn(
          "relative mx-auto",
          fillHeight
            ? "aspect-[3/4] h-full max-h-full w-auto max-w-full"
            : "aspect-[3/4] w-full max-w-lg sm:max-w-xl",
        )}
      >
        <div className="court-board__surface absolute inset-0" aria-hidden />

        <svg
          className="court-board__lines pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 133.333"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="courtWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b6a45" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#6e5336" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3d2e1f" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="paintGlow" cx="50%" cy="12%" r="45%">
              <stop offset="0%" stopColor="#c23142" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#c23142" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="100" height="133.333" fill="url(#courtWood)" />
          <rect x="0" y="0" width="100" height="133.333" fill="url(#paintGlow)" />
          <rect
            x="4"
            y="4"
            width="92"
            height="125.333"
            fill="none"
            stroke="rgba(236,232,225,0.42)"
            strokeWidth="0.75"
          />
          <line
            x1="4"
            y1="4"
            x2="96"
            y2="4"
            stroke="rgba(236,232,225,0.42)"
            strokeWidth="0.7"
          />
          <rect
            x="40.5"
            y="3.0"
            width="19"
            height="2.2"
            rx="0.3"
            fill="rgba(236,232,225,0.82)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.25"
          />
          <line
            x1="50"
            y1="5.2"
            x2="50"
            y2="7.0"
            stroke="rgba(236,232,225,0.75)"
            strokeWidth="0.55"
          />
          <circle cx="50" cy="7.9" r="1.35" fill="#e87722" />
          <circle cx="49.55" cy="7.55" r="0.35" fill="rgba(255,220,160,0.55)" />
          <path
            d="M 48.7 8.9 Q 50 11.2 51.3 8.9"
            fill="none"
            stroke="rgba(236,232,225,0.4)"
            strokeWidth="0.3"
          />
          <rect
            x="32"
            y="4"
            width="36"
            height="34"
            fill="rgba(155,32,48,0.1)"
            stroke="rgba(236,232,225,0.4)"
            strokeWidth="0.7"
          />
          <path
            d="M 32 38 A 18 18 0 0 0 68 38"
            fill="none"
            stroke="rgba(236,232,225,0.38)"
            strokeWidth="0.65"
          />
          <path
            d="M 32 38 A 18 18 0 0 1 68 38"
            fill="none"
            stroke="rgba(236,232,225,0.18)"
            strokeWidth="0.55"
            strokeDasharray="2 1.5"
          />
          <path
            d="M 8 4 L 8 26 A 42 42 0 0 0 92 26 L 92 4"
            fill="none"
            stroke="rgba(236,232,225,0.36)"
            strokeWidth="0.75"
          />
          <line
            x1="4"
            y1="122"
            x2="96"
            y2="122"
            stroke="rgba(236,232,225,0.32)"
            strokeWidth="0.7"
          />
          <circle
            cx="50"
            cy="122"
            r="10"
            fill="none"
            stroke="rgba(236,232,225,0.28)"
            strokeWidth="0.6"
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-ink/55"
          aria-hidden
        />

        <div className="absolute inset-0 z-10">
          {SLOTS.map((slot, i) => {
            const player = filled[i];
            const isCaptain = player != null && captainId === player.id;
            const isSelected = player != null && selectedId === player.id;
            return (
              <div
                key={slot.key}
                className="court-slot absolute"
                style={
                  {
                    left: slot.left,
                    top: slot.top,
                    transform: "translate(-50%, -50%)",
                    ["--slot-i" as string]: i,
                  } as CSSProperties
                }
              >
                {player ? (
                  <FilledChip
                    player={player}
                    isCaptain={isCaptain}
                    isSelected={isSelected}
                    onSelect={onSelect}
                  />
                ) : (
                  <EmptySlot
                    slotIndex={i}
                    disabled={players.length >= LINEUP_SIZE}
                    onClick={
                      !onEmptySlot
                        ? undefined
                        : () => onEmptySlot({ slotIndex: i })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({
  slotIndex,
  disabled,
  onClick,
}: {
  slotIndex: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "court-chip court-chip--empty relative flex h-14 w-14 flex-col items-center justify-center sm:h-16 sm:w-16",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
        "disabled:cursor-default",
      )}
      aria-label={`Afegir jugador (slot ${slotIndex + 1})`}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16",
          "border-2 border-dashed border-bone/50",
          "bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[2px]",
          !disabled && "transition active:scale-95",
        )}
      >
        <Plus className="size-5 text-bone/90 sm:size-6" strokeWidth={2.25} />
      </div>
    </button>
  );
}

function FilledChip({
  player,
  isCaptain,
  isSelected,
  onSelect,
}: {
  player: Player;
  isCaptain: boolean;
  isSelected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={() => {
        if (!onSelect) return;
        onSelect(isSelected ? null : player.id);
      }}
      className={cn(
        "court-chip group relative flex h-14 w-14 flex-col items-center justify-center sm:h-16 sm:w-16",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
        "disabled:cursor-default",
        isCaptain && "court-chip--captain",
        isSelected && "court-chip--selected",
      )}
      aria-label={
        isSelected
          ? `${player.name}, seleccionat`
          : `Seleccionar ${player.name}`
      }
      aria-pressed={isSelected}
    >
      <div className="relative h-14 w-14 sm:h-16 sm:w-16">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className={cn(
            "!h-14 !w-14 rounded-full ring-2 sm:!h-16 sm:!w-16",
            isSelected
              ? "ring-grana-bright shadow-[0_0_0_4px_rgba(194,49,66,0.35)]"
              : isCaptain
                ? "ring-grana-bright/90 shadow-[0_0_0_3px_rgba(155,32,48,0.28)]"
                : "ring-bone/35",
          )}
        />
        {isCaptain && (
          <span className="captain-badge absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-grana text-bone shadow-md ring-1 ring-bone/30">
            <Crown className="size-3" />
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.25rem)] w-[5.25rem] -translate-x-1/2 text-center">
        <p className="truncate text-[10px] font-semibold leading-tight text-bone drop-shadow sm:text-[11px]">
          {shortName(player.name)}
        </p>
        <p className="text-[9px] tabular-nums text-bone/65 sm:text-[10px]">
          VAL {player.avgVal}
          <span className="mx-0.5 text-white/25">·</span>
          {formatPrice(player.price).replace(/\s/g, "")}
        </p>
      </div>
    </button>
  );
}
