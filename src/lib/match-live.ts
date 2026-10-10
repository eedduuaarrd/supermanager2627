/**
 * When a club game finishes, score the fantasy players who have a real
 * box score for that game. The minute poll does this as the result lands,
 * not in the Sunday 23:59 batch.
 * A result push goes out once per finished match, from jornada 3 onward,
 * for every club side. Jornada 1 and 2 are scored when the box is real and
 * never notified, including games that finish after match_live_since.
 * No backfill: a tip-off before that clock is scored without a push.
 * An untagged game in the open jornada's Madrid week counts as that
 * jornada, so a Saturday finish does not wait for the 23:59 tag.
 * Missing score, jornada, or standout waits — nothing is invented.
 * A row already marked skipped is scored once when the box exists, still
 * without a push. Ideal-team and jornada-start pushes are untouched.
 */
import { CAPTAIN_MULTIPLIER, getPlayer } from "@/data/roster";
import { getCurrentRound, getDb } from "@/lib/db";
import {
  loadFixtures,
  madridWeekBounds,
  type ClubFixture,
  type FixturesFile,
} from "@/lib/fixtures";
import {
  buildCourtMatchSheets,
  pointsForInProgressCourt,
} from "@/lib/equip-court";
import {
  fantasyStatFromGame,
  getPlayerGameForRound,
  type PlayerGameStat,
} from "@/lib/player-stats";
import { PUSH_TITLE } from "@/lib/push-policy";
import { deliverToAll, ensureVapid, type PushMessage } from "@/lib/push";
import { getRoundStatus } from "@/lib/rounds";
import type { RoundScore, TeamId } from "@/lib/types";
import { computeVal } from "@/lib/val";
import fs from "node:fs";
import path from "node:path";

const BASELINE_KEY = "match_live_since";

/** First fantasy jornada that gets a result push. Earlier jornadas never notify. */
export const MATCH_PUSH_FROM_JORNADA = 3;

const SIDE_NAME: Record<TeamId, string> = {
  "masc-a": "Teixidó",
  "masc-b": "Lo Sifonet",
  "fem-a": "Cudos",
  "fem-b": "Farratges",
};

export type MatchBox = {
  playerId: string;
  name: string;
  teamId: TeamId;
  date: string | null;
  matchCallUuid: string | null;
  pts: number | null;
  pf: number | null;
  tlc: number | null;
  tli: number | null;
  pm: number | null;
  min: number | null;
};

export type PlannedMatch = {
  key: string;
  /** `score` stores fantasy points and does not push. */
  action: "score" | "wait" | "send";
  tipOffMs: number | null;
  message?: PushMessage;
  round: number | null;
  players: { playerId: string; val: number; minutes: number }[];
};

