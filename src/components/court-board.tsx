"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { formatPrice, POSITION_LABEL } from "@/data/roster";
import type { Player, Position } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Plus } from "lucide-react";
import type { CSSProperties } from "react";

type SlotDef = {
  key: string;
  position: Position;
  left: string;
  top: string;
};

/**
 * Fixed half-court formation (looking toward the hoop):
 * 3 pivots near basket, 3 alers mid, 2 bases at bottom.
 * left/top mark the CHIP CIRCLE center; labels sit below outside the circle.
 */
const SLOTS: SlotDef[] = [
  // pivots (clear of hoop / rim)
  { key: "pivot-0", position: "pivot", left: "18%", top: "20%" },
  { key: "pivot-1", position: "pivot", left: "50%", top: "16%" },
  { key: "pivot-2", position: "pivot", left: "82%", top: "20%" },
  // alers
  { key: "aler-0", position: "aler", left: "18%", top: "48%" },
  { key: "aler-1", position: "aler", left: "50%", top: "52%" },
  { key: "aler-2", position: "aler", left: "82%", top: "48%" },
  // bases
  { key: "base-0", position: "base", left: "32%", top: "78%" },
  { key: "base-1", position: "base", left: "68%", top: "78%" },
];

function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 10);
  const last = parts[parts.length - 1];
  return last.length > 9 ? `${last.slice(0, 8)}…` : last;
}

function assignSlots(players: Player[]): (Player | null)[] {
  const pools: Record<Position, Player[]> = {
    pivot: players.filter((p) => p.position === "pivot"),
    aler: players.filter((p) => p.position === "aler"),
    base: players.filter((p) => p.position === "base"),
  };
  return SLOTS.map((slot) => pools[slot.position].shift() ?? null);
}

interface CourtBoardProps {
  players: Player[];
  captainId: string | null;
  confirmed?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onEmptySlot?: (position: Position) => void;
}

export function CourtBoard({
  players,
  captainId,
  confirmed,
  selectedId,
  onSelect,
  onEmptySlot,
}: CourtBoardProps) {
  const filled = assignSlots(players);

  return (
    <div className="court-board relative overflow-hidden border border-line">
      {/* Single aspect box owns BOTH markings and slots — same % coordinate system */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-lg sm:max-w-xl">
        <div className="court-board__surface absolute inset-0" aria-hidden />

        <svg
          className="court-board__lines pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 133.333"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="courtWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4a07a" stopOpacity="0.32" />
              <stop offset="45%" stopColor="#a07850" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6e5238" stopOpacity="0.28" />
            </linearGradient>
            <radialGradient id="paintGlow" cx="50%" cy="12%" r="42%">
              <stop offset="0%" stopColor="#c23142" stopOpacity="0.12" />
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
            stroke="rgba(255,248,235,0.55)"
            strokeWidth="0.8"
          />
          {/* baseline / backboard */}
          <line
            x1="28"
            y1="4"
            x2="72"
            y2="4"
            stroke="rgba(236,232,225,0.55)"
            strokeWidth="1.4"
          />
          {/* rim — court marking only; no interactive slot here */}
          <circle
            cx="50"
            cy="9"
            r="2.6"
            fill="none"
            stroke="rgba(194,49,66,0.75)"
            strokeWidth="0.85"
          />
          <line
            x1="50"
            y1="4"
            x2="50"
            y2="6.4"
            stroke="rgba(236,232,225,0.55)"
            strokeWidth="0.7"
          />
          {/* paint */}
          <rect
            x="32"
            y="4"
            width="36"
            height="34"
            fill="rgba(155,32,48,0.1)"
            stroke="rgba(236,232,225,0.4)"
            strokeWidth="0.7"
          />
          {/* free-throw circle */}
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
          {/* 3pt arc */}
          <path
            d="M 8 4 L 8 26 A 42 42 0 0 0 92 26 L 92 4"
            fill="none"
            stroke="rgba(236,232,225,0.36)"
            strokeWidth="0.75"
          />
          {/* half-court line */}
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
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/30"
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
                    confirmed={confirmed}
                    onSelect={onSelect}
                  />
                ) : (
                  <EmptySlot
                    position={slot.position}
                    disabled={confirmed}
                    onClick={
                      confirmed || !onEmptySlot
                        ? undefined
                        : () => onEmptySlot(slot.position)
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
        "court-chip court-chip--empty relative flex h-16 w-16 flex-col items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
        "disabled:cursor-default",
      )}
      aria-label={`Afegir ${POSITION_LABEL[position]}`}
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full sm:h-[4.5rem] sm:w-[4.5rem]",
          "border-2 border-dashed border-bone/60",
          "bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[2px]",
          !disabled && "transition active:scale-95",
        )}
      >
        <Plus className="size-6 text-bone/90 sm:size-7" strokeWidth={2.25} />
      </div>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.35rem)] -translate-x-1/2 whitespace-nowrap text-center text-[9px] font-medium uppercase tracking-[0.16em] text-bone/75">
        {POSITION_LABEL[position]}
      </span>
    </button>
  );
}

function FilledChip({
  player,
  isCaptain,
  isSelected,
  confirmed,
  onSelect,
}: {
  player: Player;
  isCaptain: boolean;
  isSelected: boolean;
  confirmed?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      disabled={confirmed || !onSelect}
      onClick={() => {
        if (!onSelect) return;
        onSelect(isSelected ? null : player.id);
      }}
      className={cn(
        "court-chip group relative flex h-16 w-16 flex-col items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]",
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
      <div className="relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className={cn(
            "!h-16 !w-16 rounded-full ring-2 sm:!h-[4.5rem] sm:!w-[4.5rem]",
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

      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.3rem)] w-[5.5rem] -translate-x-1/2 text-center">
        <p className="truncate text-[11px] font-semibold leading-tight text-bone drop-shadow">
          {shortName(player.name)}
        </p>
        <p className="text-[10px] tabular-nums text-bone/65">
          VAL {player.avgVal}
          <span className="mx-0.5 text-white/25">·</span>
          {formatPrice(player.price).replace(/\s/g, "")}
        </p>
      </div>
    </button>
  );
}
