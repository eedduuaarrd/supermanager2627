"use client";

import { useManager } from "@/components/manager-provider";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";

type TeamChipsProps = {
  className?: string;
  createOpen?: boolean;
  onCreateOpen?: () => void;
};

/** Horizontal team chips for Inici — 1-tap switch, + Nou at end. */
export function TeamChips({
  className,
  createOpen = false,
  onCreateOpen,
}: TeamChipsProps) {
  const { teams, activeTeamId, maxTeams, switchTeam } = useManager();
  const atLimit = teams.length >= maxTeams;

  if (teams.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="listbox"
        aria-label="Equips"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {teams.map((t) => {
          const active = t.id === activeTeamId;
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                if (!active) void switchTeam(t.id);
              }}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                active
                  ? "border-grana bg-grana text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                  : "border-line bg-transparent text-bone hover:border-bone/40 hover:bg-white/5",
              )}
            >
              {active ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="max-w-[9rem] truncate">{t.name}</span>
              {active ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-bone/80">
                  Actiu
                </span>
              ) : null}
            </button>
          );
        })}

        {!atLimit ? (
          <button
            type="button"
            onClick={onCreateOpen}
            aria-expanded={createOpen}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-dashed px-3.5 text-sm font-semibold transition-colors",
              createOpen
                ? "border-grana/70 bg-grana/15 text-bone"
                : "border-line text-mute hover:border-bone/40 hover:text-bone",
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            Nou
          </button>
        ) : (
          <span
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-line/60 px-3 text-xs text-mute"
            title={`Màxim ${maxTeams} equips`}
          >
            Màxim {maxTeams}
          </span>
        )}
      </div>
    </div>
  );
}
