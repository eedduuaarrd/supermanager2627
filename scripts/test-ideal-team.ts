/**
 * Ideal lineup: fantasy VAL, court slots, and Sunday persistence.
 * Run: npm run test:ideal-team
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-ideal-"));
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

async function main() {
  const {
    collectScoredPlayers,
    ensureStoredIdealTeam,
    lastCompletedRound,
    IDEAL_TEAM_SLOTS,
    pickIdealLineup,
    readStoredIdealTeam,
    refreshStoredIdealTeam,
  } = await import("../src/lib/ideal-team");
  const { getLivePlayer } = await import("../src/lib/live-roster");
  const { fantasyStatFromGame, getPlayerGameForRound } = await import(
    "../src/lib/player-stats"
  );
  const { getDb } = await import("../src/lib/db");
  const { openRound } = await import("../src/lib/rounds");
  assert.deepEqual(IDEAL_TEAM_SLOTS, { B: 2, A: 3, P: 3 });

  assert.equal(lastCompletedRound(2, "open"), 1);
  assert.equal(lastCompletedRound(1, "open"), null);
  assert.equal(lastCompletedRound(2, "closed"), 2);
  assert.equal(lastCompletedRound(3, "open"), 2);

  const shortLine = pickIdealLineup([
    { playerId: "p1", position: "P", points: 1 },
    { playerId: "p2", position: "P", points: 2 },
  ]);
  assert.ok(shortLine);
  assert.deepEqual(
    shortLine.playerIds,
    ["p2", "p1"],
    "a short line keeps the players who scored and invents nobody",
  );

  const threeBases = pickIdealLineup([
    { playerId: "b-low", position: "B", points: 1 },
    { playerId: "b-mid", position: "B", points: 4 },
    { playerId: "b-high", position: "B", points: 9 },
    { playerId: "a-1", position: "A", points: 3 },
    { playerId: "a-2", position: "A", points: 2 },
    { playerId: "a-3", position: "A", points: 1 },
    { playerId: "p-1", position: "P", points: 6 },
    { playerId: "p-2", position: "P", points: 5 },
    { playerId: "p-3", position: "P", points: 4 },
  ]);
  assert.ok(threeBases);
  assert.deepEqual(threeBases.playerIds, [
    "p-1",
    "p-2",
    "p-3",
    "a-1",
    "a-2",
    "a-3",
    "b-high",
    "b-mid",
  ]);
  assert.equal(threeBases.playerIds.includes("b-low"), false);

  const tied = pickIdealLineup([
    { playerId: "p-b", position: "P", points: 5 },
    { playerId: "p-a", position: "P", points: 5 },
    { playerId: "p-c", position: "P", points: 1 },
    { playerId: "a-2", position: "A", points: 3 },
    { playerId: "a-1", position: "A", points: 9 },
    { playerId: "a-3", position: "A", points: 4 },
    { playerId: "b-2", position: "B", points: -1 },
    { playerId: "b-1", position: "B", points: 0 },
  ]);
  assert.ok(tied);
  assert.deepEqual(tied.playerIds, [
    "p-a",
    "p-b",
    "p-c",
    "a-1",
    "a-3",
    "a-2",
    "b-1",
    "b-2",
  ]);
  assert.deepEqual(
    tied.scores.map((s) => s.points),
    [5, 5, 1, 9, 4, 3, 0, -1],
  );

  const scored = collectScoredPlayers(1);
  const live = pickIdealLineup(scored);
  assert.ok(live, "jornada 1 has a full ideal lineup from real VAL");
  assert.equal(live.playerIds.length, 8);
  const counts = { P: 0, A: 0, B: 0 };
  for (const id of live.playerIds) {
    const player = getLivePlayer(id);
    assert.ok(player, id);
    counts[player.position] += 1;
    const stat = fantasyStatFromGame(getPlayerGameForRound(id, 1));
    assert.equal(stat.source, "VAL");
    const score: { playerId: string; points: number } | undefined =
      live.scores.find((entry) => entry.playerId === id);
    assert.equal(score?.points, stat.points);
    if (player.photoUrl) {
      const file = path.join(root, "public", player.photoUrl.replace(/^\//, ""));
      assert.equal(
        fs.existsSync(file),
        true,
        `${id} photo ${player.photoUrl} is missing; the court would fall back to initials`,
      );
    }
  }
  assert.equal(counts.P, IDEAL_TEAM_SLOTS.P);
  assert.equal(counts.A, IDEAL_TEAM_SLOTS.A);
  assert.equal(counts.B, IDEAL_TEAM_SLOTS.B);
  assert.equal(counts.B, 2);
  assert.equal(counts.A, 3);
  assert.equal(counts.P, 3);

  assert.equal(pickIdealLineup(collectScoredPlayers(99)), null);

  const kept = refreshStoredIdealTeam(1);
  assert.equal(kept.stored, true);
  const before = readStoredIdealTeam();
  assert.equal(before?.round, 1);
  const skipped = refreshStoredIdealTeam(99);
  assert.equal(skipped.stored, false);
  if (!skipped.stored) assert.equal(skipped.reason, "no-scores");
  assert.equal(readStoredIdealTeam()?.round, 1);
  assert.deepEqual(readStoredIdealTeam()?.playerIds, before?.playerIds);

  const jornada2 = [
    { playerId: "base-1", position: "B" as const, points: 11 },
    { playerId: "base-2", position: "B" as const, points: 4 },
    { playerId: "aler-1", position: "A" as const, points: 9 },
    { playerId: "aler-2", position: "A" as const, points: 6 },
    { playerId: "aler-3", position: "A" as const, points: 2 },
    { playerId: "pivot-1", position: "P" as const, points: 8 },
    { playerId: "pivot-2", position: "P" as const, points: 3 },
  ];
  const replaced = refreshStoredIdealTeam(2, getDb(), jornada2);
  assert.equal(replaced.stored, true);
  if (replaced.stored) {
    assert.deepEqual(replaced.playerIds, [
      "pivot-1",
      "pivot-2",
      "aler-1",
      "aler-2",
      "aler-3",
      "base-1",
      "base-2",
    ]);
  }
  assert.equal(readStoredIdealTeam()?.round, 2);
  assert.equal(readStoredIdealTeam()?.playerIds.length, 7);
  assert.equal(
    readStoredIdealTeam()?.playerIds.includes("base-3"),
    false,
    "do not invent a third base",
  );

  const onlyBases = refreshStoredIdealTeam(2, getDb(), [
    { playerId: "base-1", position: "B", points: 11 },
    { playerId: "base-2", position: "B", points: 4 },
  ]);
  assert.equal(onlyBases.stored, true);
  assert.deepEqual(readStoredIdealTeam()?.playerIds, ["base-1", "base-2"]);
  assert.equal(readStoredIdealTeam()?.round, 2);

  openRound(2);
  getDb().prepare("DELETE FROM ideal_lineup").run();
  const view = ensureStoredIdealTeam();
  assert.equal(view.round, 1);
  assert.equal(view.team?.round, 1);
  assert.equal(view.pendingRound, null);

  openRound(3);
  const held = ensureStoredIdealTeam();
  assert.equal(held.round, 1, "a newer open jornada must not replace the stored team");
  assert.equal(held.team?.round, 1);
  assert.equal(held.pendingRound, 2);

  console.log("OK ideal team", live.playerIds.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
