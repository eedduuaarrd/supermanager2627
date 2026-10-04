/** Approved lock-screen copy. No preview label. */
export const PUSH_TITLE = "Supermanager";

/** How long after kickoff a start notification may still go out. */
export const JORNADA_START_GRACE_MS = 20 * 60 * 1000;

export function idealPushBody(round: number): string {
  return `Ja pots consultar l'equip ideal de la jornada ${round}.`;
}

export function jornadaStartPushBody(round: number): string {
  return `La jornada ${round} ja ha començat.`;
}

export type PushDecision = "wait" | "send" | "skip";

/**
 * Ideal-team push: only when this run newly stored the lineup.
 * A jornada already saved (or a failed store) does not notify.
 */
export function decideIdealPush(stored: boolean, alreadyDispatched: boolean): PushDecision {
  if (alreadyDispatched) return "wait";
  if (!stored) return "wait";
  return "send";
}

/**
 * Jornada-start push: only while the jornada is still open and `now` is
 * within the grace window after the first real tip-off of this Madrid week.
 * Already started (past the window) or already finished → skip, never send later.
 * No published tip-off → wait. Do not invent a kickoff.
 */
export function decideJornadaStartPush(opts: {
  status: "open" | "closed";
  kickoff: string | null;
  nowMs: number;
  alreadyDispatched: boolean;
  graceMs?: number;
}): PushDecision {
  if (opts.alreadyDispatched) return "wait";
  if (opts.status !== "open") return "skip";
  if (!opts.kickoff) return "wait";
  const kickMs = Date.parse(opts.kickoff);
  if (!Number.isFinite(kickMs)) return "wait";
  if (opts.nowMs < kickMs) return "wait";
  const grace = opts.graceMs ?? JORNADA_START_GRACE_MS;
  if (opts.nowMs - kickMs <= grace) return "send";
  return "skip";
}
