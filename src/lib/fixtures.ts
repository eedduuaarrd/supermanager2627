import type { TeamId } from "@/lib/types";
import fs from "node:fs";
import path from "node:path";

export type ClubFixture = {
  date: string | null;
  /** Real tip-off ISO (Europe/Madrid origin). Never invented from date alone. */
  tipOff: string | null;
  home: boolean | null;
  opponent: string | null;
  /** FCBQ Local column when scraped from calendar. */
  homeTeam?: string | null;
  /** FCBQ Visitant column when scraped from calendar. */
  awayTeam?: string | null;
  opponentId?: string | null;
  matchCallUuid?: string | null;
  matchDayNum?: number | null;
  result?: string | null;
  teamPoints?: number | null;
  opponentPoints?: number | null;
  /** Fantasy jornada this fixture counts toward when known. */
  jornada?: number | null;
  competition?: string | null;
};

export type ClubTeamFixtures = {
  fcbqTeamId: string;
  teamId: TeamId;
  slug: string;
  shortName: string;
  /** Full club side name for matchup lines (not the short label). */
  fullName: string;
  fixtures: ClubFixture[];
};

export type FixturesFile = {
  updatedAt?: string;
  source?: string;
  timezone?: string;
  notes?: string[];
  gaps?: string[];
  teams: ClubTeamFixtures[];
};

export type NextMatch = {
  fcbqTeamId: string;
  teamId: TeamId;
  shortName: string;
  fullName: string;
  opponent: string | null;
  tipOff: string | null;
  date: string | null;
  home: boolean | null;
  /** Ready-to-show `{local} vs {visitant}` using FCBQ/full names. */
  matchup: string | null;
  matchCallUuid: string | null;
};

/** Short label → full display name when fixtures.json lacks fullName. */
const FULL_NAME_BY_TEAM_ID: Record<string, string> = {
  "masc-a": "Teixidó Associats A",
  "masc-b": "Lo Sifonet CB Balaguer B",
  "fem-a": "Cudos Consultors CB Balaguer A",
  "fem-b": "Farratges La Noguera CB Balaguer B",
};

export function teamFullName(team: {
  teamId?: string;
  fullName?: string | null;
  shortName?: string;
}): string {
  if (typeof team.fullName === "string" && team.fullName.trim()) {
    return team.fullName.trim();
  }
  if (team.teamId && FULL_NAME_BY_TEAM_ID[team.teamId]) {
    return FULL_NAME_BY_TEAM_ID[team.teamId];
  }
  return team.shortName?.trim() || "Equip";
}

/**
 * Home first, away second — no local/visitant labels.
 * Our side uses the club `fullName`; opponent keeps the FCBQ schedule string.
 */
export function formatMatchupLine(
  ourFullName: string,
  opponent: string | null | undefined,
  home: boolean | null | undefined,
): string | null {
  const them = opponent?.trim() || null;
  if (!them) return null;
  const us = ourFullName.trim() || "Equip";
  if (home === false) return `${them} vs ${us}`;
  return `${us} vs ${them}`;
}

const EMPTY: FixturesFile = { teams: [] };

/** Prefer on-disk JSON so weekend sync is visible without rebuild. */
export function loadFixtures(): FixturesFile {
  try {
    const filePath = path.join(process.cwd(), "src/data/fixtures.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as FixturesFile;
    }
  } catch {
    // fall through
  }
  return EMPTY;
}

