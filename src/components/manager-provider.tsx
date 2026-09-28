"use client";

import type { Lineup, Player, SessionUser } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type ManagerContextValue = {
  user: SessionUser;
  roster: Player[] | null;
  budget: number;
  round: number;
  lineup: Lineup;
  ready: boolean;
  bootError: string | null;
  actionError: string | null;
  saving: boolean;
  confirming: boolean;
  reload: () => Promise<void>;
  persistLineup: (next: Lineup) => Promise<void>;
  confirmLineup: () => Promise<boolean>;
  clearActionError: () => void;
};

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({
  user,
  initialRound,
  children,
}: {
  user: SessionUser;
  initialRound: number;
  children: ReactNode;
}) {
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
    // Boot roster + lineup from API once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch boot
    reload()
      .catch(() =>
        setBootError("No s'han pogut carregar el mercat o l'alineació."),
      )
      .finally(() => setReady(true));
  }, [reload]);

  const persistLineup = useCallback(
    async (next: Lineup) => {
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
    },
    [reload],
  );

  const confirmLineup = useCallback(async () => {
    setActionError(null);
    let ok = false;
    await new Promise<void>((resolve) => {
      startConfirm(async () => {
        try {
          const res = await fetch("/api/lineup/confirm", { method: "POST" });
          const data = await res.json();
          if (!res.ok) {
            setActionError(data.error ?? "No s'ha pogut confirmar.");
            ok = false;
          } else {
            setLineup(data.lineup);
            ok = true;
          }
        } catch {
          setActionError("Error de xarxa en confirmar.");
          ok = false;
        } finally {
          resolve();
        }
      });
    });
    return ok;
  }, []);

  const value = useMemo<ManagerContextValue>(
    () => ({
      user,
      roster,
      budget,
      round,
      lineup,
      ready,
      bootError,
      actionError,
      saving,
      confirming,
      reload,
      persistLineup,
      confirmLineup,
      clearActionError: () => setActionError(null),
    }),
    [
      user,
      roster,
      budget,
      round,
      lineup,
      ready,
      bootError,
      actionError,
      saving,
      confirming,
      reload,
      persistLineup,
      confirmLineup,
    ],
  );

  return (
    <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>
  );
}

export function useManager() {
  const ctx = useContext(ManagerContext);
  if (!ctx) {
    throw new Error("useManager must be used within ManagerProvider");
  }
  return ctx;
}
