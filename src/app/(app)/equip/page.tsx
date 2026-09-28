"use client";

import { BootGate } from "@/components/boot-gate";
import { JornadaPointsHistory } from "@/components/jornada-points-history";
import { LineupBuilder } from "@/components/lineup-builder";
import { useManager } from "@/components/manager-provider";
import { TeamSwitcher } from "@/components/team-switcher";

function EquipContent() {
  const {
    roster,
    budget,
    lineup,
    persistLineup,
    saving,
    saveStatus,
    actionError,
    user,
    lineupLocked,
    lockMessage,
    transfer,
  } = useManager();

  const readOnly = lineupLocked || transfer?.windowOpen === false;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="truncate text-[10px] uppercase tracking-[0.16em] text-mute">
          {user.teamName}
        </p>
        <TeamSwitcher />
      </div>
      <JornadaPointsHistory />
      <div className="min-h-0 flex-1">
        <LineupBuilder
          roster={roster!}
          budget={budget}
          lineup={lineup}
          onChange={persistLineup}
          saving={saving}
          saveStatus={saveStatus}
          error={actionError}
          readOnly={readOnly}
          lockMessage={lockMessage ?? transfer?.message}
        />
      </div>
    </div>
  );
}

export default function EquipPage() {
  return (
    <BootGate>
      <EquipContent />
    </BootGate>
  );
}