export function matchPushBody(input: {
  side: string;
  sideScore: number;
  opponentScore: number;
  opponent: string;
  playerName: string;
  val: number;
}): string {
  const rounded = Math.round(input.val * 10) / 10;
  const valText = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${input.side} ${input.sideScore}–${input.opponentScore} ${input.opponent}.\nDestacat: ${input.playerName} (VAL ${valText}).`;
}

/** First name + first surname, as on the approved lock screen. */
export function pushPlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
}

export function balaguerPushSide(teamId: TeamId): string {
  return SIDE_NAME[teamId];
}

/** Short opponent label. "CB CAPPONT" → "Cappont". */
export function opponentPushName(raw: string): string {
  let s = raw.trim().replace(/^C\.?\s*B\.?\s+/i, "");
  s = s.replace(/\s+[AB]$/i, "").trim();
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper =
    letters.length > 0 && letters === letters.toLocaleUpperCase("ca");
  if (!upper) return s;
  return s
    .split(/(\s+|-)/)
    .map((part) => {
      if (part === "-" || /^\s+$/.test(part) || part === "") return part;
      return (
        part.charAt(0).toLocaleUpperCase("ca") +
        part.slice(1).toLocaleLowerCase("ca")
      );
    })
    .join("");
}

export function pickStandout(
  players: { playerId: string; name: string; val: number }[],
): { playerId: string; name: string; val: number } | null {
  if (players.length === 0) return null;
  return [...players].sort(
    (a, b) =>
      b.val - a.val ||
      a.name.localeCompare(b.name, "ca") ||
      a.playerId.localeCompare(b.playerId),
  )[0];
}

export function matchKey(
  teamId: string,
  fixture: { date?: string | null; opponent?: string | null; matchCallUuid?: string | null },
): string {
  if (fixture.matchCallUuid) return `${teamId}|${fixture.matchCallUuid}`;
  const day = (fixture.date ?? "").slice(0, 10);
  return `${teamId}|${day}|${(fixture.opponent ?? "").trim()}`;
}

function finiteScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boxVal(box: MatchBox): { val: number; minutes: number } | null {
  const game = {
    date: box.date,
    round: null,
    opponent: null,
    teamId: box.teamId,
    fcbqTeamId: "",
    min: box.min,
    pts: box.pts,
    tlc: box.tlc,
    tli: box.tli,
    pf: box.pf,
    pm: box.pm,
    val: computeVal({
      pts: box.pts,
      pf: box.pf,
      ftm: box.tlc,
      fta: box.tli,
      pm: box.pm,
    }),
  } satisfies PlayerGameStat;
  const stat = fantasyStatFromGame(game);
  if (stat.source !== "VAL") return null;
  return {
    val: stat.points,
    minutes: typeof box.min === "number" ? Math.round(box.min) : 0,
  };
}

function sameGame(box: MatchBox, teamId: string, fixture: ClubFixture): boolean {
  if (box.teamId !== teamId) return false;
  if (fixture.matchCallUuid && box.matchCallUuid) {
    return box.matchCallUuid === fixture.matchCallUuid;
  }
  const day = fixture.date?.slice(0, 10) ?? "";
  const boxDay = box.date?.slice(0, 10) ?? "";
  return Boolean(day && boxDay && day === boxDay);
}

/** Open jornada this fixture counts toward, or null when it must not be scored. */
function openRoundForFixture(
  fixture: ClubFixture,
  currentRound: number,
  roundStatus: "open" | "closed",
  now: Date,
): number | null {
  if (roundStatus !== "open") return null;
  const week = madridWeekBounds(now);
  const day = fixture.date?.slice(0, 10) ?? "";
  if (fixture.jornada === currentRound) return currentRound;
  if (
    (fixture.jornada == null || fixture.jornada === undefined) &&
    day &&
    day >= week.from &&
    day <= week.to
  ) {
    return currentRound;
  }
  return null;
}

/**
 * Jornada this match would notify for.
 * An explicit tag wins. An untagged game counts as the open jornada only
 * when it falls in that Madrid week — the same rule live scoring uses.
 * Otherwise null. Never invent a number.
 */
export function jornadaForMatchPush(
  fixture: ClubFixture,
  currentRound: number,
  roundStatus: "open" | "closed",
  now: Date,
): number | null {
  if (typeof fixture.jornada === "number" && Number.isFinite(fixture.jornada)) {
    return fixture.jornada;
  }
  return openRoundForFixture(fixture, currentRound, roundStatus, now);
}

/**
 * Push only from jornada 3, and only for a tip-off at or after the
 * match-live clock. Jornada 1, jornada 2, an unknown jornada, and any
 * earlier tip-off stay silent.
 */
export function matchEndMayPush(
  jornada: number | null,
  tipOffMs: number,
  baselineMs: number,
): boolean {
  if (jornada == null || jornada < MATCH_PUSH_FROM_JORNADA) return false;
  if (tipOffMs < baselineMs) return false;
  return true;
}

/**
 * Decide what to do with each club fixture.
 * No score numbers and no player VAL are invented: missing data waits.
 * Jornada 1 and 2, and any tip-off before `baselineMs`, are scored without
 * a push when the open jornada already has both scores and a real VAL.
 * They are never stored as a skip. From jornada 3, a later tip-off is
 * scored and pushed once the standout is a real box-score VAL.
 */
export function planClubMatches(input: {
  fixtures: FixturesFile;
  boxes: MatchBox[];
  baselineMs: number;
  now: Date;
  currentRound: number;
  roundStatus: "open" | "closed";
}): PlannedMatch[] {
  const plans: PlannedMatch[] = [];
  for (const team of input.fixtures.teams ?? []) {
    for (const fixture of team.fixtures ?? []) {
      const tipOffMs =
        typeof fixture.tipOff === "string" ? Date.parse(fixture.tipOff) : NaN;
      if (!Number.isFinite(tipOffMs)) continue;
      const key = matchKey(team.teamId, fixture);
      if (tipOffMs > input.now.getTime()) {
        plans.push({ key, action: "wait", tipOffMs, round: null, players: [] });
        continue;
      }
      const sideScore = finiteScore(fixture.teamPoints);
      const opponentScore = finiteScore(fixture.opponentPoints);
      const opponentRaw = fixture.opponent?.trim() ?? "";
      const played = [];
      for (const box of input.boxes) {
        if (!sameGame(box, team.teamId, fixture)) continue;
        const stat = boxVal(box);
        if (!stat) continue;
        played.push({
          playerId: box.playerId,
          name: box.name,
          val: stat.val,
          minutes: stat.minutes,
        });
      }
      const round = openRoundForFixture(
        fixture,
        input.currentRound,
        input.roundStatus,
        input.now,
      );
      if (sideScore == null || opponentScore == null || played.length === 0) {
        plans.push({ key, action: "wait", tipOffMs, round: null, players: [] });
        continue;
      }
      const players = played.map((p) => ({
        playerId: p.playerId,
        val: p.val,
        minutes: p.minutes,
      }));
      const pushJornada = jornadaForMatchPush(
        fixture,
        input.currentRound,
        input.roundStatus,
        input.now,
      );
      if (!matchEndMayPush(pushJornada, tipOffMs, input.baselineMs)) {
        if (round == null) {
          plans.push({ key, action: "wait", tipOffMs, round: null, players: [] });
          continue;
        }
        plans.push({ key, action: "score", tipOffMs, round, players });
        continue;
      }
      const standout = pickStandout(played);
      if (!standout || !opponentRaw) {
        plans.push({ key, action: "wait", tipOffMs, round: null, players: [] });
        continue;
      }
      plans.push({
        key,
        action: "send",
        tipOffMs,
        round,
        players,
        message: {
          title: PUSH_TITLE,
          body: matchPushBody({
            side: balaguerPushSide(team.teamId),
            sideScore,
            opponentScore,
            opponent: opponentPushName(opponentRaw),
            playerName: pushPlayerName(standout.name),
            val: standout.val,
          }),
          url: "/equip",
        },
      });
    }
  }
  return plans;
}

function readBaseline(): number | null {
  const row = getDb()
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .get(BASELINE_KEY) as { value: string } | undefined;
  if (!row) return null;
  const ms = Date.parse(row.value);
  return Number.isFinite(ms) ? ms : null;
}

function writeBaseline(iso: string) {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`,
    )
    .run(BASELINE_KEY, iso);
}

