"use client";

import { BootGate } from "@/components/boot-gate";
import { useManager } from "@/components/manager-provider";
import { LINEUP_SIZE } from "@/data/roster";
import { projectedPoints } from "@/lib/game";
import Link from "next/link";

function lineupStatusLabel(filled: number, hasCaptain: boolean): {
  label: string;
  tone: string;
} {
  if (filled === 0) {
    return { label: "Buida", tone: "text-mute" };
  }
  if (filled < LINEUP_SIZE) {
    return {
      label: `Incompleta · ${filled}/${LINEUP_SIZE}`,
      tone: "text-amber-200",
    };
  }
  if (!hasCaptain) {
    return { label: "Completa · sense capità", tone: "text-amber-200" };
  }
  return { label: "Desada", tone: "text-emerald-400" };
}

function JornadaContent() {
  const { user, round, lineup } = useManager();
  const filled = lineup.playerIds.length;
  const status = lineupStatusLabel(filled, Boolean(lineup.captainId));
  const projected = projectedPoints(lineup);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] text-mute">
          {user.teamName}
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-bone">
          Jornada {round}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">
          Configura fins a 8 jugadors (qualsevol mix) i tria capità (×2).
          L&apos;alineació es desa sola; es puntua quan l&apos;admin tanca la
          jornada.
        </p>
      </section>

      <section className="border border-line bg-panel/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
              Estat de l&apos;alineació
            </p>
            <p className={`mt-1 font-display text-2xl ${status.tone}`}>
              {status.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
              Proj.
            </p>
            <p className="font-display text-2xl text-grana-bright tabular-nums">
              {projected}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-mute">
          {filled === 0
            ? "Obre l'equip i afegeix jugadors amb +. Es desa automàticament."
            : "Pots continuar editant fins que es tanqui la jornada."}
        </p>
      </section>

      <Link
        href="/equip"
        className="inline-flex h-12 w-full items-center justify-center bg-grana text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
      >
        {filled === 0 ? "Configura l'alineació" : "Edita l'alineació"}
      </Link>

      <p className="text-center text-xs text-mute">
        Pressupost 100.000 · Capità ×2 · Classificació jornada + general
      </p>
    </div>
  );
}

export default function JornadaPage() {
  return (
    <BootGate>
      <JornadaContent />
    </BootGate>
  );
}
