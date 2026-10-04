/**
 * Hands-off weekend scoring guard.
 *
 * A fantasy jornada is one Madrid club week (Mon–Sun), not one calendar day.
 * The Sat and Sun 23:59 timers may both run; only one of them may close+advance.
 * Saturday does not close while a later fixture in the week is still ahead.
 * Sunday scores the open jornada from real box rows already stored and opens
 * the next one even when ingest failed or a tracked club side has no box
 * (those players stay DNP). It does not invent stats or results.
 */

export function madridDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Monday–Sunday calendar week in Europe/Madrid. `key` is the Monday date. */
export function madridWeek(anchor = new Date()) {
  const anchorDay = madridDay(anchor);
  const [y, m, d] = anchorDay.split("-").map(Number);
  const utcApprox = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = utcApprox.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(utcApprox);
  monday.setUTCDate(utcApprox.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (dt) => {
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const from = fmt(monday);
  const to = fmt(sunday);
  return { from, to, key: from };
}

export function fixtureDay(f) {
  if (typeof f?.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(f.date)) {
    return f.date.slice(0, 10);
  }
  if (typeof f?.tipOff === "string" && /^\d{4}-\d{2}-\d{2}/.test(f.tipOff)) {
    return f.tipOff.slice(0, 10);
  }
  return null;
}

function gameDay(g) {
  return typeof g?.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(g.date)
    ? g.date.slice(0, 10)
    : null;
}

/** Fixture still to be played (or not yet confirmed) relative to `now`. */
export function isFixtureStillOpen(f, now = new Date()) {
  const today = madridDay(now);
  const day = fixtureDay(f);
  if (day && day > today) return true;
  if (typeof f?.tipOff === "string" && f.tipOff.trim()) {
    const ms = Date.parse(f.tipOff);
    if (Number.isFinite(ms) && ms > now.getTime()) return true;
  }
  if (day === today && !f?.result && !(typeof f?.tipOff === "string" && f.tipOff.trim())) {
    return true;
  }
  return false;
}

/**
 * Club fixtures that belong to the open fantasy jornada:
 * explicitly tagged, or still untagged and dated inside this Madrid week.
 */
export function fixturesForClubWeek(file, round, week) {
  const out = [];
  for (const team of file?.teams ?? []) {
    for (const f of team.fixtures ?? []) {
      const day = fixtureDay(f);
      const inWeek = Boolean(day && day >= week.from && day <= week.to);
      if (f.jornada === round || (f.jornada == null && inWeek)) {
        out.push({
          ...f,
          teamId: team.teamId,
          fcbqTeamId: team.fcbqTeamId,
        });
      }
    }
  }
  return out;
}

function indexFixtures(file) {
  const byUuid = new Map();
  const byTeamDay = new Map();
  for (const team of file?.teams ?? []) {
    for (const f of team.fixtures ?? []) {
      if (typeof f.jornada !== "number") continue;
      if (f.matchCallUuid) byUuid.set(f.matchCallUuid, f.jornada);
      const day = fixtureDay(f);
      if (day) {
        const key = `${team.teamId}|${day}`;
        if (!byTeamDay.has(key)) byTeamDay.set(key, f.jornada);
      }
    }
  }
  return { byUuid, byTeamDay };
}

function lookupFixtureJornada(index, game) {
  if (game?.matchCallUuid && index.byUuid.has(game.matchCallUuid)) {
    return index.byUuid.get(game.matchCallUuid);
  }
  const day = gameDay(game);
  if (day && game?.teamId) {
    const tagged = index.byTeamDay.get(`${game.teamId}|${day}`);
    if (typeof tagged === "number") return tagged;
  }
  return null;
}

/**
 * Untagged box scores → the fixture's jornada when the calendar already
 * tagged that match, otherwise the open round if the date is inside this week.
 * Games outside the week stay untagged (they must not fill an empty jornada).
 */
export function planAssignments(stats, round, week, fixturesFile) {
  const index = indexFixtures(fixturesFile);
  const assignments = [];
  for (const [playerId, rec] of Object.entries(stats?.players ?? {})) {
    (rec.games ?? []).forEach((g, indexInPlayer) => {
      if (typeof g.round === "number" || typeof g.jornada === "number") return;
      const tagged = lookupFixtureJornada(index, g);
      if (tagged != null) {
        assignments.push({ playerId, index: indexInPlayer, round: tagged });
        return;
      }
      const day = gameDay(g);
      if (day && day >= week.from && day <= week.to) {
        assignments.push({ playerId, index: indexInPlayer, round });
      }
    });
  }
  return assignments;
}

export function applyAssignments(stats, assignments) {
  let applied = 0;
  for (const a of assignments ?? []) {
    const g = stats?.players?.[a.playerId]?.games?.[a.index];
    if (!g) continue;
    if (typeof g.round === "number" || typeof g.jornada === "number") continue;
    g.round = a.round;
    g.jornada = a.round;
    applied += 1;
  }
  return applied;
}

/** A club side counts for box-score coverage only when it has fantasy players. */
function teamIsTracked(stats, teamId) {
  for (const rec of Object.values(stats?.players ?? {})) {
    if (rec?.teamId === teamId) return true;
    if ((rec?.games ?? []).some((g) => g.teamId === teamId)) return true;
  }
  return false;
}

function teamHasBoxScore(stats, fixture) {
  const day = fixtureDay(fixture);
  for (const rec of Object.values(stats?.players ?? {})) {
    for (const g of rec.games ?? []) {
      if (g.teamId !== fixture.teamId) continue;
      if (fixture.matchCallUuid && g.matchCallUuid === fixture.matchCallUuid) {
        return true;
      }
      const gDay = gameDay(g);
      if (day && gDay === day) return true;
    }
  }
  return false;
}

function gamesOnRound(stats, round, assignments) {
  let n = 0;
  for (const rec of Object.values(stats?.players ?? {})) {
    for (const g of rec.games ?? []) {
      if (g.round === round || g.jornada === round) n += 1;
    }
  }
  for (const a of assignments ?? []) {
    if (a.round === round) n += 1;
  }
  return n;
}

/**
 * @returns {{
 *   advance: boolean,
 *   reason: string,
 *   week: { from: string, to: string, key: string },
 *   assignments: Array<{ playerId: string, index: number, round: number }>,
 *   missing: Array<{ teamId: string, date: string | null, opponent: string | null }>
 * }}
 */
export function decideWeekendAdvance({
  round,
  fixturesFile,
  stats,
  now = new Date(),
  scoredWeekKey = null,
  ingestOk = false,
  fixturesOk = true,
}) {
  const week = madridWeek(now);
  const assignments = planAssignments(stats, round, week, fixturesFile);
  const base = { week, assignments, missing: [] };
  const sundayClose = isMadridSunday(now);

  if (!fixturesOk) {
    return { advance: false, reason: "fixtures-refresh-failed", ...base };
  }
  if (scoredWeekKey && scoredWeekKey === week.key) {
    return { advance: false, reason: "already-scored-this-week", ...base };
  }

  const club = fixturesForClubWeek(fixturesFile, round, week);
  if (club.length === 0) {
    return { advance: false, reason: "no-club-fixtures", ...base };
  }
  if (club.some((f) => isFixtureStillOpen(f, now))) {
    return { advance: false, reason: "week-still-open", ...base };
  }

  // Saturday (and any non-Sunday run) still refuses a failed ingest or a
  // played fixture with no box. Sunday 23:59 scores whatever real rows are
  // already stored and opens the next jornada anyway.
  if (!sundayClose && !ingestOk) {
    return { advance: false, reason: "stats-ingest-failed", ...base };
  }

  const missing = club
    .filter((f) => teamIsTracked(stats, f.teamId) && !teamHasBoxScore(stats, f))
    .map((f) => ({
      teamId: f.teamId,
      date: fixtureDay(f),
      opponent: f.opponent ?? null,
    }));
  if (!sundayClose && missing.length) {
    return { advance: false, reason: "missing-box-scores", ...base, missing };
  }
  if (!sundayClose && gamesOnRound(stats, round, assignments) === 0) {
    return { advance: false, reason: "no-box-scores", ...base };
  }
  return { advance: true, reason: "ok", ...base, missing };
}

/** True on Sunday in Europe/Madrid (the ideal-team lock-in), not Saturday. */
export function isMadridSunday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(date);
  return weekday === "Sun";
}

/**
 * Jornada the Sunday 23:59 Madrid run should store as the ideal team.
 * Returns null when that jornada is not ready — caller keeps the last lineup.
 *
 * - `advance`: this run is closing `currentRound` (the jornada that just finished).
 * - `already-scored-this-week`: an earlier pass already closed it and opened the
 *   next, so the finished jornada is `currentRound - 1`.
 * Saturday never locks a new ideal team (`isSunday` false).
 */
export function idealRoundToLock({
  isSunday,
  currentRound,
  advance,
  reason,
}) {
  if (!isSunday) return null;
  if (!Number.isInteger(currentRound) || currentRound < 1) return null;
  if (advance) return currentRound;
  if (reason === "already-scored-this-week" && currentRound > 1) {
    return currentRound - 1;
  }
  return null;
}

/**
 * Whether this weekend run should call update-market-prices.
 * Sunday ticks from games already stored, even when ingest failed.
 * Saturday still waits for a successful ingest. The price script keeps
 * the anti-retick: a player only moves when their scored-game count grew.
 */
export function shouldUpdateMarketPrices({
  skipPrices = false,
  ingestOk = false,
  isSunday = false,
} = {}) {
  if (skipPrices) return false;
  if (ingestOk) return true;
  return isSunday;
}