function dispatchOutcome(key: string): string | null {
  const row = getDb()
    .prepare(`SELECT outcome FROM match_dispatch WHERE match_key = ?`)
    .get(key) as { outcome: string } | undefined;
  return row?.outcome ?? null;
}

function claim(key: string, outcome: string): boolean {
  try {
    getDb()
      .prepare(
        `INSERT INTO match_dispatch (match_key, outcome, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(key, outcome, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

function setOutcome(key: string, outcome: string) {
  getDb()
    .prepare(
      `UPDATE match_dispatch SET outcome = ?, created_at = ? WHERE match_key = ?`,
    )
    .run(outcome, new Date().toISOString(), key);
}

/** Replace only the players from this game. Other lineup rows stay as they are. */
export function applyMatchScores(
  round: number,
  players: { playerId: string; val: number; minutes: number }[],
): number {
  if (players.length === 0) return 0;
  const db = getDb();
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const lineups = db
    .prepare(`SELECT team_id, captain_id, player_ids FROM lineups WHERE round = ?`)
    .all(round) as {
    team_id: string;
    captain_id: string | null;
    player_ids: string;
  }[];
  let teams = 0;
  const tx = db.transaction(() => {
    for (const lineup of lineups) {
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(lineup.player_ids) as unknown;
        if (Array.isArray(parsed)) ids = parsed.filter((id) => typeof id === "string");
      } catch {
        ids = [];
      }
      const involved = ids.filter((id) => byId.has(id));
      if (involved.length === 0) continue;
      const existing = db
        .prepare(
          `SELECT scores_json, opponent FROM round_scores WHERE team_id = ? AND round = ?`,
        )
        .get(lineup.team_id, round) as
        | { scores_json: string; opponent: string }
        | undefined;
      let scores: RoundScore[] = [];
      if (existing) {
        try {
          const parsed = JSON.parse(existing.scores_json) as unknown;
          if (Array.isArray(parsed)) scores = parsed as RoundScore[];
        } catch {
          scores = [];
        }
      }
      for (const playerId of involved) {
        const played = byId.get(playerId)!;
        const points =
          playerId === lineup.captain_id
            ? played.val * CAPTAIN_MULTIPLIER
            : played.val;
        const next: RoundScore = {
          playerId,
          points,
          minutes: played.minutes,
          winBonus: false,
          statSource: "VAL",
          val: played.val,
        };
        const idx = scores.findIndex((s) => s.playerId === playerId);
        if (idx >= 0) scores[idx] = next;
        else scores.push(next);
      }
      const teamPoints = scores.reduce((sum, s) => sum + s.points, 0);
      const playedAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO round_scores (team_id, round, points, opponent, won, scores_json, captain_id, played_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT(team_id, round) DO UPDATE SET
           points = excluded.points,
           scores_json = excluded.scores_json,
           captain_id = excluded.captain_id,
           played_at = excluded.played_at`,
      ).run(
        lineup.team_id,
        round,
        teamPoints,
        existing?.opponent ?? "Partit club",
        JSON.stringify(scores),
        lineup.captain_id,
        playedAt,
      );
      teams += 1;
    }
  });
  tx();
  return teams;
}