function tipOffMs(f: ClubFixture): number | null {
  if (typeof f.tipOff === "string" && f.tipOff.trim()) {
    const t = Date.parse(f.tipOff);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function dateKey(f: ClubFixture): string | null {
  if (typeof f.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(f.date)) {
    return f.date.slice(0, 10);
  }
  if (typeof f.tipOff === "string" && f.tipOff.length >= 10) {
    return f.tipOff.slice(0, 10);
  }
  return null;
}

/** Fixtures that count for a fantasy jornada (explicit tag, else untagged upcoming). */
export function fixturesForJornada(
  jornada: number,
  file = loadFixtures(),
): ClubFixture[] {
  const all: ClubFixture[] = [];
  for (const team of file.teams ?? []) {
    for (const f of team.fixtures ?? []) {
      if (f.jornada === jornada) all.push(f);
    }
  }
  return all;
}

/**
 * Lineup lock = earliest real tip-off among the 4 club teams for that jornada.
 * If no tipOff is published yet, returns null (lineup stays open).
 */
export function computeLineupLockAt(
  jornada: number,
  file = loadFixtures(),
): string | null {
  let min: number | null = null;
  for (const f of fixturesForJornada(jornada, file)) {
    const ms = tipOffMs(f);
    if (ms == null) continue;
    if (min == null || ms < min) min = ms;
  }
  // Also consider untagged fixtures in the same calendar week as tagged ones
  // only when they have tipOff — still no date-only invention.
  if (min == null) {
    for (const team of file.teams ?? []) {
      for (const f of team.fixtures ?? []) {
        if (f.jornada != null && f.jornada !== jornada) continue;
        const ms = tipOffMs(f);
        if (ms == null) continue;
        if (f.jornada == null) continue;
        if (min == null || ms < min) min = ms;
      }
    }
  }
  return min == null ? null : new Date(min).toISOString();
}

export function isLineupLocked(
  lockAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!lockAt) return false;
  const ms = Date.parse(lockAt);
  if (!Number.isFinite(ms)) return false;
  return now.getTime() >= ms;
}

function madridToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pickUpcomingFixture(
  fixtures: ClubFixture[],
  now = new Date(),
): ClubFixture | null {
  const nowMs = now.getTime();
  const today = madridToday(now);

  const upcoming = [...fixtures]
    .map((f) => {
      const tip = tipOffMs(f);
      const dk = dateKey(f);
      let sort = tip;
      if (sort == null && dk) {
        // Date-only: end-of-day Madrid for display order only (not a lock tip-off).
        sort = Date.parse(`${dk}T23:59:59+02:00`);
      }
      return { f, sort, tip, dk };
    })
    .filter((x) => {
      if (x.tip != null) return x.tip >= nowMs;
      if (x.dk) return x.dk >= today;
      return false;
    })
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  return upcoming[0]?.f ?? null;
}

function toNextMatch(
  team: ClubTeamFixtures,
  best: ClubFixture | null,
): NextMatch {
  const fullName = teamFullName(team);
  const opponent = best?.opponent ?? null;
  const home = best?.home ?? null;
  return {
    fcbqTeamId: team.fcbqTeamId,
    teamId: team.teamId,
    shortName: team.shortName,
    fullName,
    opponent,
    tipOff: best?.tipOff ?? null,
    date:
      best?.date ??
      dateKey(
        best ?? { date: null, tipOff: null, home: null, opponent: null },
      ),
    home,
    matchup: best
      ? formatMatchupLine(fullName, opponent, home)
      : null,
    matchCallUuid: best?.matchCallUuid ?? null,
  };
}

/** Next match per club team (by tipOff, else by date). Past-only → null opponent. */
export function nextMatchesForClub(
  now = new Date(),
  file = loadFixtures(),
): NextMatch[] {
  return (file.teams ?? []).map((team) =>
    toNextMatch(team, pickUpcomingFixture(team.fixtures ?? [], now)),
  );
}

/** Next match for one fantasy club side (`masc-a` / dual-team variant teamId). */
export function nextMatchForTeamId(
  teamId: TeamId,
  now = new Date(),
  file = loadFixtures(),
): NextMatch | null {
  const team = (file.teams ?? []).find((t) => t.teamId === teamId);
  if (!team) return null;
  return toNextMatch(team, pickUpcomingFixture(team.fixtures ?? [], now));
}

type GameFixtureHints = {
  opponent?: string | null;
  teamId?: TeamId | string | null;
  round?: number | null;
  jornada?: number | null;
  date?: string | null;
};

function fixtureForGame(
  game: GameFixtureHints,
  file = loadFixtures(),
): ClubFixture | null {
  if (!game.teamId) return null;
  const team = (file.teams ?? []).find((t) => t.teamId === game.teamId);
  if (!team) return null;
  const fixtures = team.fixtures ?? [];
  const jornada =
    typeof game.round === "number"
      ? game.round
      : typeof game.jornada === "number"
        ? game.jornada
        : null;
  if (jornada != null) {
    const byJ = fixtures.find((f) => f.jornada === jornada);
    if (byJ) return byJ;
  }
  const dk =
    typeof game.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(game.date)
      ? game.date.slice(0, 10)
      : null;
  if (dk) {
    return fixtures.find((f) => dateKey(f) === dk) ?? null;
  }
  return null;
}

/**
 * Opponent for a played box-score row. Stats scrape often leaves opponent null —
 * fill from the club calendar by jornada, else by date.
 */
export function opponentForGame(
  game: GameFixtureHints,
  file = loadFixtures(),
): string | null {
  if (typeof game.opponent === "string" && game.opponent.trim()) {
    return game.opponent.trim();
  }
  const fix = fixtureForGame(game, file);
  return fix?.opponent?.trim() || null;
}

/** Calendar date for a box-score row when the scrape omitted it. */
export function dateForGame(
  game: GameFixtureHints,
  file = loadFixtures(),
): string | null {
  if (typeof game.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(game.date)) {
    return game.date.slice(0, 10);
  }
  return dateKey(
    fixtureForGame(game, file) ?? {
      date: null,
      tipOff: null,
      home: null,
      opponent: null,
    },
  );
}

export function formatLockMessageCa(lockAt: string): string {
  try {
    const d = new Date(lockAt);
    const formatted = new Intl.DateTimeFormat("ca-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `Alineació bloquejada des del primer tip-off del club (${formatted}). Només lectura.`;
  } catch {
    return "Alineació bloquejada: el primer partit del club d'aquesta jornada ja ha començat.";
  }
}
