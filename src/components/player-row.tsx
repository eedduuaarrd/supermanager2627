"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, POSITION_LABEL } from "@/data/roster";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown, Plus, X } from "lucide-react";

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
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-white/8 px-3 py-3 transition-colors",
        selected && "bg-grana/15",
        isCaptain && "bg-gold/10",
      )}
    >
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-navy-deep text-gold">
        <span className="font-display text-lg leading-none tracking-wide">
          {player.number ?? "—"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-semibold text-cream">{player.name}</p>
          {isCaptain && (
            <Badge className="bg-gold text-navy-deep hover:bg-gold">
              <Crown className="size-3" /> Capità
            </Badge>
          )}
          {player.source === "placeholder" && (
            <Badge variant="outline" className="border-amber-400/40 text-amber-200">
              Placeholder
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-cream/55">
          {POSITION_LABEL[player.position]} · mitjana {player.avgVal} ·{" "}
          {formatPrice(player.price)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {selected && onCaptain && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "text-cream/70 hover:bg-gold/20 hover:text-gold",
              isCaptain && "text-gold",
            )}
            onClick={onCaptain}
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
            onClick={onAction}
            className="bg-grana text-cream hover:bg-grana-bright"
          >
            <Plus className="size-4" />
          </Button>
        )}
        {action === "remove" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onAction}
            className="text-cream/60 hover:bg-white/10 hover:text-cream"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
