"use client";

import { BootGate } from "@/components/boot-gate";
import { LineupBuilder } from "@/components/lineup-builder";
import { useManager } from "@/components/manager-provider";
import { useRouter } from "next/navigation";

function EquipContent() {
  const router = useRouter();
  const {
    roster,
    budget,
    lineup,
    round,
    persistLineup,
    confirmLineup,
    confirming,
    saving,
    actionError,
  } = useManager();

  return (
    <LineupBuilder
      roster={roster!}
      budget={budget}
      lineup={lineup}
      currentRound={round}
      onChange={persistLineup}
      onConfirm={async () => {
        const ok = await confirmLineup();
        if (ok) router.push("/classificacio");
      }}
      confirming={confirming}
      saving={saving}
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
