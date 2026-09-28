"use client";

import { BootGate } from "@/components/boot-gate";
import { useManager } from "@/components/manager-provider";
import { TeamManager } from "@/components/team-manager";
import { LINEUP_SIZE } from "@/data/roster";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type RoundMeta = {
  round: number;
  status: "open" | "closed";
  label: string;
  weeklyNote: string;
};

type RankInfo = {
  jornada: number | null;
  general: number | null;
};

function lineupComplete(filled: number, hasCaptain: boolean) {
  return filled >= LINEUP_SIZE && hasCaptain;
}

function primaryCta(opts: {
  hasTeams: boolean;
  filled: number;
  hasCaptain: boolean;
  status: "open" | "closed";
}): { href: string; label: string; tone: "grana" | "muted" } {
  if (!opts.hasTeams) {
    return { href: "#equips", label: "Crea el teu equip", tone: "grana" };
  }
  if (opts.status === "closed") {
    return { href: "/equip", label: "Veure l'equip", tone: "muted" };
  }
  if (opts.filled === 0) {
    return { href: "/equip", label: "Completar alineació", tone: "grana" };
  }
  if (!lineupComplete(opts.filled, opts.hasCaptain)) {
    return {
      href: "/equip",
      label: `Completar alineació · ${opts.filled}/${LINEUP_SIZE}`,
      tone: "grana",
    };
  }
  return { href: "/equip", label: "Anar a Equip", tone: "grana" };
}

function JornadaContent() {
  const { user, teams, round, lineup, activeTeamId } = useManager();
  const filled = lineup.playerIds.length;
  const hasCaptain = Boolean(lineup.captainId);
  const complete = lineupComplete(filled, hasCaptain);
  const hasTeams = teams.length > 0;

  const [meta, setMeta] = useState<RoundMeta>({
    round,
    status: "open",
    label: `Jornada ${round}`,
    weeklyNote: "Cada setmana hi ha jornada nova amb els partits del club.",
  });
  const [ranks, setRanks] = useState<RankInfo>({
    jornada: null,
    general: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadHub() {
      try {
        const [roundRes, jRes, gRes] = await Promise.all([
          fetch("/api/round"),
          fetch("/api/standings?scope=jornada"),
          fetch("/api/standings?scope=general"),
        ]);
        if (cancelled) return;
        if (roundRes.ok) {
          const data = (await roundRes.json()) as RoundMeta;
          setMeta({
            round: data.round,
            status: data.status === "closed" ? "closed" : "open",
            label: data.label ?? `Jornada ${data.round}`,
            weeklyNote:
              data.weeklyNote ??
              "Cada setmana hi ha jornada nova amb els partits del club.",
          });
        }
        if (jRes.ok) {
          const data = await jRes.json();
          const mine = (data.rows as { isYou: boolean; rank: number }[]).find(
            (r) => r.isYou,
          );
          setRanks((r) => ({ ...r, jornada: mine?.rank ?? null }));
        }
        if (gRes.ok) {
          const data = await gRes.json();
          const mine = (data.rows as { isYou: boolean; rank: number }[]).find(
            (r) => r.isYou,
          );
          setRanks((r) => ({ ...r, general: mine?.rank ?? null }));
        }
      } catch {
        /* hub degrades to lineup + round from provider */
      }
    }
    void loadHub();
    return () => {
      cancelled = true;
    };
  }, [activeTeamId, round]);

  const cta = primaryCta({
    hasTeams,
    filled,
    hasCaptain,
    status: meta.status,
  });
  const open = meta.status === "open";

  return (
    <div className="hub-shell relative flex min-h-0 flex-1 flex-col gap-5 pb-3">
      <div className="hub-glow pointer-events-none absolute inset-x-0 -top-6 h-48" aria-hidden />

      {/* Brand + jornada status */}
      <header className="hub-fade relative z-10 pt-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-mute">
          Supermanager Balaguer
        </p>
        <div className="hub-badge mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 border border-line bg-panel/70 px-3 py-2 backdrop-blur-sm">
          <span className="font-display text-2xl leading-none tracking-wide text-bone sm:text-3xl">
            {meta.label}
          </span>
          <span className="text-mute" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              "font-display text-lg tracking-wide sm:text-xl",
              open ? "text-emerald-400" : "text-mute",
            )}
          >
            {open ? "Oberta" : "Tancada"}
          </span>
        </div>
        <p className="hub-fade-delay mt-3 max-w-sm text-sm leading-snug text-mute">
          {meta.weeklyNote}
        </p>
      </header>

      {/* Active team + primary action */}
      <section className="hub-fade-delay relative z-10 space-y-3">
        {hasTeams ? (
          <div className="flex items-center gap-2">
            <span className="truncate rounded-sm border border-line bg-panel-2/80 px-2.5 py-1 text-sm text-bone">
              <span className="mr-1.5 text-[10px] uppercase tracking-[0.16em] text-mute">
                Actiu
              </span>
              {user.teamName}
            </span>
            {!complete && open && (
              <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-amber-200">
                {filled === 0
                  ? "Sense alineació"
                  : `Incompleta · ${filled}/${LINEUP_SIZE}`}
              </span>
            )}
            {complete && open && (
              <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-emerald-400">
                Alineació llesta
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-mute">
            Encara no tens cap equip fantasy. Crea&apos;n un per començar.
          </p>
        )}

        {cta.href.startsWith("#") ? (
          <a
            href={cta.href}
            className={cn(
              "hub-cta inline-flex h-12 w-full items-center justify-center text-sm font-semibold uppercase tracking-wide",
              cta.tone === "grana"
                ? "bg-grana text-bone hover:bg-grana-bright"
                : "border border-line bg-panel-2 text-bone hover:bg-white/10",
            )}
          >
            {cta.label}
          </a>
        ) : (
          <Link
            href={cta.href}
            className={cn(
              "hub-cta inline-flex h-12 w-full items-center justify-center text-sm font-semibold uppercase tracking-wide",
              cta.tone === "grana"
                ? "bg-grana text-bone hover:bg-grana-bright"
                : "border border-line bg-panel-2 text-bone hover:bg-white/10",
            )}
          >
            {cta.label}
          </Link>
        )}

        {/* Compact ranks */}
        {hasTeams && (
          <div className="hub-rank flex items-center justify-between gap-3 border-y border-line/80 py-2.5 text-sm">
            <p className="text-mute">
              Jornada{" "}
              <span className="font-display text-base text-bone tabular-nums">
                {ranks.jornada != null ? `#${ranks.jornada}` : "—"}
              </span>
            </p>
            <span className="text-line" aria-hidden>
              ·
            </span>
            <p className="text-mute">
              General{" "}
              <span className="font-display text-base text-bone tabular-nums">
                {ranks.general != null ? `#${ranks.general}` : "—"}
              </span>
            </p>
            <Link
              href="/classificacio"
              className="ml-auto text-[11px] uppercase tracking-[0.14em] text-grana-bright hover:underline"
            >
              Veure
            </Link>
          </div>
        )}
      </section>

      {/* Teams */}
      <div id="equips" className="hub-fade-late relative z-10">
        <TeamManager />
      </div>
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
