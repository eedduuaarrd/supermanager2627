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
  style: CSSProperties;
};

/** Half-court view looking toward the hoop: pivots top, alers mid, bases bottom. */
const SLOTS: SlotDef[] = [
  { key: "pivot-0", position: "pivot", style: { left: "18%", top: "14%" } },
  { key: "pivot-1", position: "pivot", style: { left: "50%", top: "8%" } },
  { key: "pivot-2", position: "pivot", style: { left: "82%", top: "14%" } },
  { key: "aler-0", position: "aler", style: { left: "16%", top: "42%" } },
  { key: "aler-1", position: "aler", style: { left: "50%", top: "38%" } },
  { key: "aler-2", position: "aler", style: { left: "84%", top: "42%" } },
  { key: "base-0", position: "base", style: { left: "32%", top: "70%" } },
  { key: "base-1", position: "base", style: { left: "68%", top: "70%" } },
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
      <div className="court-board__surface absolute inset-0" aria-hidden />

      <svg
        className="court-board__lines pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 140"
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
            <stop offset="0%" stopColor="#c23142" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c23142" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="140" fill="url(#courtWood)" />
        <rect x="0" y="0" width="100" height="140" fill="url(#paintGlow)" />
        <rect
          x="4"
          y="4"
          width="92"
          height="132"
          fill="none"
          stroke="rgba(236,232,225,0.42)"
          strokeWidth="0.75"
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
        {/* rim */}
        <circle
          cx="50"
          cy="10"
          r="3.4"
          fill="none"
          stroke="rgba(194,49,66,0.95)"
          strokeWidth="1"
        />
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="6.8"
          stroke="rgba(236,232,225,0.55)"
          strokeWidth="0.7"
        />
        {/* paint */}
        <rect
          x="32"
          y="4"
          width="36"
          height="38"
          fill="rgba(155,32,48,0.1)"
          stroke="rgba(236,232,225,0.4)"
          strokeWidth="0.7"
        />
        {/* free-throw circle */}
        <path
          d="M 32 42 A 18 18 0 0 0 68 42"
          fill="none"
          stroke="rgba(236,232,225,0.38)"
          strokeWidth="0.65"
        />
        <path
          d="M 32 42 A 18 18 0 0 1 68 42"
          fill="none"
          stroke="rgba(236,232,225,0.18)"
          strokeWidth="0.55"
          strokeDasharray="2 1.5"
        />
        {/* 3pt arc */}
        <path
          d="M 8 4 L 8 28 A 42 42 0 0 0 92 28 L 92 4"
          fill="none"
          stroke="rgba(236,232,225,0.36)"
          strokeWidth="0.75"
        />
        {/* half-court line */}
        <line
          x1="4"
          y1="128"
          x2="96"
          y2="128"
          stroke="rgba(236,232,225,0.32)"
          strokeWidth="0.7"
        />
        <circle
          cx="50"
          cy="128"
          r="11"
          fill="none"
          stroke="rgba(236,232,225,0.28)"
          strokeWidth="0.6"
        />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-ink/55"
        aria-hidden
      />

      <div className="relative z-10 mx-auto aspect-[5/7] w-full max-w-lg sm:max-w-xl">
        {SLOTS.map((slot, i) => {
          const player = filled[i];
          const isCaptain = player != null && captainId === player.id;
          const isSelected = player != null && selectedId === player.id;
          return (
            <div
              key={slot.key}
              className="court-slot absolute -translate-x-1/2 -translate-y-1/2"
              style={
                {
                  ...slot.style,
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
        "court-chip court-chip--empty flex w-[4.75rem] flex-col items-center gap-1 sm:w-[5.25rem]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright",
        "disabled:cursor-default",
      )}
      aria-label={`Afegir ${POSITION_LABEL[position]}`}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14",
          "border-2 border-dashed border-bone/45",
          "bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[2px]",
          !disabled && "transition active:scale-95",
        )}
      >
        <Plus className="size-6 text-bone/90 sm:size-7" strokeWidth={2.25} />
      </div>
      <span className="text-center text-[9px] font-medium uppercase tracking-[0.16em] text-bone/70">
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
        "court-chip group relative flex w-[4.75rem] flex-col items-center gap-1 sm:w-[5.25rem]",
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
      <div className="relative">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className={cn(
            "!h-12 !w-12 rounded-full ring-2 sm:!h-14 sm:!w-14",
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

      <div className="w-full text-center">
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