function readRoundScoreRow(
  teamId: string,
  round: number,
): { scores: RoundScore[]; captainId: string | null } {
  const row = getDb()
    .prepare(
      `SELECT scores_json, captain_id FROM round_scores WHERE team_id = ? AND round = ?`,
    )
    .get(teamId, round) as
    | { scores_json: string; captain_id: string | null }
    | undefined;
  if (!row) return { scores: [], captainId: null };
  try {
    const parsed = JSON.parse(row.scores_json) as unknown;
    return {
      scores: Array.isArray(parsed) ? (parsed as RoundScore[]) : [],
      captainId: row.captain_id,
    };
  } catch {
    return { scores: [], captainId: row.captain_id };
  }
}

export function playedValsForTeam(
  teamId: string,
  round: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const score of readRoundScoreRow(teamId, round).scores) {
    if (score.dnp) continue;
    if (typeof score.val === "number" && Number.isFinite(score.val)) {
      out[score.playerId] = score.val;
    }
  }
  return out;
}

/**
 * Court numbers for the open locked jornada. Does not rewrite scores or totals.
 * Players still waiting stay out of the map. A finished match with a box sheet
 * contributes 0 for lineup players who are not on it.
 */
export function inProgressCourtPointsForTeam(
  teamId: string,
  round: number,
  playerIds: string[],
  lineupCaptainId: string | null = null,
): Record<string, number> {
  const stored = readRoundScoreRow(teamId, round);
  const fixtures = loadFixtures();
  const boxes = loadMatchBoxes();
  return pointsForInProgressCourt({
    round,
    playerIds,
    scores: stored.scores,
    captainId: stored.captainId,
    lineupCaptainId,
    // Same source as the player page: that player's game tagged to this jornada.
    jornadaValOf: (playerId) => {
      const game = getPlayerGameForRound(playerId, round);
      return game ? fantasyStatFromGame(game).points : null;
    },
    teamOf: (playerId) => getPlayer(playerId)?.teamId ?? null,
    matches: buildCourtMatchSheets({
      round,
      teams: fixtures.teams ?? [],
      boxes,
    }),
  });
}

export function loadMatchBoxes(): MatchBox[] {
  const filePath = path.join(process.cwd(), "src/data/player-stats.json");
  if (!fs.existsSync(filePath)) return [];
  let players: Record<string, { games?: unknown[] }> = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      players?: Record<string, { games?: unknown[] }>;
    };
    players = parsed.players ?? {};
  } catch {
    return [];
  }
  const boxes: MatchBox[] = [];
  for (const [playerId, entry] of Object.entries(players)) {
    const player = getPlayer(playerId);
    if (!player) continue;
    for (const raw of entry.games ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const game = raw as Partial<PlayerGameStat> & { matchCallUuid?: string | null };
      if (game.teamId && game.teamId !== player.teamId) continue;
      boxes.push({
        playerId,
        name: player.name,
        teamId: player.teamId,
        date: typeof game.date === "string" ? game.date : null,
        matchCallUuid:
          typeof game.matchCallUuid === "string" ? game.matchCallUuid : null,
        pts: typeof game.pts === "number" ? game.pts : null,
        pf: typeof game.pf === "number" ? game.pf : null,
        tlc: typeof game.tlc === "number" ? game.tlc : null,
        tli: typeof game.tli === "number" ? game.tli : null,
        pm: typeof game.pm === "number" ? game.pm : null,
        min: typeof game.min === "number" ? game.min : null,
      });
    }
  }
  return boxes;
}

