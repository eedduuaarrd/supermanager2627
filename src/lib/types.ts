export type Position = "base" | "aler" | "pivot";

export type PlayerSource = "fcbq" | "documentat" | "placeholder";

/** Short keys for the four CB Balaguer senior sides on FCBQ. */
export type TeamId = "masc-a" | "masc-b" | "fem-a" | "fem-b";

export interface Player {
  id: string;
  name: string;
  number: number | null;
  position: Position;
  price: number;
  /** Mitjana de valoració (VAL FCBQ o estimada). */
  avgVal: number;
  source: PlayerSource;
  /** Primary FCBQ senior team (short id). */
  teamId: TeamId;
  /** All FCBQ teams where this player appears (dual-roster). */
  teamIds: TeamId[];
  /** Points per game from latest FCBQ sample, if any. */
  pts?: number;
  note?: string;
}

export interface Lineup {
  playerIds: string[];
  captainId: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
}

export interface RoundScore {
  playerId: string;
  points: number;
  minutes: number;
  winBonus: boolean;
}

export interface RoundResult {
  round: number;
  opponent: string;
  won: boolean;
  captainId: string | null;
  scores: RoundScore[];
  teamPoints: number;
  playedAt: string;
}

export interface LeagueMember {
  id: string;
  name: string;
  isYou: boolean;
  totalPoints: number;
  lastRoundPoints: number;
}

export interface GameState {
  managerName: string;
  budget: number;
  lineup: Lineup;
  currentRound: number;
  history: RoundResult[];
  league: LeagueMember[];
  version: number;
}
