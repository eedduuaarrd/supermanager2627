"use client";

import { BootGate } from "@/components/boot-gate";
import { LineupBuilder } from "@/components/lineup-builder";
import { useManager } from "@/components/manager-provider";

function EquipContent() {
  const {
    roster,
    budget,
    lineup,
    round,
    persistLineup,
    saving,
    saveStatus,
    actionError,
  } = useManager();

  return (
    <LineupBuilder
      roster={roster!}
      budget={budget}
      lineup={lineup}
      currentRound={round}
      onChange={persistLineup}
      saving={saving}
      saveStatus={saveStatus}
      error={actionError}
    />
  );
}

export default function EquipPage() {
  return (
    <BootGate>
      <EquipContent />
    </BootGate>
  );
}
