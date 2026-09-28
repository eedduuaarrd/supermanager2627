"use client";

import { LineupBuilder } from "@/components/lineup-builder";
import { StandingsPanel } from "@/components/standings-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Lineup, Player, SessionUser } from "@/lib/types";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

type Props = {
  user: SessionUser;
  initialRound: number;
};

export function ManagerApp({ user, initialRound }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState("equip");
  const [roster, setRoster] = useState<Player[] | null>(null);
  const [budget, setBudget] = useState(100_000);
  const [round, setRound] = useState(initialRound);
  const [lineup, setLineup] = useState<Lineup>({
    playerIds: [],
    captainId: null,
    confirmed: false,
    confirmedAt: null,
  });
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, startConfirm] = useTransition();

  const reload = useCallback(async () => {
    const [rosterRes, lineupRes] = await Promise.all([
      fetch("/api/roster"),
      fetch("/api/lineup"),
    ]);
    if (!rosterRes.ok || !lineupRes.ok) {
      throw new Error("boot");
    }
    const rosterData = await rosterRes.json();
    const lineupData = await lineupRes.json();
    setRoster(rosterData.players);
    setBudget(lineupData.budget);
    setRound(lineupData.round);
    setLineup(lineupData.lineup);
  }, []);

  useEffect(() => {
    reload()
      .catch(() => setBootError("No s'han pogut carregar el mercat o l'alineació."))
      .finally(() => setReady(true));
  }, [reload]);

  async function persistLineup(next: Lineup) {
    setLineup(next);
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/lineup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: next.playerIds,
          captainId: next.captainId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "No s'ha pogut desar.");
        await reload();
        return;
      }
      setLineup(data.lineup);
      setRound(data.round);
      setBudget(data.budget);
    } catch {
      setActionError("Error de xarxa en desar l'alineació.");
    } finally {
      setSaving(false);
    }
  }

  function handleConfirm() {
    setActionError(null);
    startConfirm(async () => {
      const res = await fetch("/api/lineup/confirm", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "No s'ha pogut confirmar.");
        return;
      }
      setLineup(data.lineup);
      setTab("classificacio");
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="size-8 animate-spin text-mute" />
        <p className="text-mute">Carregant el mercat…</p>
      </div>
    );
  }

  if (bootError || !roster) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="size-10 text-grana-bright" />
        <h2 className="font-display text-3xl text-bone">Error de càrrega</h2>
        <p className="text-mute">{bootError}</p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-grana text-bone hover:bg-grana-bright"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mute">
            {user.teamName}
          </p>
          <p className="font-medium text-bone">{user.displayName}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={logout}
          className="text-mute hover:bg-white/10 hover:text-bone"
        >
          <LogOut className="size-4" /> Surt
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 rounded-sm border border-line bg-panel p-1">
          <TabsTrigger
            value="equip"
            className="rounded-sm data-active:bg-grana data-active:text-bone"
          >
            Equip
          </TabsTrigger>
          <TabsTrigger
            value="classificacio"
            className="rounded-sm data-active:bg-grana data-active:text-bone"
          >
            Classificació
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equip">
          <LineupBuilder
            roster={roster}
            budget={budget}
            lineup={lineup}
            currentRound={round}
            onChange={persistLineup}
            onConfirm={handleConfirm}
            confirming={confirming}
            saving={saving}
            error={actionError}
          />
        </TabsContent>

        <TabsContent value="classificacio">
          <StandingsPanel
            isAdmin={user.isAdmin}
            onSimulated={() => {
              void reload();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
