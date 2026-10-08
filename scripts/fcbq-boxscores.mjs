/**
 * Merge FCBQ per-game player logs into player-stats.json.
 * Plantilla PJ>1 averages are not box scores — only these game rows score a jornada.
 */
import { computeVal } from "./compute-val.mjs";
import { fantasyIdFor } from "./fcbq-identity.mjs";

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function minutesFromComputed(computed) {
  if (!computed || typeof computed !== "object") return null;
  if (typeof computed.min === "number" && Number.isFinite(computed.min)) {
    return computed.min;
  }
  if (typeof computed.seconds === "number" && Number.isFinite(computed.seconds)) {
    return Math.round((computed.seconds / 60) * 10) / 10;
  }
  return null;
}

/** One msstats player-game object → a player-stats game row (round left null). */
export function gameRowFromLog(raw, ctx) {
  const acc = raw?.accumulated ?? {};
  const computed = raw?.computed ?? {};
  const pts = num(acc.pts);
  const pf = num(acc.fc);
  const tlc = num(acc.ftm ?? acc.t1m);
  const tli = num(acc.fta ?? acc.t1a);
  const pm = num(computed.onCourtPlusMinus ?? acc.pm);
  const min = minutesFromComputed(computed);
  const val = computeVal({ pts, pf, ftm: tlc, fta: tli, pm });
  const opponent =
    typeof raw?.opponent === "string"
      ? raw.opponent
      : raw?.opponent?.name ?? null;
  return {
    date: typeof raw?.date === "string" ? raw.date.slice(0, 10) : null,
    round: null,
    jornada: null,
    opponent: opponent || null,
    teamId: ctx.teamId,
    fcbqTeamId: ctx.fcbqTeamId,
    matchCallUuid: raw?.matchCallUuid ?? null,
    competition: ctx.competition ?? null,
    min,
    pts,
    t2c: num(acc.t2m),
    t2i: num(acc.t2a),
    t3c: num(acc.t3m),
    t3i: num(acc.t3a),
    tlc,
    tli,
    pf,
    val,
    pm,
    note: "Box score FCBQ (partit). VAL fantasy = PTS − FC − (TLI−TLC) + PM.",
  };
}

function sameIdentity(prev, next) {
  if (next.matchCallUuid && prev.matchCallUuid === next.matchCallUuid) return true;
  const prevDay = typeof prev.date === "string" ? prev.date.slice(0, 10) : "";
  const nextDay = typeof next.date === "string" ? next.date.slice(0, 10) : "";
  if (prevDay && nextDay && prevDay === nextDay && prev.teamId === next.teamId) {
    return true;
  }
  return false;
}

function fillGame(prev, next) {
  prev.date = next.date ?? prev.date ?? null;
  prev.opponent = next.opponent ?? prev.opponent ?? null;
  prev.matchCallUuid = next.matchCallUuid ?? prev.matchCallUuid ?? null;
  prev.competition = next.competition ?? prev.competition ?? null;
  prev.fcbqTeamId = next.fcbqTeamId ?? prev.fcbqTeamId;
  prev.min = next.min ?? prev.min ?? null;
  prev.pts = next.pts ?? prev.pts ?? null;
  prev.t2c = next.t2c ?? prev.t2c ?? null;
  prev.t2i = next.t2i ?? prev.t2i ?? null;
  prev.t3c = next.t3c ?? prev.t3c ?? null;
  prev.t3i = next.t3i ?? prev.t3i ?? null;
  prev.tlc = next.tlc ?? prev.tlc ?? null;
  prev.tli = next.tli ?? prev.tli ?? null;
  prev.pf = next.pf ?? prev.pf ?? null;
  prev.pm = next.pm ?? prev.pm ?? null;
  prev.val = next.val ?? prev.val ?? null;
  prev.note = next.note;
  if (prev.round == null && prev.jornada != null) prev.round = prev.jornada;
  if (prev.jornada == null && prev.round != null) prev.jornada = prev.round;
}

/**
 * msstats lists a called-up player who never got on court as a game with
 * 0 seconds and all-zero counters. FCBQ's PJ does not count it, and storing
 * it would invent a 0-VAL "game" (prices/averages). Treat it as not played.
 */
export function isNotPlayedLog(raw) {
  const computed = raw?.computed ?? {};
  const acc = raw?.accumulated ?? {};
  const seconds =
    typeof computed.seconds === "number"
      ? computed.seconds
      : typeof computed.min === "number"
        ? computed.min * 60
        : null;
  if (seconds !== 0) return false;
  const counters = [acc.pts, acc.t2m, acc.t3m, acc.ftm, acc.fta, acc.fc];
  if (counters.some((v) => typeof v === "number" && v !== 0)) return false;
  const pm = computed.onCourtPlusMinus ?? acc.pm;
  return !(typeof pm === "number" && pm !== 0);
}

/**
 * Merge one player's published game log into their existing history.
 * The earliest undated legacy row (PJ=1 seed) absorbs the earliest new game
 * so jornada 1 is not duplicated. Later games stay untagged for weekend sync.
 * Returns how many brand-new rows were appended.
 */
