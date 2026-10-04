/**
 * Equip court captions: locked jornada points, next-jornada price,
 * and a past jornada replacing the court.
 * Run: npm run test:equip-court
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-equip-court-"));
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

type Player = {
  id: string;
  name: string;
  number: number | null;
  position: "B" | "A" | "P";
  price: number;
  prevPrice?: number | null;
  avgVal: number;
  source: "fcbq";
  teamId: "masc-a";
  teamIds: ["masc-a"];
  photoUrl: string | null;
};

function player(id: string, position: Player["position"], name: string): Player {
  return {
    id,
    name,
    number: 7,
    position,
    price: 10_000,
    prevPrice: 10_000,
    avgVal: 14.2,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/test.jpg",
  };
}

function statText(html: string, id: string): string {
  const re = new RegExp(`data-player-id="${id}"[^>]*>([\\s\\S]*?)</p>`);
  const match = html.match(re);
  assert.ok(match, `caption for ${id}`);
  return match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function main() {
  const {
    buildCourtMatchSheets,
    courtChipCaption,
    formatCourtPoints,
    historyChipActive,
    nextHistorySelection,
    pastCourtFromHistory,
    pointsCaptionText,
    pointsForInProgressCourt,
    rawCourtVal,
    resolveEquipCourt,
    toggleHistoryRound,
  } = await import("../src/lib/equip-court");
  const { CourtBoard } = await import("../src/components/court-board");
  const { formatPrice } = await import("../src/data/roster");

  const captain = player("cap", "A", "Capita Exemple");
  const waiting = player("wait", "P", "Espera Exemple");
  const zero = player("zero", "B", "Zero Exemple");
  const priceText = formatPrice(10_000).replace(/\s/g, "");

  function render(
    props: {
      caption: "price" | "points" | "ideal";
      points?: Record<string, number>;
      captainId?: string | null;
      players?: Player[];
      idealOnlyKnown?: boolean;
    },
  ): string {
    const node = createElement(CourtBoard, {
      players: props.players ?? [captain, waiting, zero],
      captainId: props.captainId === undefined ? captain.id : props.captainId,
      caption: props.caption,
      jornadaPointsById: props.points,
      jornadaOnlyKnown: props.idealOnlyKnown,
    }) as ReactElement;
    return renderToStaticMarkup(node);
  }

  // 1. Locked jornada, no scores yet: every player is "-".
  const lockedEmpty = resolveEquipCourt({
    lineupLocked: true,
    roundStatus: "open",
    current: {
      playerIds: [captain.id, waiting.id],
      captainId: captain.id,
      pointsById: {},
    },
    past: null,
  });
  assert.equal(lockedEmpty.caption, "points");
  assert.equal(lockedEmpty.source, "current");
  assert.deepEqual(lockedEmpty.pointsById, {});
  assert.equal(courtChipCaption({ mode: "points", playerId: captain.id, pointsById: {} }).kind, "points");
  assert.equal(pointsCaptionText(null), "-");
  const emptyHtml = render({ caption: "points", points: {} });
  assert.equal(statText(emptyHtml, captain.id), "-");
  assert.equal(statText(emptyHtml, waiting.id), "-");
  assert.equal(statText(emptyHtml, zero.id), "-");
  assert.equal(emptyHtml.includes("VAL"), false);
  assert.equal(emptyHtml.includes("14.2"), false);
  assert.equal(emptyHtml.includes("14,2"), false);
  assert.equal(emptyHtml.includes(priceText), false);
  console.log("OK locked jornada before scores is '-'");

  // 2. Locked jornada with live scores: plain raw VAL. Captain is not ×2.
  assert.equal(rawCourtVal({ playerId: "cap", val: 9, points: 18 }, true), 9);
  assert.equal(rawCourtVal({ playerId: "cap", points: 18 }, true), 9);
  assert.equal(rawCourtVal({ playerId: "mate", val: 4, points: 4 }, false), 4);
  assert.equal(rawCourtVal({ playerId: "sit", dnp: true, points: 0 }, false), 0);
  assert.equal(rawCourtVal({ playerId: "sit", dnp: true, points: 0 }, true), 0);
  assert.equal(rawCourtVal({ playerId: "zero", val: 0, points: 0 }, false), 0);
  assert.equal(pointsCaptionText(0), "0");
  assert.equal(formatCourtPoints(12.34), "12.3");

  const live = { cap: 9, zero: 0 };
  const liveHtml = render({
    caption: "points",
    points: live,
    captainId: captain.id,
  });
  assert.equal(statText(liveHtml, captain.id), "9");
  assert.equal(statText(liveHtml, waiting.id), "-");
  assert.equal(statText(liveHtml, zero.id), "0");
  assert.equal(liveHtml.includes("VAL"), false);
  assert.equal(statText(liveHtml, captain.id).includes("18"), false);
  assert.equal(liveHtml.includes(priceText), false);
  console.log("OK locked jornada shows raw points, captain not doubled");

  // 3. After Sunday close the next jornada is open and editable: price only.
  const next = resolveEquipCourt({
    lineupLocked: false,
    roundStatus: "open",
    current: {
      playerIds: ["next-a", "next-b"],
      captainId: "next-a",
      pointsById: { "next-a": 30 },
    },
    past: null,
  });
  assert.equal(next.caption, "price");
  assert.equal(next.source, "current");
  assert.deepEqual(next.playerIds, ["next-a", "next-b"]);
  assert.deepEqual(next.pointsById, {});
  const priceHtml = render({ caption: "price", points: { cap: 9 } });
  assert.equal(statText(priceHtml, captain.id), priceText);
  assert.equal(statText(priceHtml, waiting.id), priceText);
  assert.equal(priceHtml.includes("VAL"), false);
  assert.equal(priceHtml.includes("14.2"), false);
  assert.equal(statText(priceHtml, captain.id).includes("9"), false);
  console.log("OK next jornada after close shows only the price");

  // Closed-but-not-advanced still leaves the scoring caption (points only while open+locked).
  const closed = resolveEquipCourt({
    lineupLocked: true,
    roundStatus: "closed",
    current: {
      playerIds: [captain.id],
      captainId: captain.id,
      pointsById: { cap: 9 },
    },
    past: null,
  });
  assert.equal(closed.caption, "price");

  // 4. Past jornada replaces the court; clicking it again restores the current view.
  assert.equal(toggleHistoryRound(null, 3), 3);
  assert.equal(toggleHistoryRound(3, 3), null);
  assert.equal(toggleHistoryRound(3, 2), 2);

  const past = pastCourtFromHistory({
    round: 3,
    captainId: "cap",
    playerIds: ["cap", "wait", "zero"],
    scores: [
      { playerId: "cap", val: 9, points: 18 },
      { playerId: "wait", dnp: true, points: 0 },
      { playerId: "zero", val: 0, points: 0 },
    ],
  });
  assert.deepEqual(past.playerIds, ["cap", "wait", "zero"]);
  assert.equal(past.captainId, "cap");
  assert.deepEqual(past.pointsById, { cap: 9, zero: 0, wait: 0 });

  const replaced = resolveEquipCourt({
    lineupLocked: false,
    roundStatus: "open",
    current: {
      playerIds: ["next-a"],
      captainId: "next-a",
      pointsById: {},
    },
    past,
  });
  assert.equal(replaced.source, "past");
  assert.equal(replaced.caption, "points");
  assert.deepEqual(replaced.playerIds, ["cap", "wait", "zero"]);
  assert.equal(replaced.captainId, "cap");
  assert.deepEqual(replaced.pointsById, { cap: 9, zero: 0, wait: 0 });
  const pastHtml = render({
    caption: replaced.caption,
    points: replaced.pointsById,
    captainId: replaced.captainId,
  });
  assert.equal(statText(pastHtml, "cap"), "9");
  assert.equal(statText(pastHtml, "wait"), "0");
  assert.equal(statText(pastHtml, "zero"), "0");
  assert.equal(pastHtml.includes("VAL"), false);

  const restored = resolveEquipCourt({
    lineupLocked: false,
    roundStatus: "open",
    current: {
      playerIds: ["next-a"],
      captainId: "next-a",
      pointsById: {},
    },
    past: toggleHistoryRound(3, 3) == null ? null : past,
  });
  assert.equal(restored.source, "current");
  assert.equal(restored.caption, "price");
  assert.deepEqual(restored.playerIds, ["next-a"]);

  const backToLocked = resolveEquipCourt({
    lineupLocked: true,
    roundStatus: "open",
    current: {
      playerIds: [captain.id, waiting.id],
      captainId: captain.id,
      pointsById: { cap: 9 },
    },
    past: null,
  });
  assert.equal(backToLocked.caption, "points");
  assert.deepEqual(backToLocked.playerIds, [captain.id, waiting.id]);
  assert.deepEqual(backToLocked.pointsById, { cap: 9 });
  console.log("OK past jornada replaces the court and toggles back");

  // Ideal popup keeps jornada VAL and does not invent a captain double.
  const idealKnown = courtChipCaption({
    mode: "ideal",
    playerId: "cap",
    pointsById: { cap: 9 },
  });
  assert.deepEqual(idealKnown, { kind: "ideal", value: 9 });
  const idealMissing = courtChipCaption({
    mode: "ideal",
    playerId: "wait",
    pointsById: { cap: 9 },
  });
  assert.deepEqual(idealMissing, { kind: "ideal", value: null });
  const idealHtml = render({
    caption: "ideal",
    points: { cap: 9, zero: 4 },
    captainId: null,
  });
  assert.equal(statText(idealHtml, "cap"), "VAL 9");
  assert.equal(statText(idealHtml, "wait"), "VAL —");
  assert.equal(statText(idealHtml, "zero"), "VAL 4");
  assert.match(idealHtml, /<img /);
  assert.equal(idealHtml.includes("×2"), false);
  console.log("OK ideal popup still shows jornada VAL");

  const historySrc = fs.readFileSync(
    path.join(root, "src/components/jornada-points-history.tsx"),
    "utf8",
  );
  assert.equal(historySrc.includes("DNP"), false);
  assert.equal(historySrc.includes("Tancar"), false);
  assert.match(historySrc, /row\.points/);
  assert.match(historySrc, /row\.rank/);
  assert.doesNotMatch(historySrc, /detail\.opponent/);
  console.log("OK history chips stay and the text list is gone");

  const { getDb } = await import("../src/lib/db");
  const { getTeamRoundHistory } = await import("../src/lib/scoring");
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, team_name, is_admin, created_at, active_team_id)
     VALUES ('u1', 'court@example.com', 'x', 'Edu', 'Tollagrossa', 0, '2026-10-01', 't1')`,
  ).run();
  db.prepare(
    `INSERT INTO fantasy_teams (id, user_id, name, created_at) VALUES ('t1', 'u1', 'Tollagrossa', '2026-10-01')`,
  ).run();
  db.prepare(
    `INSERT INTO lineups (team_id, round, player_ids, captain_id, confirmed, budget, snapshot_ids)
     VALUES ('t1', 3, ?, 'hector-lozano', 1, 20000, '[]')`,
  ).run(JSON.stringify(["hector-lozano", "marc-escoda", "eduard-bernat"]));
  const scores = [
    { playerId: "hector-lozano", points: 18, minutes: 20, winBonus: false, statSource: "VAL", val: 9 },
    { playerId: "marc-escoda", points: 4, minutes: 18, winBonus: false, statSource: "VAL", val: 4 },
    { playerId: "eduard-bernat", points: 0, minutes: 0, winBonus: false, dnp: true },
  ];
  db.prepare(
    `INSERT INTO round_scores (team_id, round, points, opponent, won, scores_json, captain_id, played_at)
     VALUES ('t1', 3, 22, 'Cappont', 0, ?, 'hector-lozano', '2026-10-04')`,
  ).run(JSON.stringify(scores));

  const history = getTeamRoundHistory("t1");
  assert.equal(history.length, 1);
  assert.equal(history[0].points, 22);
  assert.deepEqual(history[0].playerIds, [
    "eduard-bernat",
    "hector-lozano",
    "marc-escoda",
  ]);
  const fromDb = pastCourtFromHistory(history[0]);
  assert.equal(fromDb.captainId, "hector-lozano");
  assert.equal(fromDb.pointsById["hector-lozano"], 9);
  assert.equal(fromDb.pointsById["marc-escoda"], 4);
  assert.equal(fromDb.pointsById["eduard-bernat"], 0);
  assert.ok(fromDb.playerIds.includes("eduard-bernat"));
  console.log("OK stored jornada keeps team total ×2 and raw per-player VAL");

  assert.equal(
    historyChipActive({
      round: 2,
      selectedRound: null,
      currentRound: 2,
      inProgress: true,
    }),
    true,
  );
  assert.equal(
    historyChipActive({
      round: 1,
      selectedRound: null,
      currentRound: 2,
      inProgress: true,
    }),
    false,
  );
  assert.equal(
    historyChipActive({
      round: 1,
      selectedRound: 1,
      currentRound: 2,
      inProgress: true,
    }),
    true,
  );
  assert.equal(
    historyChipActive({
      round: 2,
      selectedRound: 1,
      currentRound: 2,
      inProgress: true,
    }),
    false,
  );
  assert.equal(
    historyChipActive({
      round: 2,
      selectedRound: null,
      currentRound: 2,
      inProgress: false,
    }),
    false,
  );
  assert.equal(
    nextHistorySelection({
      selectedRound: null,
      tappedRound: 2,
      currentRound: 2,
      inProgress: true,
    }),
    null,
  );
  assert.equal(
    nextHistorySelection({
      selectedRound: 1,
      tappedRound: 2,
      currentRound: 2,
      inProgress: true,
    }),
    null,
  );
  assert.equal(
    nextHistorySelection({
      selectedRound: null,
      tappedRound: 1,
      currentRound: 2,
      inProgress: true,
    }),
    1,
  );
  assert.equal(
    nextHistorySelection({
      selectedRound: 1,
      tappedRound: 1,
      currentRound: 2,
      inProgress: true,
    }),
    null,
  );
  console.log("OK current jornada chip highlights itself until a past chip is tapped");

  const sheets = buildCourtMatchSheets({
    round: 2,
    teams: [
      {
        teamId: "masc-a",
        fixtures: [
          {
            jornada: 2,
            teamPoints: 81,
            opponentPoints: 65,
            matchCallUuid: "done",
            date: "2026-10-04",
          },
          {
            jornada: 2,
            teamPoints: null,
            opponentPoints: null,
            matchCallUuid: "later",
            date: "2026-10-05",
          },
        ],
      },
      {
        teamId: "masc-b",
        fixtures: [
          {
            jornada: 2,
            teamPoints: null,
            opponentPoints: null,
            matchCallUuid: "later",
            date: "2026-10-05",
          },
        ],
      },
      {
        teamId: "fem-a",
        fixtures: [
          {
            jornada: 2,
            teamPoints: 70,
            opponentPoints: 60,
            matchCallUuid: "fem-done",
            date: "2026-10-04",
          },
        ],
      },
    ],
    boxes: [
      { playerId: "played", teamId: "masc-a", matchCallUuid: "done", date: "2026-10-04" },
      { playerId: "zero-val", teamId: "masc-a", matchCallUuid: "done", date: "2026-10-04" },
      { playerId: "fem-played", teamId: "fem-a", matchCallUuid: "fem-done", date: "2026-10-04" },
    ],
  });
  const livePoints = pointsForInProgressCourt({
    round: 2,
    playerIds: ["played", "zero-val", "sat", "waiting", "other-team"],
    captainId: "played",
    scores: [
      { playerId: "played", val: 11, points: 22 },
      { playerId: "zero-val", val: 0, points: 0 },
    ],
    teamOf: (id) =>
      id === "other-team" ? "fem-a" : id === "waiting" ? "masc-b" : "masc-a",
    matches: sheets,
  });
  assert.equal(livePoints.played, 11);
  assert.equal(livePoints["zero-val"], 0);
  assert.equal(livePoints.sat, 0);
  assert.equal(Object.hasOwn(livePoints, "waiting"), false);
  assert.equal(livePoints["other-team"], 0);
  const noSheet = pointsForInProgressCourt({
    round: 2,
    playerIds: ["sat"],
    scores: [],
    teamOf: () => "masc-a",
    matches: [
      { teamId: "masc-a", jornada: 2, finished: true, boxPlayerIds: [] },
    ],
  });
  assert.equal(Object.hasOwn(noSheet, "sat"), false);
  console.log("OK '-' until the match ends, then 0 if they did not play");

  const builderSrc = fs.readFileSync(
    path.join(root, "src/components/lineup-builder.tsx"),
    "utf8",
  );
  assert.equal(builderSrc.includes("Alineació bloquejada"), false);
  assert.equal(builderSrc.includes("Finestra de transferències tancada"), false);
  console.log("OK lock sentence is gone from the court");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
