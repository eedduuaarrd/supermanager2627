/**
 * Finestra de transferències + límit de 3 canvis (Supermanager Balaguer).
 *
 * Definició de «canvi» (Català):
 * - Es pren una instantània (snapshot) dels ids de jugador dels 8 slots quan
 *   es tanca la finestra anterior / es bloqueja la jornada (o buida si l'equip
 *   és nou).
 * - Durant la finestra oberta, cada jugador que és a l'alineació guardada i
 *   NO era a l'instantània compta com a 1 canvi.
 * - Treure un jugador sense substituir-lo allibera un slot però no consumeix
 *   canvi. Substituir = treure + afegir = 1 canvi (l'afegit). Omplir un slot
 *   buit amb un jugador nou = 1 canvi. Tornar a posar algú que ja era a
 *   l'instantània = 0.
 * - Màxim 3 canvis per equip fantasy i per jornada.
 *
 * Finestra: diumenge 23:59 Europe/Madrid → primer tip-off de la jornada.
 * Fora de la finestra (després del tip-off fins al proper diumenge 23:59):
 * només lectura.
 */

import { parsePlayerIds } from "@/lib/game";

export const MAX_TRANSFERS = 3;
export const MADRID_TZ = "Europe/Madrid";

export type TransferState = {
  windowOpen: boolean;
  changesUsed: number;
  changesRemaining: number;
  maxChanges: number;
  snapshotIds: string[];
  nextWindowAt: string | null;
  lockAt: string | null;
  message: string | null;
};

export function countChangesUsed(
  snapshotIds: string[],
  currentIds: string[],
): number {
  const snap = new Set(snapshotIds.filter(Boolean));
  const seen = new Set<string>();
  let n = 0;
  for (const id of currentIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!snap.has(id)) n += 1;
  }
  return n;
}

export function parseSnapshotIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return parsePlayerIds(raw);
}

export function nextSundayWindowOpenAt(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (let addDays = 0; addDays <= 8; addDays++) {
    const probe = new Date(now.getTime() + addDays * 86_400_000);
    const parts = Object.fromEntries(
      fmt.formatToParts(probe).map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    if (parts.weekday !== "Sun") continue;

    const y = parts.year;
    const m = parts.month;
    const d = parts.day;
    for (const offset of ["+02:00", "+01:00"]) {
      const candidate = new Date(`${y}-${m}-${d}T23:59:00${offset}`);
      const check = Object.fromEntries(
        fmt.formatToParts(candidate).map((p) => [p.type, p.value]),
      ) as Record<string, string>;
      if (
        check.weekday === "Sun" &&
        check.hour === "23" &&
        check.minute === "59" &&
        check.day === d
      ) {
        if (candidate.getTime() <= now.getTime()) continue;
        return candidate.toISOString();
      }
    }
  }

  return new Date(now.getTime() + 7 * 86_400_000).toISOString();
}

export function formatNextWindowCa(iso: string): string {
  try {
    const d = new Date(iso);
    const formatted = new Intl.DateTimeFormat("ca-ES", {
      timeZone: MADRID_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `Propera finestra de transferències: ${formatted} (hora de Madrid).`;
  } catch {
    return "Propera finestra de transferències: diumenge a les 23:59 (Madrid).";
  }
}

export function changesRemainingLabelCa(
  used: number,
  max = MAX_TRANSFERS,
): string {
  const left = Math.max(0, max - used);
  return `Et queden ${left}/${max} canvis`;
}

export function maxChangesExceededCa(max = MAX_TRANSFERS): string {
  return `Has esgotat els ${max} canvis d'aquesta finestra. Només pots treure jugadors o tornar a posar els de l'instantània.`;
}

export function windowClosedMessageCa(
  lockAt: string | null,
  tipLockMessage: string | null,
): string {
  const next = formatNextWindowCa(nextSundayWindowOpenAt());
  if (tipLockMessage) return `${tipLockMessage} ${next}`;
  if (lockAt) return `Finestra de transferències tancada. ${next}`;
  return `Fora de la finestra de transferències (diumenge 23:59 Madrid → primer tip-off). ${next}`;
}

export function buildTransferState(opts: {
  windowOpen: boolean;
  snapshotIds: string[];
  currentIds: string[];
  lockAt: string | null;
  tipLockMessage: string | null;
}): TransferState {
  const changesUsed = countChangesUsed(opts.snapshotIds, opts.currentIds);
  const changesRemaining = Math.max(0, MAX_TRANSFERS - changesUsed);
  if (!opts.windowOpen) {
    return {
      windowOpen: false,
      changesUsed,
      changesRemaining,
      maxChanges: MAX_TRANSFERS,
      snapshotIds: opts.snapshotIds,
      nextWindowAt: nextSundayWindowOpenAt(),
      lockAt: opts.lockAt,
      message: windowClosedMessageCa(opts.lockAt, opts.tipLockMessage),
    };
  }
  return {
    windowOpen: true,
    changesUsed,
    changesRemaining,
    maxChanges: MAX_TRANSFERS,
    snapshotIds: opts.snapshotIds,
    nextWindowAt: null,
    lockAt: opts.lockAt,
    // No permanent “Et queden X/3” banner — surface maxChangesExceededCa only on save reject.
    message: null,
  };
}
