"use client";

import { BootGate } from "@/components/boot-gate";
import { JornadaPointsHistory } from "@/components/jornada-points-history";
import { LineupBuilder } from "@/components/lineup-builder";
import { useManager } from "@/components/manager-provider";
import { TeamSwitcher } from "@/components/team-switcher";
import { resolveEquipCourt, type PastCourtView } from "@/lib/equip-court";
import { useEffect, useState } from "react";

function EquipContent() {
  const {
    roster,
    budget,
    savedPlayerIds,
    lineup,
    persistLineup,
    saving,
    saveStatus,
    actionError,
    user,
    lineupLocked,
    transfer,
    activeTeamId,
    round,
    roundStatus,
    reload,
  } = useManager();
  const [playedVals, setPlayedVals] = useState<Record<string, number>>({});
  const [past, setPast] = useState<PastCourtView | null>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const res = await fetch("/api/lineup", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          playedVals?: Record<string, number>;
          locked?: boolean;
          roundStatus?: string;
          round?: number;
        };
        if (cancel) return;
        setPlayedVals(data.playedVals ?? {});
        const status = data.roundStatus === "closed" ? "closed" : "open";
        const locked = Boolean(data.locked);
        const nextRound = typeof data.round === "number" ? data.round : round;
        if (locked !== lineupLocked || status !== roundStatus || nextRound !== round) {
          await reload();
        }
      } catch {
        /* keep the last scores */
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [activeTeamId, lineupLocked, reload, round, roundStatus]);

  const readOnly = lineupLocked || transfer?.windowOpen === false;
  const court = resolveEquipCourt({
    lineupLocked,
    roundStatus,
    current: {
      playerIds: lineup.playerIds,
      captainId: lineup.captainId,
      pointsById: playedVals,
    },
    past,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="truncate text-[10px] uppercase tracking-[0.16em] text-mute">
          {user.teamName}
        </p>
        <TeamSwitcher />
      </div>
      <JornadaPointsHistory onPastCourt={setPast} />
      <div className="min-h-0 flex-1">
        <LineupBuilder
          key={past ? `jornada-${past.round}` : "current"}
          roster={roster!}
          budget={budget}
          savedPlayerIds={savedPlayerIds}
          lineup={lineup}
          onChange={persistLineup}
          saving={saving}
          saveStatus={saveStatus}
          error={actionError}
          readOnly={readOnly}
          caption={court.caption}
          playedVals={court.pointsById}
          courtPlayerIds={past ? court.playerIds : undefined}
          courtCaptainId={past ? court.captainId : undefined}
          snapshotIds={transfer?.snapshotIds ?? []}
          transferUnlimited={Boolean(transfer?.unlimited)}
          maxChanges={transfer?.maxChanges ?? null}
          removalsRemaining={transfer?.removalsRemaining ?? null}
          maxRemovals={transfer?.maxRemovals ?? null}
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
