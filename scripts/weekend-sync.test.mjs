import assert from "node:assert/strict";
import test from "node:test";
import { buildFromRosters } from "./refresh-fcbq-stats.mjs";
import { mergeTeamLogs, coverageGaps } from "./fcbq-boxscores.mjs";
import {
  applyAssignments,
  decideWeekendAdvance,
  madridDay,
  madridWeek,
} from "./fcbq-weekend-guard.mjs";

const MASC = "5f55017e-893e-4323-8b41-b58323ea8f73";
const FEMB = "a5c75f3f-ca35-4553-9eb6-a29780eb2007";

const SAT = new Date("2026-10-03T21:59:00Z"); // 23:59 Europe/Madrid
const SUN = new Date("2026-10-04T21:59:00Z");

function clubFile() {
  return {
    teams: [
      {
        fcbqTeamId: MASC,
        teamId: "masc-a",
        fixtures: [
          {
            date: "2026-10-03",
            tipOff: "2026-10-03T18:30:00+02:00",
            opponent: "CB CAPPONT",
            result: "W",
            jornada: 2,
          },
        ],
      },
      {
        fcbqTeamId: FEMB,
        teamId: "fem-b",
        fixtures: [
          {
            date: "2026-10-04",
            tipOff: "2026-10-04T12:00:00+02:00",
            opponent: "CB CASTELLET",
            result: null,
            jornada: 2,
          },
        ],
      },
    ],
  };
}

function game(partial) {
  return {
    date: "2026-10-03",
    round: null,
    jornada: null,
    teamId: "masc-a",
    pts: 8,
    pf: 2,
    tlc: 1,
    tli: 2,
    pm: 3,
    ...partial,
  };
}

test("Madrid Sat and Sun share one club week", () => {
  assert.equal(madridDay(SAT), "2026-10-03");
  assert.equal(madridDay(SUN), "2026-10-04");
  const satWeek = madridWeek(SAT);
  const sunWeek = madridWeek(SUN);
  assert.equal(satWeek.key, sunWeek.key);
  assert.equal(satWeek.from, "2026-09-28");
  assert.equal(satWeek.to, "2026-10-04");
});

