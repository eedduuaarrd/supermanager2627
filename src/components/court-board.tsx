"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { PriceLabel } from "@/components/price-label";
import {
  COURT_SLOT_POSITIONS,
  displayFirstName,
  LINEUP_SLOTS,
  POSITION_LABEL,
} from "@/data/roster";
import type { Player, Position } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Plus } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

type SlotDef = {
  key: string;
  position: Position;
  left: string;
  top: string;
};

/**
 * Flat half-court grid (looking toward the hoop).
 * Top 3 = Pivot, middle 3 = Aler, bottom 2 = Base.
 * left/top mark the CHIP CIRCLE center; labels sit below outside the circle.
 */
const SLOTS: SlotDef[] = COURT_SLOT_POSITIONS.map((position, i) => {
  const row = i < 3 ? 0 : i < 6 ? 1 : 2;
  const colInRow = i < 3 ? i : i < 6 ? i - 3 : i - 6;
  const left =
    row < 2
      ? (["16%", "50%", "84%"] as const)[colInRow]
      : (["30%", "70%"] as const)[colInRow];
  const top = (["18%", "48%", "78%"] as const)[row];
  return {
    key: `${position}-${colInRow}`,
    position,
    left,
    top,
  };
});

/** Place players into fixed position slots (P→A→B pools). */
function assignSlots(players: Player[]): (Player | null)[] {
  const pools: Record<Position, Player[]> = {
    P: players.filter((p) => p.position === "P"),
    A: players.filter((p) => p.position === "A"),
    B: players.filter((p) => p.position === "B"),
  };
  return SLOTS.map((slot) => pools[slot.position].shift() ?? null);
}

function countByPosition(players: Player[]): Record<Position, number> {
  return {
    P: players.filter((p) => p.position === "P").length,
    A: players.filter((p) => p.position === "A").length,
    B: players.filter((p) => p.position === "B").length,
  };
}

interface CourtBoardProps {
  players: Player[];
  captainId: string | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onEmptySlot?: (slot: { slotIndex: number; position: Position }) => void;
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
  const counts = countByPosition(players);

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
            ? "aspect-[3/4] h-full max-h-full w-auto max-w-full md:max-w-2xl lg:max-w-3xl"
            : "aspect-[3/4] w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl",
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
            const posFull = counts[slot.position] >= LINEUP_SLOTS[slot.position];
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
                    position={slot.position}
                    disabled={posFull}
                    onClick={
                      !onEmptySlot
                        ? undefined
                        : () =>
                            onEmptySlot({
                              slotIndex: i,
                              position: slot.position,
                            })
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
  position,
  disabled,
  onClick,
}: {
  position: Position;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "court-chip court-chip--empty relative flex h-[3.75rem] w-[3.75rem] flex-col items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem] md:h-16 md:w-16",
        "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
        "disabled:cursor-default",
      )}
      aria-label={`Afegir ${POSITION_LABEL[position]}`}
    >
      <div
        className={cn(
          "flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full sm:h-[4.25rem] sm:w-[4.25rem] md:h-16 md:w-16",
          "border-2 border-dashed border-bone/50",
          "bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[2px]",
          !disabled && "transition active:scale-95",
        )}
      >
        <Plus className="size-5 text-bone/90 sm:size-6" strokeWidth={2.25} />
      </div>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.35rem)] -translate-x-1/2 text-[9px] font-medium tracking-[0.14em] text-bone/55">
        {position}
      </span>
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
  const href = `/jugador/${player.id}`;
  return (
    <div
      className={cn(
        "court-chip group relative flex h-[3.75rem] w-[3.75rem] flex-col items-center justify-center sm:h-[4.25rem] sm:w-[4.25rem] md:h-16 md:w-16",
        isCaptain && "court-chip--captain",
        isSelected && "court-chip--selected",
      )}
    >
      <button
        type="button"
        disabled={!onSelect}
        onClick={() => {
          if (!onSelect) return;
          onSelect(isSelected ? null : player.id);
        }}
        className={cn(
          "relative h-[3.75rem] w-[3.75rem] touch-manipulation sm:h-[4.25rem] sm:w-[4.25rem] md:h-16 md:w-16",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
          "disabled:cursor-default",
        )}
        aria-label={
          isSelected
            ? `${player.name}, seleccionat`
            : `Seleccionar ${player.name}`
        }
        aria-pressed={isSelected}
      >
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className={cn(
            "!h-[3.75rem] !w-[3.75rem] rounded-full ring-2 sm:!h-[4.25rem] sm:!w-[4.25rem] md:!h-16 md:!w-16",
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
      </button>
      <ChipCaption
        player={player}
        asLink={!isSelected}
        href={href}
      />
    </div>
  );
}

function ChipCaption({
  player,
  asLink,
  href,
}: {
  player: Player;
  asLink: boolean;
  href: string;
}) {
  const className =
    "absolute left-1/2 top-[calc(100%+0.4rem)] z-10 w-[5.5rem] -translate-x-1/2 text-center";
  const body = (
    <>
      <p className="truncate text-[10px] font-semibold leading-snug text-bone drop-shadow sm:text-[11px]">
        {displayFirstName(player.name)}
      </p>
      <p className="mt-0.5 text-[9px] tabular-nums text-bone/65 sm:text-[10px]">
        VAL {player.avgVal}
        <span className="mx-0.5 text-white/25">·</span>
        <PriceLabel
          price={player.price}
          prevPrice={player.prevPrice}
          compact
          className="text-[9px] sm:text-[10px]"
        />
      </p>
    </>
  );
  // When selected, action-sheet backdrop covers the court — keep caption as
  // plain text so taps don't silently dismiss; fitxa lives in the sheet.
  if (!asLink) {
    return <div className={cn(className, "pointer-events-none")}>{body}</div>;
  }
  return (
    <Link
      href={href}
      className={className}
      aria-label={`Fitxa de ${player.name}`}
    >
      {body}
    </Link>
  );
}
