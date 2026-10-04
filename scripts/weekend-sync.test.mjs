import assert from "node:assert/strict";
import test from "node:test";
import { buildFromRosters } from "./refresh-fcbq-stats.mjs";
import {
  coverageGaps,
  isRestrictedPlayerStats,
  mergeTeamLogs,
  resolvePlayerLog,
} from "./fcbq-boxscores.mjs";
import {
  applyAssignments,
  decideWeekendAdvance,
  idealRoundToLock,
  isMadridSunday,
  madridDay,
  madridWeek,
  shouldUpdateMarketPrices,
} from "./fcbq-weekend-guard.mjs";
import {
  computeMarketPrice,
  nextMarketEntry,
  shouldTickPrice,
} from "./compute-market-price.mjs";

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

test("Sunday lock-in picks the jornada that just finished", () => {
  assert.equal(isMadridSunday(SAT), false);
  assert.equal(isMadridSunday(SUN), true);
  // This run closes the open jornada.
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 2,
      advance: true,
      reason: "ok",
    }),
    2,
  );
  // Saturday already advanced; Sunday still locks the finished jornada.
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 3,
      advance: false,
      reason: "already-scored-this-week",
    }),
    2,
  );
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 2,
      advance: false,
      reason: "week-still-open",
    }),
    null,
  );
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 2,
      advance: false,
      reason: "missing-box-scores",
    }),
    null,
  );
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 2,
      advance: false,
      reason: "no-box-scores",
    }),
    null,
  );
  // Saturday must not move the stored ideal team.
  assert.equal(
    idealRoundToLock({
      isSunday: false,
      currentRound: 2,
      advance: true,
      reason: "ok",
    }),
    null,
  );
  assert.equal(
    idealRoundToLock({
      isSunday: true,
      currentRound: 1,
      advance: false,
      reason: "already-scored-this-week",
    }),
    null,
  );
});

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