test("Saturday does not advance while a Sunday fixture is still ahead", () => {
  const stats = {
    players: {
      "marc-escoda": { games: [game({})] },
    },
  };
  const decision = decideWeekendAdvance({
    round: 2,
    fixturesFile: clubFile(),
    stats,
    now: SAT,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(decision.advance, false);
  assert.equal(decision.reason, "week-still-open");
  assert.equal(decision.assignments.length, 1);
  assert.equal(decision.assignments[0].round, 2);
});

test("Sunday advances once when every played fixture has a box score", () => {
  const stats = {
    players: {
      "marc-escoda": {
        games: [game({ round: 2, jornada: 2 })],
      },
      "jana-alarcon": {
        games: [
          game({
            date: "2026-10-04",
            teamId: "fem-b",
            round: null,
            jornada: null,
          }),
        ],
      },
    },
  };
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = "L";
  const first = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(first.advance, true, first.reason);
  assert.equal(first.reason, "ok");
  assert.equal(applyAssignments(stats, first.assignments), 1);
  assert.equal(stats.players["jana-alarcon"].games[0].jornada, 2);

  const second = decideWeekendAdvance({
    round: 3,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    scoredWeekKey: first.week.key,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(second.advance, false);
  assert.equal(second.reason, "already-scored-this-week");
});

test("Sunday after an early advance does not score an empty next jornada", () => {
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = "L";
  const stats = {
    players: {
      "marc-escoda": { games: [game({ round: 2, jornada: 2, date: "2026-10-03" })] },
      "jana-alarcon": {
        games: [game({ round: 2, jornada: 2, date: "2026-10-04", teamId: "fem-b" })],
      },
    },
  };
  const decision = decideWeekendAdvance({
    round: 3,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(decision.advance, false);
  assert.equal(decision.reason, "no-club-fixtures");
});

test("box scores for an already-tagged jornada are not retagged onto the open round", () => {
  const fixtures = clubFile();
  const stats = {
    players: {
      "jana-alarcon": {
        games: [
          game({
            date: "2026-10-04",
            teamId: "fem-b",
            round: null,
            jornada: null,
          }),
        ],
      },
    },
  };
  const decision = decideWeekendAdvance({
    round: 3,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(decision.advance, false);
  assert.equal(decision.assignments.length, 1);
  assert.equal(decision.assignments[0].round, 2);
});

test("missing box score for a played fixture does not advance", () => {
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = "L";
  const stats = {
    players: {
      "marc-escoda": { teamId: "masc-a", games: [game({ round: 2, jornada: 2 })] },
      "jana-alarcon": {
        teamId: "fem-b",
        games: [game({ date: "2026-09-27", teamId: "fem-b", round: 1, jornada: 1 })],
      },
    },
  };
  const decision = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(decision.advance, false);
  assert.equal(decision.reason, "missing-box-scores");
  assert.deepEqual(
    decision.missing.map((m) => m.teamId),
    ["fem-b"],
  );
});

test("a club side with no fantasy players does not block the week", () => {
  const fixtures = clubFile();
  fixtures.teams.push({
    fcbqTeamId: "c057eeae-3aae-4e33-b2ab-54fabb2700ae",
    teamId: "masc-b",
    fixtures: [
      {
        date: "2026-10-03",
        tipOff: "2026-10-03T20:00:00+02:00",
        opponent: "AGROLLOBERA",
        result: "W",
        jornada: 2,
      },
    ],
  });
  fixtures.teams[1].fixtures[0].result = "L";
  const stats = {
    players: {
      "marc-escoda": { teamId: "masc-a", games: [game({ round: 2, jornada: 2 })] },
      "jana-alarcon": {
        teamId: "fem-b",
        games: [game({ date: "2026-10-04", teamId: "fem-b", round: 2, jornada: 2 })],
      },
    },
  };
  const decision = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: true,
  });
  assert.equal(decision.advance, true, decision.reason);
  assert.equal(decision.missing.length, 0);
});

test("stale or failed ingest and failed fixtures never advance", () => {
  const stats = {
    players: { "marc-escoda": { games: [game({ round: 2, jornada: 2 })] } },
  };
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = "L";
  const ingest = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(ingest.reason, "stats-ingest-failed");
  assert.equal(ingest.advance, false);
  const fixturesFail = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: true,
    fixturesOk: false,
  });
  assert.equal(fixturesFail.reason, "fixtures-refresh-failed");
  assert.equal(fixturesFail.advance, false);
});

test("PJ>1 plantilla averages do not append a game row", () => {
  const existing = {
    players: {
      "marc-escoda": {
        playerId: "marc-escoda",
        teamId: "masc-a",
        games: [game({ round: 1, jornada: 1, date: null, pts: 6, min: 18 })],
      },
    },
  };
  const out = buildFromRosters(
    {
      teams: [
        {
          id: MASC,
          competition: "Lliga",
          players: [
            {
              name: "MARC ESCODA ANGERRI",
              stats: { PJ: 2, PTS: 10, MIN: 20, FC: 2, TLC: 0, TLI: 0, PM: 1 },
            },
          ],
        },
      ],
    },
    existing,
  );
  assert.equal(out.players["marc-escoda"].games.length, 1);
  assert.equal(out.players["marc-escoda"].games[0].jornada, 1);
  assert.match(out.players["marc-escoda"].seasonNote, /PJ=2/);
});

test("per-game log fills the PJ=1 seed and appends the new jornada untagged", () => {
  const existing = {
    players: {
      "marc-escoda": {
        playerId: "marc-escoda",
        teamId: "masc-a",
        games: [
          {
            date: null,
            round: 1,
            jornada: 1,
            teamId: "masc-a",
            pts: 6,
            min: 18,
            pf: 3,
            pm: 4,
            tlc: 0,
            tli: 0,
          },
        ],
      },
    },
  };
  const log = (date, uuid, pts) => ({
    date,
    matchCallUuid: uuid,
    opponent: { name: "Rival" },
    accumulated: { pts, t2m: 1, t3m: 0, ftm: 0, fta: 0, fc: 2 },
    computed: { seconds: 600, onCourtPlusMinus: 1 },
  });
  const merged = mergeTeamLogs(existing, [
    {
      fcbqTeamId: MASC,
      competition: "Lliga",
      players: [
        {
          uuid: "person-1",
          name: "MARC ESCODA ANGERRI",
          gamesPlayed: 2,
          games: [log("2026-09-27", "match-1", 6), log("2026-10-03", "match-2", 11)],
        },
      ],
    },
  ]);
  const games = merged.players["marc-escoda"].games;
  assert.equal(games.length, 2);
  assert.equal(games[0].jornada, 1);
  assert.equal(games[0].matchCallUuid, "match-1");
  assert.equal(games[0].date, "2026-09-27");
  assert.equal(games[1].jornada, null);
  assert.equal(games[1].round, null);
  assert.equal(games[1].matchCallUuid, "match-2");
  assert.equal(games[1].pts, 11);
  assert.equal(coverageGaps(merged.players, merged.expectations).length, 0);

  const again = mergeTeamLogs({ players: merged.players }, [
    {
      fcbqTeamId: MASC,
      players: [
        {
          name: "MARC ESCODA ANGERRI",
          gamesPlayed: 2,
          games: [log("2026-09-27", "match-1", 6), log("2026-10-03", "match-2", 12)],
        },
      ],
    },
  ]);
  assert.equal(again.players["marc-escoda"].games.length, 2);
  assert.equal(again.appended, 0);
  assert.equal(again.players["marc-escoda"].games[1].pts, 12);
  assert.equal(again.players["marc-escoda"].games[1].jornada, null);
});

test("coverage fails closed when a published game is missing from the log", () => {
  const merged = mergeTeamLogs(
    { players: {} },
    [
      {
        fcbqTeamId: MASC,
        players: [
          {
            name: "MARC ESCODA ANGERRI",
            gamesPlayed: 2,
            games: [
              {
                date: "2026-09-27",
                matchCallUuid: "match-1",
                accumulated: { pts: 4, fc: 1, ftm: 0, fta: 0 },
                computed: { seconds: 60, onCourtPlusMinus: 0 },
              },
            ],
          },
        ],
      },
    ],
  );
  const gaps = coverageGaps(merged.players, merged.expectations);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].stored, 1);
  assert.equal(gaps[0].gamesPlayed, 2);
});
