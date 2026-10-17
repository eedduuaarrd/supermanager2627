/**
 * Teixidó A vs CB TREMP reschedule: old 2026-10-17 18:30 (jornada 4)
 * moved to 2026-10-18 17:00 (untagged) must replace, not stack.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFixturesFile,
  CLUB_TEAMS,
  mergeFixtures,
} from "./fetch-fcbq-fixtures.mjs";

const TEIXIDO = CLUB_TEAMS[0];

test("mergeFixtures: Teixidó TREMP reschedule carries jornada and drops stale date", () => {
  const prev = [
    {
      date: "2026-09-27",
      tipOff: "2026-09-27T19:00:00+02:00",
      home: false,
      opponent: "C.B. TORREFARRERA A",
      result: "L",
      teamPoints: 63,
      opponentPoints: 70,
      jornada: 1,
    },
    {
      date: "2026-10-17",
      tipOff: "2026-10-17T18:30:00+02:00",
      home: true,
      opponent: "CB TREMP",
      opponentId: null,
      matchCallUuid: null,
      matchDayNum: null,
      result: null,
      teamPoints: null,
      opponentPoints: null,
      jornada: 4,
      homeTeam: "TEIXIDÓ ASSOCIATS CONSELLERS, SLU CB BALAGUER A",
      awayTeam: "CB TREMP",
    },
  ];
  const next = [
    {
      date: "2026-10-18",
      tipOff: "2026-10-18T17:00:00+02:00",
      home: true,
      opponent: "CB TREMP",
      homeTeam: "TEIXIDÓ ASSOCIATS CONSELLERS, SLU CB BALAGUER A",
      awayTeam: "CB TREMP",
      jornada: null,
    },
  ];

  const out = mergeFixtures(prev, next);
  assert.equal(out.length, 2);
  const tremp = out.find((f) => /tremp/i.test(f.opponent));
  assert.ok(tremp);
  assert.equal(tremp.date, "2026-10-18");
  assert.equal(tremp.tipOff, "2026-10-18T17:00:00+02:00");
  assert.equal(tremp.jornada, 4);
  assert.equal(
    out.filter((f) => f.date === "2026-10-17").length,
    0,
    "stale 17/10 entry must be dropped",
  );
  assert.ok(
    out.some((f) => f.date === "2026-09-27" && f.result === "L"),
    "played historical kept",
  );
});

test("mergeFixtures: matchCallUuid links reschedule across date change", () => {
  const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const prev = [
    {
      date: "2026-10-17",
      tipOff: "2026-10-17T18:30:00+02:00",
      home: true,
      opponent: "CB TREMP",
      matchCallUuid: uuid,
      jornada: 4,
      result: null,
      teamPoints: null,
    },
  ];
  const next = [
    {
      date: "2026-10-18",
      tipOff: "2026-10-18T17:00:00+02:00",
      home: true,
      opponent: "CB TREMP",
      matchCallUuid: uuid,
      jornada: null,
    },
  ];
  const out = mergeFixtures(prev, next);
  assert.equal(out.length, 1);
  assert.equal(out[0].date, "2026-10-18");
  assert.equal(out[0].jornada, 4);
  assert.equal(out[0].matchCallUuid, uuid);
});

test("buildFixturesFile: failed team fetch leaves previous fixtures untouched", () => {
  const existing = {
    teams: [
      {
        fcbqTeamId: TEIXIDO.fcbqTeamId,
        fixtures: [
          {
            date: "2026-10-17",
            tipOff: "2026-10-17T18:30:00+02:00",
            home: true,
            opponent: "CB TREMP",
            jornada: 4,
            result: null,
            teamPoints: null,
          },
        ],
      },
    ],
  };
  const out = buildFixturesFile({
    existing,
    payloadsByTeam: {}, // no successful fetches
    gaps: ["Teixidó A: timeout"],
    source: "test",
  });
  const team = out.teams.find((t) => t.fcbqTeamId === TEIXIDO.fcbqTeamId);
  assert.equal(team.fixtures.length, 1);
  assert.equal(team.fixtures[0].date, "2026-10-17");
  assert.equal(team.fixtures[0].jornada, 4);
});
