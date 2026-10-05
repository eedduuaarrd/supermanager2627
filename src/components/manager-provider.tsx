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

export type TransferInfo = {
  windowOpen: boolean;
  phase?: "initial" | "normal";
  unlimited?: boolean;
  changesUsed: number;
  changesRemaining: number;
  maxChanges: number;
  /** Snapshot players removed this window (baixes). */
  removalsUsed: number;
  /** null when no removal cap applies (unlimited phase / empty snapshot). */
  removalsRemaining: number | null;
  /** null when no removal cap applies (unlimited phase / empty snapshot). */
  maxRemovals: number | null;
  snapshotIds: string[];
  nextWindowAt: string | null;
  message: string | null;
};

function nullableNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseTransferInfo(t: Record<string, unknown>): TransferInfo {
  return {
    windowOpen: Boolean(t.windowOpen),
    phase: t.phase === "initial" ? "initial" : "normal",
    unlimited: Boolean(t.unlimited),
    changesUsed: Number(t.changesUsed ?? 0),
    changesRemaining: Number(t.changesRemaining ?? 0),
    maxChanges: Number(t.maxChanges ?? 3),
    removalsUsed: Number(t.removalsUsed ?? 0),
    removalsRemaining: nullableNumber(t.removalsRemaining),
    maxRemovals: nullableNumber(t.maxRemovals),
    snapshotIds: Array.isArray(t.snapshotIds)
      ? t.snapshotIds.filter((x): x is string => typeof x === "string")
      : [],
    nextWindowAt: typeof t.nextWindowAt === "string" ? t.nextWindowAt : null,
    message: typeof t.message === "string" ? t.message : null,
  };
}

type ManagerContextValue = {
  user: SessionUser;
  teams: FantasyTeamInfo[];
  activeTeamId: string | null;
  maxTeams: number;
  roster: Player[] | null;
  budget: number;
  /** Last persisted player ids — used with cash for draft remaining. */
  savedPlayerIds: string[];
  round: number;
  roundStatus: "open" | "closed";
  lineupLocked: boolean;
  lockAt: string | null;
  lockMessage: string | null;
  transfer: TransferInfo | null;
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
  const [savedPlayerIds, setSavedPlayerIds] = useState<string[]>([]);
  const [round, setRound] = useState(initialRound);
  const [roundStatus, setRoundStatus] = useState<"open" | "closed">("open");
  const [lineupLocked, setLineupLocked] = useState(false);
  const [lockAt, setLockAt] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<TransferInfo | null>(null);
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
    setRoundStatus(
      lineupData.roundStatus === "closed" ? "closed" : "open",
    );
    setLineupLocked(Boolean(lineupData.locked));
    setLockAt(
      typeof lineupData.lockAt === "string" ? lineupData.lockAt : null,
    );
    setLockMessage(
      typeof lineupData.lockMessage === "string"
        ? lineupData.lockMessage
        : null,
    );
    const t = lineupData.transfer;
    if (t && typeof t === "object") {
      setTransfer(parseTransferInfo(t));
    } else {
      setTransfer(null);
    }
    setLineup(lineupData.lineup);
    setSavedPlayerIds(
      Array.isArray(lineupData.lineup?.playerIds)
        ? lineupData.lineup.playerIds
        : [],
    );
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
          setSavedPlayerIds(
            Array.isArray(data.lineup?.playerIds) ? data.lineup.playerIds : [],
          );
        } else {
          setSavedPlayerIds(
            Array.isArray(data.lineup?.playerIds) ? data.lineup.playerIds : [],
          );
        }
        setRound(data.round);
        if (data.roundStatus === "open" || data.roundStatus === "closed") {
          setRoundStatus(data.roundStatus);
        }
        setBudget(data.budget);
        if (data.transfer && typeof data.transfer === "object") {
          const t = data.transfer;
          setTransfer(parseTransferInfo(t));
          if (typeof t.message === "string") setLockMessage(t.message);
        }
        if (typeof data.locked === "boolean") setLineupLocked(data.locked);
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
      if (lineupLocked || roundStatus === "closed") {
        setActionError(
          lockMessage ??
            "L'alineació està bloquejada. No es pot modificar.",
        );
        return;
      }
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
    [flushSave, lineupLocked, lockMessage, roundStatus],
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
      savedPlayerIds,
      round,
      roundStatus,
      lineupLocked,
      lockAt,
      lockMessage,
      transfer,
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
      savedPlayerIds,
      round,
      roundStatus,
      lineupLocked,
      lockAt,
      lockMessage,
      transfer,
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
