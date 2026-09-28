import { GAME_VERSION } from "@/data/roster";
import { createInitialState } from "@/lib/game";
import type { GameState } from "@/lib/types";

const STORAGE_KEY = "supermanager-balaguer-v2";

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== GAME_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode — ignore; UI shows error via caller if needed
  }
}

export function clearGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function bootstrapGame(managerName?: string): GameState {
  const existing = loadGame();
  if (existing) return existing;
  const fresh = createInitialState(managerName);
  saveGame(fresh);
  return fresh;
}
