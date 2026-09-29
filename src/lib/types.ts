export type PlayerSource = "fcbq" | "documentat" | "placeholder";

/** Fantasy court position: Base / Aler / Pivot. */
export type Position = "B" | "A" | "P";

/** Short keys for the four CB Balaguer senior sides on FCBQ. */
export type TeamId = "masc-a" | "masc-b" | "fem-a" | "fem-b";

export interface Player {
  id: string;
  name: string;
  number: number | null;
  position: Position;
  /** Current broker market quote (€). */
  price: number;
  /** Previous quote for ↑/↓ UI; null on first seed. */
  prevPrice?: number | null;
  /** Mitjana de valoració (VAL fantasy Balaguer). */
  avgVal: number;
  source: PlayerSource;
  /** Primary (and only) FCBQ senior team for this fantasy id. */
  teamId: TeamId;
  /**
   * Teams this fantasy row belongs to — always .
   * Kept for UI helpers; dual-club people are separate roster rows.
   */
  teamIds: TeamId[];
  /** Points per game from latest FCBQ sample, if any. */
  pts?: number;
  /** Absolute or site-relative photo URL; null → initials placeholder. */
  photoUrl: string | null;
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
  /** VAL when scored from Balaguer formula; omitted for legacy rows. */
  statSource?: "VAL" | "PM";
  dnp?: boolean;
  note?: string;
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

export interface FantasyTeamInfo {
  id: string;
  name: string;
  createdAt: string;
  /** `initial` = unlimited canvis until first tip-off; then `normal`. */
  transferPhase?: "initial" | "normal";
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  /** Active fantasy team name (kept for JWT / UI). */
  teamName: string;
  activeTeamId: string | null;
  isAdmin: boolean;
}