export type MatchLiveResult = {
  baseline: string;
  sent: string[];
  skipped: string[];
  waiting: string[];
  scoredTeams: number;
};

/**
 * Seal the first-run clock. Score a finished open-jornada game once.
 * Push once when the match is jornada 3 or later and the tip-off is at or
 * after that clock. Injectable `send` avoids the network.
 */
export async function runMatchLive(opts?: {
  now?: Date;
  fixtures?: FixturesFile;
  boxes?: MatchBox[];
  send?: (message: PushMessage) => Promise<number>;
}): Promise<MatchLiveResult> {
  const now = opts?.now ?? new Date();
  let baselineMs = readBaseline();
  if (baselineMs == null) {
    writeBaseline(now.toISOString());
    baselineMs = Date.parse(now.toISOString());
  }
  const plans = planClubMatches({
    fixtures: opts?.fixtures ?? loadFixtures(),
    boxes: opts?.boxes ?? loadMatchBoxes(),
    baselineMs,
    now,
    currentRound: getCurrentRound(),
    roundStatus: getRoundStatus(),
  });
  const sent: string[] = [];
  const skipped: string[] = [];
  const waiting: string[] = [];
  let scoredTeams = 0;
  for (const plan of plans) {
    const existing = dispatchOutcome(plan.key);
    if (existing === "sent" || existing === "scored") continue;
    const readyToScore =
      (plan.action === "score" || plan.action === "send") &&
      plan.round != null &&
      plan.players.length > 0;
    // A legacy skip is not final. Score once when the box exists; never push.
    if (existing === "skipped") {
      if (!readyToScore) {
        waiting.push(plan.key);
        continue;
      }
      scoredTeams += applyMatchScores(plan.round!, plan.players);
      setOutcome(plan.key, "scored");
      continue;
    }
    if (plan.action === "score") {
      if (!readyToScore) {
        waiting.push(plan.key);
        continue;
      }
      if (existing == null && !claim(plan.key, "pending")) continue;
      scoredTeams += applyMatchScores(plan.round!, plan.players);
      setOutcome(plan.key, "scored");
      continue;
    }
    if (plan.action !== "send" || !plan.message) {
      waiting.push(plan.key);
      continue;
    }
    if (existing == null && !claim(plan.key, "pending")) continue;
    if (plan.round != null) {
      scoredTeams += applyMatchScores(plan.round, plan.players);
    }
    try {
      if (opts?.send) {
        await opts.send(plan.message);
      } else if (!ensureVapid()) {
        setOutcome(plan.key, "failed");
        continue;
      } else {
        await deliverToAll(plan.message);
      }
      setOutcome(plan.key, "sent");
      sent.push(plan.key);
    } catch {
      setOutcome(plan.key, "failed");
    }
  }
  return {
    baseline: new Date(baselineMs).toISOString(),
    sent,
    skipped,
    waiting,
    scoredTeams,
  };
}

/** Sent or scored matches are done. A legacy skip still needs a box and a score. */
export function matchAlreadyScored(outcome: string | null | undefined): boolean {
  return outcome === "sent" || outcome === "scored";
}

/**
 * True when the poll should refresh fixtures and box scores.
 * A current-jornada game that has tipped off and is not yet scored is
 * fetched even when the tip-off is before the baseline or outside the
 * short live window. Other games keep that window.
 */
export function matchNeedsLiveFetch(
  fixtures: FixturesFile,
  baselineMs: number,
  now: Date,
  already: (key: string) => boolean,
  currentRound: number,
  roundStatus: "open" | "closed",
): boolean {
  const horizon = 5 * 60 * 60 * 1000;
  for (const team of fixtures.teams ?? []) {
    for (const fixture of team.fixtures ?? []) {
      if (typeof fixture.tipOff !== "string") continue;
      const tip = Date.parse(fixture.tipOff);
      if (!Number.isFinite(tip) || now.getTime() < tip) continue;
      const key = matchKey(team.teamId, fixture);
      if (already(key)) continue;
      if (openRoundForFixture(fixture, currentRound, roundStatus, now) != null) {
        return true;
      }
      if (tip < baselineMs || now.getTime() - tip > horizon) continue;
      const side = finiteScore(fixture.teamPoints);
      const opp = finiteScore(fixture.opponentPoints);
      if (side == null || opp == null) return true;
    }
  }
  return false;
}
