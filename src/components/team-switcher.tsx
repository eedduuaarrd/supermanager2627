"use client";

import { useManager } from "@/components/manager-provider";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

/** Compact active-team selector for Equip / Inici headers. */
export function TeamSwitcher({ className }: { className?: string }) {
  const { teams, activeTeamId, switchTeam, user } = useManager();

  if (teams.length <= 1) {
    return (
      <p className={cn("truncate text-xs text-mute", className)}>
        {user.teamName}
      </p>
    );
  }

  return (
    <label className={cn("relative inline-flex max-w-full items-center", className)}>
      <span className="sr-only">Equip actiu</span>
      <select
        value={activeTeamId ?? ""}
        onChange={(e) => void switchTeam(e.target.value)}
        className="max-w-[14rem] appearance-none truncate rounded-sm border border-line bg-panel/90 py-1.5 pl-2.5 pr-7 text-xs font-medium text-bone outline-none focus-visible:ring-1 focus-visible:ring-grana"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-mute"
        aria-hidden
      />
    </label>
  );
}
