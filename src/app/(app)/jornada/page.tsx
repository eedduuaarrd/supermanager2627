"use client";

import { BootGate } from "@/components/boot-gate";
import { useManager } from "@/components/manager-provider";
import { TeamSwitcher } from "@/components/team-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LINEUP_SIZE } from "@/data/roster";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

type RoundMeta = {
  round: number;
  status: "open" | "closed";
  label: string;
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
}): { href: string; label: string } | null {
  if (!opts.hasTeams) return null;
  if (opts.status === "closed") {
    return { href: "/classificacio", label: "Veure classificació" };
  }
  if (!lineupComplete(opts.filled, opts.hasCaptain)) {
    return {
      href: "/equip",
      label:
        opts.filled === 0
          ? "Completar equip"
          : `Completar equip · ${opts.filled}/${LINEUP_SIZE}`,
    };
  }
  return { href: "/classificacio", label: "Veure classificació" };
}

function JornadaContent() {
  const { teams, lineup, activeTeamId, maxTeams, createTeam, round } =
    useManager();
  const filled = lineup.playerIds.length;
  const hasCaptain = Boolean(lineup.captainId);
  const hasTeams = teams.length > 0;
  const atLimit = teams.length >= maxTeams;

  const [meta, setMeta] = useState<RoundMeta>({
    round,
    status: "open",
    label: `Jornada ${round}`,
  });
  const [ranks, setRanks] = useState<RankInfo>({
    jornada: null,
    general: null,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
          const data = (await roundRes.json()) as RoundMeta & {
            weeklyNote?: string;
          };
          setMeta({
            round: data.round,
            status: data.status === "closed" ? "closed" : "open",
            label: data.label ?? `Jornada ${data.round}`,
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
        /* hub degrades gracefully */
      }
    }
    void loadHub();
    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  const cta = primaryCta({
    hasTeams,
    filled,
    hasCaptain,
    status: meta.status,
  });
  const open = meta.status === "open";

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createTeam(newName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewName("");
      setCreateOpen(false);
    });
  }

  return (
    <div className="hub-shell relative flex min-h-0 flex-1 flex-col justify-center gap-8 pb-6">
      {/* 1. Jornada */}
      <header className="hub-fade space-y-2">
        <p className="font-display text-3xl tracking-wide text-bone sm:text-4xl">
          {meta.label.toUpperCase()}
          <span className="mx-2 text-mute" aria-hidden>
            ·
          </span>
          <span className={open ? "text-emerald-400" : "text-mute"}>
            {open ? "OBERTA" : "TANCADA"}
          </span>
        </p>
        <p className="text-sm text-mute">Partits nous cada setmana.</p>
      </header>

      {/* 2. Equip actiu + switch / create */}
      <section className="hub-fade-delay space-y-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
          Equip actiu
        </p>

        {hasTeams && !createOpen && (
          <div className="flex flex-wrap items-center gap-3">
            <TeamSwitcher className="min-w-0 flex-1 [&_select]:h-11 [&_select]:max-w-none [&_select]:w-full [&_select]:text-sm [&_p]:text-base [&_p]:text-bone" />
            {!atLimit && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 border border-line px-3 text-xs font-semibold uppercase tracking-wide text-bone hover:bg-white/5"
              >
                <Plus className="size-3.5" /> Nou equip
              </button>
            )}
          </div>
        )}

        {(!hasTeams || createOpen) && (
          <form onSubmit={onCreate} className="space-y-3">
            {!hasTeams && (
              <p className="text-sm text-mute">
                Crea el teu equip per començar.
              </p>
            )}
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-11 border-line bg-panel text-bone"
              placeholder="Nom de l'equip"
              required
              minLength={2}
              maxLength={40}
              autoFocus={createOpen || !hasTeams}
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={pending || atLimit}
                className="hub-cta h-12 flex-1 bg-grana text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
              >
                {hasTeams ? "Crear equip" : "Nou equip"}
              </Button>
              {hasTeams && (
                <Button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setNewName("");
                    setError(null);
                  }}
                  className="h-12 border border-line bg-transparent text-mute hover:bg-white/5"
                >
                  Cancel·la
                </Button>
              )}
            </div>
          </form>
        )}

        {error && <p className="text-sm text-red-200">{error}</p>}
      </section>

      {/* 3. One primary CTA */}
      {cta && !createOpen && (
        <Link
          href={cta.href}
          className={cn(
            "hub-cta hub-fade-delay inline-flex h-14 w-full items-center justify-center text-base font-semibold uppercase tracking-wide",
            "bg-grana text-bone hover:bg-grana-bright",
          )}
        >
          {cta.label}
        </Link>
      )}

      {/* 4. One-line rank */}
      {hasTeams && !createOpen && (
        <p className="hub-rank text-sm text-mute">
          Jornada{" "}
          <span className="font-display text-bone tabular-nums">
            {ranks.jornada != null ? `#${ranks.jornada}` : "—"}
          </span>
          <span className="mx-2 text-line" aria-hidden>
            ·
          </span>
          General{" "}
          <span className="font-display text-bone tabular-nums">
            {ranks.general != null ? `#${ranks.general}` : "—"}
          </span>
        </p>
      )}
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
