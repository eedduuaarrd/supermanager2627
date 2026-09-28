"use client";

import { PlayerAvatar } from "@/components/player-avatar";
import { formatPrice, LINEUP_SLOTS, POSITION_LABEL } from "@/data/roster";
import type { Player, Position } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, X } from "lucide-react";
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
  { key: "base-0", position: "base", style: { left: "32%", top: "68%" } },
  { key: "base-1", position: "base", style: { left: "68%", top: "68%" } },
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
  onRemove?: (id: string) => void;
  onCaptain?: (id: string) => void;
}

export function CourtBoard({
  players,
  captainId,
  confirmed,
  onRemove,
  onCaptain,
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
          <linearGradient id="courtWood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2a2218" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#1a1612" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#12151a" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="140" fill="url(#courtWood)" />
        <rect
          x="4"
          y="4"
          width="92"
          height="132"
          fill="none"
          stroke="rgba(236,232,225,0.28)"
          strokeWidth="0.7"
        />
        <line
          x1="30"
          y1="4"
          x2="70"
          y2="4"
          stroke="rgba(236,232,225,0.35)"
          strokeWidth="1.2"
        />
        <circle
          cx="50"
          cy="10"
          r="3.2"
          fill="none"
          stroke="rgba(194,49,66,0.85)"
          strokeWidth="0.9"
        />
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="7"
          stroke="rgba(236,232,225,0.4)"
          strokeWidth="0.6"
        />
        <rect
          x="32"
          y="4"
          width="36"
          height="38"
          fill="rgba(155,32,48,0.08)"
          stroke="rgba(236,232,225,0.32)"
          strokeWidth="0.65"
        />
        <path
          d="M 32 42 A 18 18 0 0 0 68 42"
          fill="none"
          stroke="rgba(236,232,225,0.28)"
          strokeWidth="0.6"
        />
        <path
          d="M 32 42 A 18 18 0 0 1 68 42"
          fill="none"
          stroke="rgba(236,232,225,0.12)"
          strokeWidth="0.5"
          strokeDasharray="2 1.5"
        />
        <path
          d="M 8 4 L 8 28 A 42 42 0 0 0 92 28 L 92 4"
          fill="none"
          stroke="rgba(236,232,225,0.26)"
          strokeWidth="0.7"
        />
        <line
          x1="4"
          y1="128"
          x2="96"
          y2="128"
          stroke="rgba(236,232,225,0.22)"
          strokeWidth="0.65"
        />
        <circle
          cx="50"
          cy="128"
          r="10"
          fill="none"
          stroke="rgba(236,232,225,0.18)"
          strokeWidth="0.55"
        />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-ink/70"
        aria-hidden
      />

      <div className="relative z-10 mx-auto aspect-[5/7] w-full max-w-lg sm:max-w-xl">
        {SLOTS.map((slot, i) => {
          const player = filled[i];
          const isCaptain = player != null && captainId === player.id;
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
                  confirmed={confirmed}
                  onRemove={onRemove}
                  onCaptain={onCaptain}
                />
              ) : (
                <EmptySlot position={slot.position} />
              )}
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 border-t border-white/10 bg-ink/50 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-mute backdrop-blur-sm">
        {(Object.keys(LINEUP_SLOTS) as Position[]).map((pos) => {
          const n = players.filter((p) => p.position === pos).length;
          const max = LINEUP_SLOTS[pos];
          return (
            <span
              key={pos}
              className={cn(n === max ? "text-grana-bright" : "text-mute")}
            >
              {POSITION_LABEL[pos]} {n}/{max}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EmptySlot({ position }: { position: Position }) {
  return (
    <div className="court-chip court-chip--empty flex w-[4.5rem] flex-col items-center gap-1 sm:w-[5.25rem]">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/25 bg-black/25 sm:h-14 sm:w-14"
        aria-hidden
      >
        <span className="font-display text-[10px] tracking-wider text-mute/80">
          {POSITION_LABEL[position].slice(0, 1)}
        </span>
      </div>
      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-mute/90">
        {POSITION_LABEL[position]}
      </span>
    </div>
  );
}

function FilledChip({
  player,
  isCaptain,
  confirmed,
  onRemove,
  onCaptain,
}: {
  player: Player;
  isCaptain: boolean;
  confirmed?: boolean;
  onRemove?: (id: string) => void;
  onCaptain?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "court-chip group relative flex w-[4.5rem] flex-col items-center gap-1 sm:w-[5.25rem]",
        isCaptain && "court-chip--captain",
      )}
    >
      <button
        type="button"
        disabled={confirmed || !onCaptain}
        onClick={() => onCaptain?.(player.id)}
        className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grana-bright disabled:cursor-default"
        aria-label={
          isCaptain
            ? `${player.name}, capità`
            : `Marcar ${player.name} com a capità`
        }
        title={confirmed ? undefined : "Toca per fer capità"}
      >
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className={cn(
            "!h-12 !w-12 rounded-full ring-2 sm:!h-14 sm:!w-14",
            isCaptain
              ? "ring-grana-bright shadow-[0_0_0_3px_rgba(155,32,48,0.25)]"
              : "ring-white/25",
          )}
        />
        {isCaptain && (
          <span className="captain-badge absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-grana text-bone shadow-md ring-1 ring-bone/30">
            <Crown className="size-3" />
          </span>
        )}
      </button>

      <div className="w-full text-center">
        <p className="truncate text-[11px] font-semibold leading-tight text-bone drop-shadow">
          {shortName(player.name)}
        </p>
        <p className="text-[10px] tabular-nums text-mute">
          VAL {player.avgVal}
          <span className="mx-0.5 text-white/20">·</span>
          {formatPrice(player.price).replace(/\s/g, "")}
        </p>
      </div>

      {!confirmed && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(player.id)}
          className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/90 text-mute opacity-90 ring-1 ring-white/20 transition hover:bg-grana hover:text-bone sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Treure ${player.name}`}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
