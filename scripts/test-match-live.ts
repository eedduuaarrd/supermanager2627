/**
 * Match-end push copy, old-game scoring without a push, and partial fantasy scores.
 * Run: npm run test:match-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-match-"));
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

const team = {
  fcbqTeamId: "t",
  teamId: "masc-a" as const,
  slug: "teixido-a",
  shortName: "Teixidó A",
  fullName: "Teixidó Associats A",
  fixtures: [
    {
      date: "2026-09-27",
      tipOff: "2026-09-27T17:00:00.000Z",
      home: false,
      opponent: "C.B. TORREFARRERA A",
      teamPoints: 63,
      opponentPoints: 70,
      jornada: 1,
      matchCallUuid: "old-1",
    },
    {
      date: "2026-10-02",
      tipOff: "2026-10-02T18:00:00.000Z",
      home: true,
      opponent: "CB VELL",
      teamPoints: 70,
      opponentPoints: 60,
      jornada: 2,
      matchCallUuid: "old-empty",
    },
    {
      date: "2026-10-03",
      tipOff: "2026-10-03T16:00:00.000Z",
      home: false,
      opponent: "CB ANTIC",
      teamPoints: 55,
      opponentPoints: 50,
      jornada: 2,
      matchCallUuid: "old-fresh",
    },
    {
      date: "2026-10-01",
      tipOff: "2026-10-01T18:00:00.000Z",
      home: true,
      opponent: "CB SALTAT",
      teamPoints: 40,
      opponentPoints: 44,
      jornada: 2,
      matchCallUuid: "already-skipped",
    },
    {
      date: "2026-10-10",
      tipOff: "2026-10-10T16:30:00.000Z",
      home: true,
      opponent: "CB CAPPONT",
      teamPoints: 81,
      opponentPoints: 65,
      jornada: 2,
      matchCallUuid: "cappont-1",
    },
    {
      date: "2026-10-10",
      tipOff: "2026-10-10T18:00:00.000Z",
      home: false,
      opponent: "CB TREMP",
      teamPoints: null,
      opponentPoints: null,
      jornada: 2,
      matchCallUuid: "tremp-1",
    },
  ],
};

function box(
  playerId: string,
  name: string,
  uuid: string,
  stats: { pts: number | null; pf: number | null; pm: number | null; tlc?: number; tli?: number },
  date = "2026-10-10",
) {
  return {
    playerId,
    name,
    teamId: "masc-a" as const,
    date,
    matchCallUuid: uuid,
    pts: stats.pts,
    pf: stats.pf,
    tlc: stats.tlc ?? 0,
    tli: stats.tli ?? 0,
    pm: stats.pm,
    min: 20,
  };
}

async function main() {
  const {
    applyMatchScores,
    matchAlreadyScored,
    matchNeedsLiveFetch,
    matchPushBody,
    opponentPushName,
    pickStandout,
    planClubMatches,
    pushPlayerName,
    runMatchLive,
  } = await import("../src/lib/match-live");
  const { getDb } = await import("../src/lib/db");
  const { runMatchLivePollTick } = await import("../src/lib/match-live-poll");

  assert.equal(opponentPushName("CB CAPPONT"), "Cappont");
  assert.equal(opponentPushName("C.B. TORREFARRERA A"), "Torrefarrera");
  assert.equal(pushPlayerName("Joan Boladeres Serra"), "Joan Boladeres");
  assert.equal(
    matchPushBody({
      side: "Teixidó",
      sideScore: 81,
      opponentScore: 65,
      opponent: "Cappont",
      playerName: "Joan Boladeres",
      val: 24,
    }),
    "Teixidó 81–65 Cappont.\nDestacat: Joan Boladeres (VAL 24).",
  );
  assert.equal(
    pickStandout([
      { playerId: "b", name: "Joan Boladeres", val: 24 },
      { playerId: "a", name: "Anna Alta", val: 24 },
      { playerId: "c", name: "Marc Escoda", val: 10 },
    ])?.playerId,
    "a",
  );

  const boxes = [
    box("hector-lozano", "Hector Lozano Martinez", "cappont-1", {
      pts: 20,
      pf: 2,
      pm: 6,
    }),
    box("marc-escoda", "Marc Escoda Angerri", "cappont-1", {
      pts: 8,
      pf: 3,
      tlc: 1,
      tli: 2,
      pm: 6,
    }),
    box("eduard-bernat", "Eduard Bernat Sucarrat", "cappont-1", {
      pts: null,
      pf: null,
      pm: null,
    }),
    box("pol-vell", "Pol Vell Garcia", "old-fresh", { pts: 11, pf: 0, pm: 0 }, "2026-10-03"),
    box(
      "nora-salt",
      "Nora Salt Puig",
      "already-skipped",
      { pts: 12, pf: 3, pm: 0 },
      "2026-10-01",
    ),
  ];
  const early = planClubMatches({
    fixtures: { teams: [team] },
    boxes,
    baselineMs: Date.parse("2026-10-04T10:00:00.000Z"),
    now: new Date("2026-10-04T10:00:00.000Z"),
    currentRound: 2,
    roundStatus: "open",
  });
  assert.equal(early.find((p) => p.key.endsWith("old-1"))?.action, "wait");
  assert.equal(early.find((p) => p.key.endsWith("old-empty"))?.action, "wait");
  const oldFreshPlan = early.find((p) => p.key.endsWith("old-fresh"));
  assert.equal(oldFreshPlan?.action, "score");
  assert.equal(oldFreshPlan?.round, 2);
  assert.equal(oldFreshPlan?.message, undefined);
  assert.equal(early.find((p) => p.key.endsWith("already-skipped"))?.action, "score");
  assert.equal(early.find((p) => p.key.endsWith("cappont-1"))?.action, "wait");
  assert.equal(early.find((p) => p.key.endsWith("tremp-1"))?.action, "wait");
  assert.equal(
    planClubMatches({
      fixtures: { teams: [team] },
      boxes,
      baselineMs: Date.parse("2026-10-04T10:00:00.000Z"),
      now: new Date("2026-10-04T10:00:00.000Z"),
      currentRound: 2,
      roundStatus: "closed",
    }).find((p) => p.key.endsWith("old-fresh"))?.action,
    "wait",
  );

  const ready = planClubMatches({
    fixtures: { teams: [team] },
    boxes,
    baselineMs: Date.parse("2026-10-04T10:00:00.000Z"),
    now: new Date("2026-10-10T19:00:00.000Z"),
    currentRound: 2,
    roundStatus: "open",
  });
  const cappont = ready.find((p) => p.key.endsWith("cappont-1"));
  assert.equal(cappont?.action, "send");
  assert.equal(cappont?.round, 2);
  assert.equal(
    cappont?.message?.body,
    "Teixidó 81–65 Cappont.\nDestacat: Hector Lozano (VAL 24).",
  );
  assert.deepEqual(
    cappont?.players.map((p) => p.playerId).sort(),
    ["hector-lozano", "marc-escoda"],
  );
  assert.equal(ready.find((p) => p.key.endsWith("tremp-1"))?.action, "wait");
  assert.equal(
    planClubMatches({
      fixtures: { teams: [team] },
      boxes: [],
      baselineMs: Date.parse("2026-10-04T10:00:00.000Z"),
      now: new Date("2026-10-10T19:00:00.000Z"),
      currentRound: 2,
      roundStatus: "open",
    }).find((p) => p.key.endsWith("cappont-1"))?.action,
    "wait",
  );

  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, team_name, is_admin, created_at, active_team_id)
     VALUES ('u1', 'm@example.com', 'x', 'Edu', 'Tollagrossa', 0, '2026-10-01', 't1')`,
  ).run();
  db.prepare(
    `INSERT INTO fantasy_teams (id, user_id, name, created_at) VALUES ('t1', 'u1', 'Tollagrossa', '2026-10-01')`,
  ).run();
  db.prepare(`UPDATE meta SET value = '2' WHERE key = 'current_round'`).run();
  db.prepare(
    `INSERT INTO lineups (team_id, round, player_ids, captain_id, confirmed, budget, snapshot_ids)
     VALUES ('t1', 2, ?, 'hector-lozano', 0, 20000, '[]')`,
  ).run(
    JSON.stringify([
      "hector-lozano",
      "marc-escoda",
      "eduard-bernat",
      "pol-vell",
      "nora-salt",
    ]),
  );
  db.prepare(
    `INSERT INTO match_dispatch (match_key, outcome, created_at)
     VALUES ('masc-a|already-skipped', 'skipped', '2026-10-03T20:00:00.000Z')`,
  ).run();

  const sent: string[] = [];
  const first = await runMatchLive({
    now: new Date("2026-10-04T10:00:00.000Z"),
    fixtures: { teams: [team] },
    boxes,
    send: async (message) => {
      sent.push(message.body);
      return 1;
    },
  });
  assert.equal(sent.length, 0);
  assert.equal(first.scoredTeams, 2);
  assert.ok(first.waiting.some((key) => key.endsWith("old-empty")));
  assert.equal(
    (
      db
        .prepare(`SELECT outcome FROM match_dispatch WHERE match_key = 'masc-a|old-empty'`)
        .get() as { outcome: string } | undefined
    ),
    undefined,
  );
  assert.equal(
    (
      db
        .prepare(`SELECT outcome FROM match_dispatch WHERE match_key = 'masc-a|old-fresh'`)
        .get() as { outcome: string }
    ).outcome,
    "scored",
  );
  assert.equal(
    (
      db
        .prepare(
          `SELECT outcome FROM match_dispatch WHERE match_key = 'masc-a|already-skipped'`,
        )
        .get() as { outcome: string }
    ).outcome,
    "scored",
  );
  const oldRow = db
    .prepare(`SELECT points, scores_json FROM round_scores WHERE team_id = 't1' AND round = 2`)
    .get() as { points: number; scores_json: string };
  const oldScores = JSON.parse(oldRow.scores_json) as {
    playerId: string;
    points: number;
  }[];
  assert.equal(oldRow.points, 20);
  assert.equal(oldScores.find((s) => s.playerId === "pol-vell")?.points, 11);
  assert.equal(oldScores.find((s) => s.playerId === "nora-salt")?.points, 9);

  const oldAgain = await runMatchLive({
    now: new Date("2026-10-04T12:00:00.000Z"),
    fixtures: { teams: [team] },
    boxes,
    send: async (message) => {
      sent.push(message.body);
      return 1;
    },
  });
  assert.equal(sent.length, 0);
  assert.equal(oldAgain.scoredTeams, 0);
  assert.equal(oldAgain.waiting.some((key) => key.endsWith("old-empty")), true);
  assert.equal(
    (
      db
        .prepare(`SELECT outcome FROM match_dispatch WHERE match_key = 'masc-a|old-empty'`)
        .get() as { outcome: string } | undefined
    ),
    undefined,
  );
  assert.equal(
    (
      db.prepare(`SELECT points FROM round_scores WHERE team_id = 't1' AND round = 2`).get() as {
        points: number;
      }
    ).points,
    20,
  );

  const second = await runMatchLive({
    now: new Date("2026-10-10T19:00:00.000Z"),
    fixtures: { teams: [team] },
    boxes,
    send: async (message) => {
      sent.push(message.body);
      return 1;
    },
  });
  assert.deepEqual(sent, [
    "Teixidó 81–65 Cappont.\nDestacat: Hector Lozano (VAL 24).",
  ]);
  assert.equal(second.scoredTeams, 1);
  assert.equal(sent.length, 1);
  const row = db
    .prepare(`SELECT points, scores_json FROM round_scores WHERE team_id = 't1' AND round = 2`)
    .get() as { points: number; scores_json: string };
  const scores = JSON.parse(row.scores_json) as {
    playerId: string;
    points: number;
    val: number;
  }[];
  assert.equal(row.points, 78);
  assert.equal(scores.find((s) => s.playerId === "hector-lozano")?.points, 48);
  assert.equal(scores.find((s) => s.playerId === "hector-lozano")?.val, 24);
  assert.equal(scores.find((s) => s.playerId === "marc-escoda")?.points, 10);
  assert.equal(scores.find((s) => s.playerId === "eduard-bernat"), undefined);

  await runMatchLive({
    now: new Date("2026-10-10T19:05:00.000Z"),
    fixtures: { teams: [team] },
    boxes,
    send: async (message) => {
      sent.push(message.body);
      return 1;
    },
  });
  assert.equal(sent.length, 1);
  const again = db
    .prepare(`SELECT points FROM round_scores WHERE team_id = 't1' AND round = 2`)
    .get() as { points: number };
  assert.equal(again.points, 78);

  const extra = applyMatchScores(2, [
    { playerId: "eduard-bernat", val: 7, minutes: 12 },
  ]);
  assert.equal(extra, 1);
  const merged = JSON.parse(
    (
      db
        .prepare(`SELECT scores_json, points FROM round_scores WHERE team_id = 't1' AND round = 2`)
        .get() as { scores_json: string; points: number }
    ).scores_json,
  ) as { playerId: string; val: number }[];
  assert.equal(merged.find((s) => s.playerId === "hector-lozano")?.val, 24);
  assert.equal(merged.find((s) => s.playerId === "eduard-bernat")?.val, 7);

  assert.equal(matchAlreadyScored("sent"), true);
  assert.equal(matchAlreadyScored("scored"), true);
  assert.equal(matchAlreadyScored("skipped"), false);
  assert.equal(matchAlreadyScored(null), false);

  const baselineMs = Date.parse("2026-10-04T10:00:00.000Z");
  const fetchNow = new Date("2026-10-04T18:00:00.000Z");
  function oneGame(fixture: {
    tipOff: string;
    jornada: number | null;
    date: string;
    uuid: string;
    teamPoints: number | null;
    opponentPoints: number | null;
  }) {
    return {
      teams: [
        {
          ...team,
          fixtures: [
            {
              date: fixture.date,
              tipOff: fixture.tipOff,
              home: true,
              opponent: "CB CAPPONT",
              teamPoints: fixture.teamPoints,
              opponentPoints: fixture.opponentPoints,
              jornada: fixture.jornada,
              matchCallUuid: fixture.uuid,
            },
          ],
        },
      ],
    };
  }
  assert.equal(
    matchNeedsLiveFetch(
      oneGame({
        tipOff: "2026-10-02T18:00:00.000Z",
        jornada: 2,
        date: "2026-10-02",
        uuid: "old-open",
        teamPoints: 70,
        opponentPoints: 60,
      }),
      baselineMs,
      fetchNow,
      () => false,
      2,
      "open",
    ),
    true,
  );
  assert.equal(
    matchNeedsLiveFetch(
      oneGame({
        tipOff: "2026-10-02T18:00:00.000Z",
        jornada: 2,
        date: "2026-10-02",
        uuid: "old-open",
        teamPoints: 70,
        opponentPoints: 60,
      }),
      baselineMs,
      fetchNow,
      (key) => key.endsWith("old-open"),
      2,
      "open",
    ),
    false,
  );
  assert.equal(
    matchNeedsLiveFetch(
      oneGame({
        tipOff: "2026-10-10T16:30:00.000Z",
        jornada: 2,
        date: "2026-10-10",
        uuid: "future",
        teamPoints: null,
        opponentPoints: null,
      }),
      baselineMs,
      fetchNow,
      () => false,
      2,
      "open",
    ),
    false,
  );
  assert.equal(
    matchNeedsLiveFetch(
      oneGame({
        tipOff: "2026-09-27T17:00:00.000Z",
        jornada: 1,
        date: "2026-09-27",
        uuid: "other-jornada",
        teamPoints: null,
        opponentPoints: null,
      }),
      baselineMs,
      fetchNow,
      () => false,
      2,
      "open",
    ),
    false,
  );

  let refreshed = 0;
  await runMatchLivePollTick({
    now: fetchNow,
    fetchLive: true,
    fixtures: oneGame({
      tipOff: "2026-10-03T16:00:00.000Z",
      jornada: 2,
      date: "2026-10-03",
      uuid: "poll-old",
      teamPoints: null,
      opponentPoints: null,
    }),
    refresh: async () => {
      refreshed += 1;
    },
  });
  assert.equal(refreshed, 1);
  const startRow = db
    .prepare(
      `SELECT outcome FROM push_dispatch WHERE kind = 'jornada-start' AND round = 2`,
    )
    .get() as { outcome: string };
  assert.equal(startRow.outcome, "skipped");
  assert.equal(sent.length, 1);

  await runMatchLivePollTick({
    now: fetchNow,
    fetchLive: false,
    fixtures: oneGame({
      tipOff: "2026-10-03T16:00:00.000Z",
      jornada: 2,
      date: "2026-10-03",
      uuid: "poll-old",
      teamPoints: null,
      opponentPoints: null,
    }),
  });
  assert.equal(startRow.outcome, "skipped");
  assert.equal(
    (
      db
        .prepare(
          `SELECT outcome FROM push_dispatch WHERE kind = 'jornada-start' AND round = 2`,
        )
        .get() as { outcome: string }
    ).outcome,
    "skipped",
  );

  console.log("OK match-live");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
