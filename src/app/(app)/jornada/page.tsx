"use client";

import { BootGate } from "@/components/boot-gate";
import { useManager } from "@/components/manager-provider";
import { LINEUP_SIZE } from "@/data/roster";
import { projectedPoints } from "@/lib/game";
import Link from "next/link";

function lineupStatusLabel(
  filled: number,
  confirmed: boolean,
): { label: string; tone: string } {
  if (confirmed) {
    return { label: "Confirmada", tone: "text-emerald-400" };
  }
  if (filled === 0) {
    return { label: "Buida", tone: "text-mute" };
  }
  if (filled < LINEUP_SIZE) {
    return { label: `Incompleta · ${filled}/${LINEUP_SIZE}`, tone: "text-amber-200" };
  }
  return { label: "Completa · pendent de confirmar", tone: "text-grana-bright" };
}

function JornadaContent() {
  const { user, round, lineup } = useManager();
  const filled = lineup.playerIds.length;
  const status = lineupStatusLabel(filled, lineup.confirmed);
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
          Configura 8 jugadors (2 bases, 3 alers, 3 pivots), tria capità (×2) i
          confirma abans que es tanqui la jornada.
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
          {lineup.confirmed
            ? "Ja està bloquejada per a aquesta jornada. Pots consultar la classificació quan es tanqui."
            : "Obre l'equip, omple els slots amb + i confirma quan estigui llesta."}
        </p>
      </section>

      <Link
        href="/equip"
        className="inline-flex h-12 w-full items-center justify-center bg-grana text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
      >
        {lineup.confirmed ? "Veure l'alineació" : "Configura l'alineació"}
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
