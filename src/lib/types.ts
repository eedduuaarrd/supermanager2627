export type Position = "base" | "aler" | "pivot";

export type PlayerSource = "documentat" | "placeholder";

export interface Player {
  id: string;
  name: string;
  number: number | null;
  position: Position;
  price: number;
  /** Mitjana de valoració estimada (inspirada en SuperManager). */
  avgVal: number;
  source: PlayerSource;
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
