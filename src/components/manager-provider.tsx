"use client";

import type { Lineup, Player, SessionUser } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const AUTOSAVE_MS = 300;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  saveStatus: SaveStatus;
  reload: () => Promise<void>;
  persistLineup: (next: Lineup) => void;
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Lineup | null>(null);

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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedClearTimer.current) clearTimeout(savedClearTimer.current);
    };
  }, []);

  const flushSave = useCallback(
    async (next: Lineup) => {
      setSaving(true);
      setSaveStatus("saving");
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
          setActionError(data.error ?? "Error en desar");
          setSaveStatus("error");
          await reload();
          return;
        }
        // Avoid clobbering newer local edits while a save was in flight.
        if (pendingRef.current === null) {
          setLineup(data.lineup);
        }
        setRound(data.round);
        setBudget(data.budget);
        setSaveStatus("saved");
        if (savedClearTimer.current) clearTimeout(savedClearTimer.current);
        savedClearTimer.current = setTimeout(() => {
          setSaveStatus((s) => (s === "saved" ? "idle" : s));
        }, 1800);
      } catch {
        setActionError("Error en desar");
        setSaveStatus("error");
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const persistLineup = useCallback(
    (next: Lineup) => {
      const normalized: Lineup = {
        ...next,
        confirmed: false,
        confirmedAt: null,
      };
      setLineup(normalized);
      pendingRef.current = normalized;
      setSaveStatus("saving");
      setActionError(null);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const toSave = pendingRef.current;
        pendingRef.current = null;
        if (toSave) void flushSave(toSave);
      }, AUTOSAVE_MS);
    },
    [flushSave],
  );

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
      saveStatus,
      reload,
      persistLineup,
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
      saveStatus,
      reload,
      persistLineup,
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
