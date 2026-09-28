"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatPrice, teamLabel } from "@/data/roster";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Plus, X } from "lucide-react";
import Link from "next/link";

interface PlayerRowProps {
  player: Player;
  selected?: boolean;
  isCaptain?: boolean;
  disabled?: boolean;
  action?: "add" | "remove" | "captain" | "none";
  onAction?: () => void;
  onCaptain?: () => void;
}

export function PlayerRow({
  player,
  selected,
  isCaptain,
  disabled,
  action = "none",
  onAction,
  onCaptain,
}: PlayerRowProps) {
  const href = `/jugador/${encodeURIComponent(player.id)}`;
  const canTapRow = action === "add" && !disabled && onAction;

  return (
    <div
      role={canTapRow ? "button" : undefined}
      tabIndex={canTapRow ? 0 : undefined}
      onClick={canTapRow ? onAction : undefined}
      onKeyDown={
        canTapRow
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAction?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 border-b border-line px-3 py-3 transition-colors",
        selected && "bg-grana/10",
        isCaptain && "bg-white/[0.04]",
        canTapRow && "cursor-pointer active:bg-white/[0.06]",
        disabled && action === "add" && "opacity-45",
      )}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3 active:opacity-90"
        onClick={(e) => e.stopPropagation()}
      >
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-bone">
              {player.name}
            </p>
            {isCaptain && (
              <Badge className="bg-grana text-bone hover:bg-grana">
                <Crown className="size-3" /> Capità
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-white/15 text-[10px] uppercase tracking-wide text-mute"
            >
              {teamLabel(player.teamId)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {player.pts != null ? `${player.pts} pts · ` : ""}VAL {player.avgVal}{" "}
            · {formatPrice(player.price)}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {selected && onCaptain && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "text-mute hover:bg-white/10 hover:text-bone",
              isCaptain && "text-grana-bright",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onCaptain();
            }}
            aria-label="Marcar com a capità"
          >
            <Crown className="size-4" />
          </Button>
        )}
        {action === "add" && (
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onAction?.();
            }}
            className="bg-grana text-bone hover:bg-grana-bright"
            aria-label={`Afegir ${player.name}`}
          >
            <Plus className="size-4" />
          </Button>
        )}
        {action === "remove" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAction?.();
            }}
            className="text-mute hover:bg-white/10 hover:text-bone"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