export function mergePlayerLog(entry, incomingGames, ctx) {
  const games = Array.isArray(entry.games) ? entry.games : [];
  entry.games = games;
  const sorted = [...incomingGames].filter((raw) => !isNotPlayedLog(raw)).sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || "")),
  );
  const consumed = new Set();
  let appended = 0;

  for (const raw of sorted) {
    const row = gameRowFromLog(raw, ctx);
    const match = games.find((g, i) => !consumed.has(i) && sameIdentity(g, row));
    if (match) {
      consumed.add(games.indexOf(match));
      fillGame(match, row);
      continue;
    }
    const legacyIdx = games.findIndex(
      (g, i) =>
        !consumed.has(i) &&
        g.teamId === ctx.teamId &&
        !g.matchCallUuid &&
        (g.date == null || g.date === ""),
    );
    if (legacyIdx >= 0) {
      consumed.add(legacyIdx);
      fillGame(games[legacyIdx], row);
      continue;
    }
    games.push(row);
    consumed.add(games.length - 1);
    appended += 1;
  }
  entry.source = "fcbq-player-game-log";
  if (ctx.fcbqPersonId) entry.fcbqPersonId = ctx.fcbqPersonId;
  if (ctx.fcbqName) entry.fcbqName = ctx.fcbqName;
  if (ctx.teamId) entry.teamId = ctx.teamId;
  delete entry.seasonNote;
  return appended;
}

/**
 * @param {object} existing player-stats document
 * @param {Array<{ fcbqTeamId: string, competition?: string, players: Array<{ uuid?: string, name: string, games: object[], gamesPlayed?: number }> }>} teamLogs
 * @param {{ roster?: Map<string, string[]> }} [options] fantasy roster
 *   (id → teamIds) from parseRosterTeams. When given, a mapped id that is not
 *   in the roster is `unmatched`, and a game for a side the roster entry does
 *   not belong to is `offRoster` (kept out of that player's history).
 *
 * `unmatched` lists federation players with real games that cannot land on a
 * fantasy roster entry. The ingest treats any of them as not ok so a missing
 * identity mapping is noticed instead of silently scoring that player as DNP.
 * Players without a game (bench/DNP, restricted logs already dropped) never
 * count as unmatched.
 */
export function mergeTeamLogs(existing, teamLogs, options = {}) {
  const roster = options.roster instanceof Map ? options.roster : null;
  const players = {};
  for (const [pid, prev] of Object.entries(existing.players ?? {})) {
    players[pid] = {
      ...prev,
      games: Array.isArray(prev.games) ? prev.games.map((g) => ({ ...g })) : [],
    };
  }

  const expectations = [];
  const unmapped = [];
  const unmatched = [];
  const offRoster = [];
  let appended = 0;

  for (const team of teamLogs ?? []) {
    for (const p of team.players ?? []) {
      const played = (p.games ?? []).filter((g) => !isNotPlayedLog(g));
      const id = fantasyIdFor(p.name, team.fcbqTeamId);
      if (!id) {
        unmapped.push(p.name);
        if (played.length > 0) {
          unmatched.push({
            name: p.name,
            fcbqTeamId: team.fcbqTeamId,
            reason: "no-identity",
            games: played.length,
          });
        }
        continue;
      }
      if (roster) {
        const teamIds = roster.get(id.playerId);
        if (!teamIds) {
          if (played.length > 0) {
            unmatched.push({
              name: p.name,
              fcbqTeamId: team.fcbqTeamId,
              playerId: id.playerId,
              reason: "not-in-roster",
              games: played.length,
            });
          }
          continue;
        }
        if (!teamIds.includes(id.teamId)) {
          if (played.length > 0) {
            offRoster.push({
              name: p.name,
              playerId: id.playerId,
              teamId: id.teamId,
              rosterTeamIds: teamIds,
              games: played.length,
            });
          }
          continue;
        }
      }
      const entry = (players[id.playerId] ??= {
        playerId: id.playerId,
        fcbqName: p.name,
        fcbqPersonId: p.uuid ?? null,
        teamId: id.teamId,
        games: [],
        source: "fcbq-player-game-log",
      });
      appended += mergePlayerLog(entry, p.games ?? [], {
        teamId: id.teamId,
        fcbqTeamId: team.fcbqTeamId,
        competition: team.competition ?? null,
        fcbqPersonId: p.uuid ?? null,
        fcbqName: p.name,
      });
      expectations.push({
        playerId: id.playerId,
        teamId: id.teamId,
        name: p.name,
        gamesPlayed: typeof p.gamesPlayed === "number" ? p.gamesPlayed : played.length,
      });
    }
  }

  return {
    players,
    appended,
    unmapped,
    unmatched,
    offRoster,
    expectations,
  };
}

/**
 * msstats answers HTTP 405 + error 1002021 when a player's own log is
 * restricted ("Les estadístiques del jugador/a han estat restringides").
 * That player is ignored. Roster totals are not turned into a game row.
 */
export function isRestrictedPlayerStats(status, body) {
  if (status !== 405 || !body || typeof body !== "object") return false;
  if (String(body.error) === "1002021") return true;
  return typeof body.message === "string" && /restringid/i.test(body.message);
}

/**
 * Player log to merge. A restricted personal URL is skipped with no box.
 * Any other HTTP failure stays fatal for the side.
 */
export function resolvePlayerLog(person, result) {
  if (result?.status === 200) {
    const games = Array.isArray(result.games) ? result.games : [];
    return {
      games,
      gamesPlayed:
        typeof person?.gamesPlayed === "number" ? person.gamesPlayed : games.length,
    };
  }
  if (isRestrictedPlayerStats(result?.status, result?.body)) {
    return { skip: true, reason: "restricted" };
  }
  return { fatal: true };
}

/** Players whose stored rows don't cover the published gamesPlayed. */
export function coverageGaps(statsPlayers, expectations) {
  const gaps = [];
  for (const e of expectations ?? []) {
    const rows = (statsPlayers?.[e.playerId]?.games ?? []).filter(
      (g) => g.teamId === e.teamId,
    );
    if (rows.length < e.gamesPlayed) {
      gaps.push({
        playerId: e.playerId,
        name: e.name,
        teamId: e.teamId,
        gamesPlayed: e.gamesPlayed,
        stored: rows.length,
      });
    }
  }
  return gaps;
}
