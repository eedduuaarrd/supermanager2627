"use client";

import type { FantasyTeamInfo, Lineup, Player, SessionUser } from "@/lib/types";
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
export const MAX_TEAMS = 5;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type ManagerContextValue = {
  user: SessionUser;
  teams: FantasyTeamInfo[];
  activeTeamId: string | null;
  maxTeams: number;
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
  switchTeam: (teamId: string) => Promise<void>;
  createTeam: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  renameTeam: (
    teamId: string,
    name: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteTeam: (
    teamId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  clearActionError: () => void;
};

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({
  user: initialUser,
  initialRound,
  children,
}: {
  user: SessionUser;
  initialRound: number;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser>(initialUser);
  const [teams, setTeams] = useState<FantasyTeamInfo[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    initialUser.activeTeamId,
  );
  const [maxTeams, setMaxTeams] = useState(MAX_TEAMS);
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
    const [rosterRes, lineupRes, teamsRes] = await Promise.all([
      fetch("/api/roster"),
      fetch("/api/lineup"),
      fetch("/api/teams"),
    ]);
    if (!rosterRes.ok || !lineupRes.ok || !teamsRes.ok) {
      throw new Error("boot");
    }
    const rosterData = await rosterRes.json();
    const lineupData = await lineupRes.json();
    const teamsData = await teamsRes.json();
    setRoster(rosterData.players);
    setBudget(lineupData.budget);
    setRound(lineupData.round);
    setLineup(lineupData.lineup);
    setTeams(teamsData.teams ?? []);
    setActiveTeamId(teamsData.activeTeamId ?? null);
    setMaxTeams(teamsData.maxTeams ?? MAX_TEAMS);
  }, []);

  useEffect(() => {
    // Boot roster + lineup + teams from API once on mount.
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

  const applyTeamsResponse = useCallback(
    (data: {
      teams?: FantasyTeamInfo[];
      activeTeamId?: string | null;
      user?: SessionUser;
      maxTeams?: number;
    }) => {
      if (data.teams) setTeams(data.teams);
      if (data.activeTeamId !== undefined) setActiveTeamId(data.activeTeamId);
      if (data.user) setUser(data.user);
      if (data.maxTeams) setMaxTeams(data.maxTeams);
    },
    [],
  );

  const switchTeam = useCallback(
    async (teamId: string) => {
      if (teamId === activeTeamId) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      pendingRef.current = null;
      setActionError(null);
      setReady(false);
      try {
        const res = await fetch("/api/teams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeTeamId: teamId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error ?? "No s'ha pogut canviar d'equip.");
          return;
        }
        applyTeamsResponse(data);
        await reload();
      } catch {
        setActionError("No s'ha pogut canviar d'equip.");
      } finally {
        setReady(true);
      }
    },
    [activeTeamId, applyTeamsResponse, reload],
  );

  const createTeam = useCallback(
    async (name: string) => {
      try {
        const res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false as const, error: data.error ?? "Error" };
        applyTeamsResponse(data);
        await reload();
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "No s'ha pogut crear l'equip." };
      }
    },
    [applyTeamsResponse, reload],
  );

  const renameTeamFn = useCallback(
    async (teamId: string, name: string) => {
      try {
        const res = await fetch("/api/teams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, name }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false as const, error: data.error ?? "Error" };
        applyTeamsResponse(data);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "No s'ha pogut canviar el nom." };
      }
    },
    [applyTeamsResponse],
  );

  const deleteTeamFn = useCallback(
    async (teamId: string) => {
      try {
        const res = await fetch(`/api/teams?teamId=${encodeURIComponent(teamId)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) return { ok: false as const, error: data.error ?? "Error" };
        applyTeamsResponse(data);
        await reload();
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "No s'ha pogut eliminar l'equip." };
      }
    },
    [applyTeamsResponse, reload],
  );

  const value = useMemo<ManagerContextValue>(
    () => ({
      user,
      teams,
      activeTeamId,
      maxTeams,
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
      switchTeam,
      createTeam,
      renameTeam: renameTeamFn,
      deleteTeam: deleteTeamFn,
      clearActionError: () => setActionError(null),
    }),
    [
      user,
      teams,
      activeTeamId,
      maxTeams,
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
      switchTeam,
      createTeam,
      renameTeamFn,
      deleteTeamFn,
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