test("Saturday still refuses a missing box when the week is already complete", () => {
  const fixtures = clubFile();
  // No later tip-off: Saturday would be allowed to close if every box existed.
  fixtures.teams[1].fixtures[0].date = "2026-10-03";
  fixtures.teams[1].fixtures[0].tipOff = "2026-10-03T12:00:00+02:00";
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
    now: SAT,
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

test("Sunday close scores stored boxes when ingest fails and a club side has no box", () => {
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = null;
  const stats = {
    players: {
      "marc-escoda": {
        teamId: "masc-a",
        games: [game({ date: "2026-10-03", round: null, jornada: null, pts: 11 })],
      },
      "jana-alarcon": {
        teamId: "fem-b",
        games: [game({ date: "2026-09-27", teamId: "fem-b", round: 1, jornada: 1, pts: 4 })],
      },
    },
  };
  const before = JSON.parse(JSON.stringify(stats));
  const decision = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(decision.advance, true, decision.reason);
  assert.equal(decision.reason, "ok");
  assert.deepEqual(
    decision.missing.map((m) => m.teamId),
    ["fem-b"],
  );
  assert.equal(decision.assignments.length, 1);
  assert.equal(decision.assignments[0].playerId, "marc-escoda");
  assert.equal(decision.assignments[0].round, 2);
  assert.equal(applyAssignments(stats, decision.assignments), 1);
  assert.equal(stats.players["marc-escoda"].games[0].jornada, 2);
  assert.equal(stats.players["marc-escoda"].games[0].pts, 11);
  assert.equal(stats.players["jana-alarcon"].games.length, 1);
  assert.equal(stats.players["jana-alarcon"].games[0].jornada, 1);
  assert.deepEqual(stats.players["jana-alarcon"].games[0], before.players["jana-alarcon"].games[0]);

  const again = decideWeekendAdvance({
    round: 3,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    scoredWeekKey: decision.week.key,
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(again.advance, false);
  assert.equal(again.reason, "already-scored-this-week");
});

test("Sunday still opens the next jornada when no tracked side has a box", () => {
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = null;
  const stats = {
    players: {
      "marc-escoda": {
        teamId: "masc-a",
        games: [game({ date: "2026-09-27", round: 1, jornada: 1 })],
      },
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
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(decision.advance, true, decision.reason);
  assert.equal(decision.assignments.length, 0);
  assert.deepEqual(
    decision.missing.map((m) => m.teamId),
    ["masc-a", "fem-b"],
  );
  assert.equal(applyAssignments(stats, decision.assignments), 0);
  assert.equal(stats.players["marc-escoda"].games.length, 1);
  assert.equal(stats.players["jana-alarcon"].games.length, 1);
});

test("Saturday does not close a later game when ingest failed", () => {
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
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(decision.advance, false);
  assert.equal(decision.reason, "week-still-open");
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

test("a failed fixtures refresh never advances, including Sunday", () => {
  const stats = {
    players: { "marc-escoda": { games: [game({ round: 2, jornada: 2 })] } },
  };
  const fixtures = clubFile();
  fixtures.teams[1].fixtures[0].result = "L";
  const fixturesFail = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SUN,
    ingestOk: false,
    fixturesOk: false,
  });
  assert.equal(fixturesFail.reason, "fixtures-refresh-failed");
  assert.equal(fixturesFail.advance, false);
  const saturdayIngest = decideWeekendAdvance({
    round: 2,
    fixturesFile: fixtures,
    stats,
    now: SAT,
    ingestOk: false,
    fixturesOk: true,
  });
  assert.equal(saturdayIngest.advance, false);
  assert.notEqual(saturdayIngest.reason, "ok");
});

const SIFONET = "c057eeae-3aae-4e33-b2ab-54fabb2700ae";
const RESTRICTED_DF = {
  uuid: "acd264cd-85d4-4729-a554-6198ae6a7381",
  name: "D.F.",
  dorsal: "5",
  gamesPlayed: 1,
  totals: {
    accumulated: { pts: 0, t2m: 0, t3m: 0, ftm: 0, fta: 2, fc: 2 },
    computed: { seconds: 1098, onCourtPlusMinus: 4, ftPer: 0 },
  },
  minutesByGame: { 1: 1098 },
};
const RESTRICTED_BODY = {
  message: "Les estadístiques del jugador/a han estat restringides",
  error: "1002021",
};

test("restricted Lo Sifonet player D.F. is ignored and does not fail the side", () => {
  assert.equal(isRestrictedPlayerStats(405, RESTRICTED_BODY), true);
  assert.equal(isRestrictedPlayerStats(405, { message: "nope" }), false);
  assert.equal(isRestrictedPlayerStats(404, RESTRICTED_BODY), false);

  const skipped = resolvePlayerLog(RESTRICTED_DF, {
    status: 405,
    body: RESTRICTED_BODY,
  });
  assert.equal(skipped.skip, true);
  assert.equal(skipped.reason, "restricted");
  assert.equal(skipped.games, undefined);
  assert.equal(skipped.fatal, undefined);

  const miquelLog = {
    date: "2026-10-03",
    matchCallUuid: "c4fe67b2-72dd-4506-a41a-f461d8b0fc77",
    opponent: { name: "AGROLLOBERA PALAU D'ANGLESOLA" },
    accumulated: { pts: 9, t2m: 2, t3m: 1, ftm: 2, fta: 4, fc: 2 },
    computed: { seconds: 1702, onCourtPlusMinus: 17 },
  };
  const published = resolvePlayerLog(
    {
      uuid: "00c6ae27-98d1-11e9-a2a5-0216824770c2",
      name: "MIQUEL RÚBIES PACH",
      gamesPlayed: 1,
    },
    { status: 200, games: [miquelLog] },
  );
  assert.equal(published.gamesPlayed, 1);
  assert.equal(published.games[0], miquelLog);
  assert.equal(published.skip, undefined);

  const fatal = resolvePlayerLog(RESTRICTED_DF, {
    status: 500,
    body: { message: "boom" },
  });
  assert.equal(fatal.fatal, true);

  const roster = [
    {
      person: RESTRICTED_DF,
      result: { status: 405, body: RESTRICTED_BODY },
    },
    {
      person: {
        uuid: "00c6ae27-98d1-11e9-a2a5-0216824770c2",
        name: "MIQUEL RÚBIES PACH",
        gamesPlayed: 1,
      },
      result: { status: 200, games: [miquelLog] },
    },
  ];
  const kept = [];
  for (const item of roster) {
    const resolved = resolvePlayerLog(item.person, item.result);
    assert.equal(resolved.fatal, undefined);
    if (resolved.skip) continue;
    kept.push({
      uuid: item.person.uuid,
      name: item.person.name,
      gamesPlayed: resolved.gamesPlayed,
      games: resolved.games,
    });
  }
  assert.equal(kept.length, 1);
  assert.equal(kept[0].name, "MIQUEL RÚBIES PACH");
  assert.deepEqual(kept[0].games, [miquelLog]);
  const merged = mergeTeamLogs(
    { players: {} },
    [{ fcbqTeamId: SIFONET, players: kept }],
  );
  assert.equal(
    merged.unmapped.some((name) => name === "D.F."),
    false,
  );
  assert.equal(merged.unmapped.includes("MIQUEL RÚBIES PACH"), true);
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

test("Sunday close ticks stored prices even when ingest failed", () => {
  assert.equal(
    shouldUpdateMarketPrices({ ingestOk: false, isSunday: true }),
    true,
  );
  assert.equal(
    shouldUpdateMarketPrices({ ingestOk: true, isSunday: false }),
    true,
  );
  assert.equal(
    shouldUpdateMarketPrices({ ingestOk: false, isSunday: false }),
    false,
  );
  assert.equal(
    shouldUpdateMarketPrices({
      skipPrices: true,
      ingestOk: false,
      isSunday: true,
    }),
    false,
  );
});

test("a new stored game moves that price and a missing box does not", () => {
  const kept = (current, gamesPlayed, avgVal) => {
    if (!shouldTickPrice(current, gamesPlayed)) return { ...current };
    return nextMarketEntry(avgVal, current, "2026-10-04T21:59:00Z", gamesPlayed);
  };

  const prev = { price: 10000, prevPrice: 10000, pricedGames: 1 };
  assert.equal(shouldTickPrice(prev, 2), true);
  assert.equal(shouldTickPrice(prev, 1), false);
  assert.equal(shouldTickPrice(prev, 0), false);

  const grown = kept(prev, 2, 20);
  assert.equal(grown.price, computeMarketPrice(20, 10000));
  assert.equal(grown.price, 11500);
  assert.equal(grown.prevPrice, 10000);
  assert.equal(grown.pricedGames, 2);
  assert.ok(grown.price >= 500);
  assert.equal(grown.price % 500, 0);

  // Same game count would jump another ±15% if the tick ran again.
  assert.notEqual(nextMarketEntry(20, grown, "2026-10-04T22:00:00Z", 2).price, 11500);
  const retick = kept(grown, 2, 20);
  assert.equal(retick.price, 11500);
  assert.equal(retick.prevPrice, 10000);
  assert.equal(retick.pricedGames, 2);

  const quiet = kept(
    { price: 10000, prevPrice: 10000, pricedGames: 1 },
    1,
    99,
  );
  assert.equal(quiet.price, 10000);
  assert.equal(quiet.pricedGames, 1);
});
