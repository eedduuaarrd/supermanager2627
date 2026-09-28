/**
 * Transfer phase: new teams unlimited until tip-off lock flips to normal.
 * Run: DATA_DIR=/tmp/sm-phase-test npx --yes tsx scripts/test-transfer-phase.ts
 */
import fs from "node:fs";
import path from "node:path";

const dir = "/tmp/sm-phase-test";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

async function main() {
  const { getDb } = await import("../src/lib/db");
  const { createTeamForUser, getTeamTransferPhase, promoteInitialTeamsIfLocked } =
    await import("../src/lib/teams");
  const { saveLineup, ensureLineupRow } = await import("../src/lib/scoring");
  const { setLineupLockAt, clearLineupLockAt } = await import("../src/lib/rounds");
  const { getPlayer } = await import("../src/data/roster");

  const db = getDb();
  const userId = "u-phase";
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, team_name, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(userId, "phase@test.com", "x", "Phase", "T1", new Date().toISOString());

  const t1 = createTeamForUser(userId, "Nou Equip", { setActive: true });
  if (!t1.ok) throw new Error(t1.error);
  if (t1.team.transferPhase !== "initial") {
    throw new Error(`expected initial, got ${t1.team.transferPhase}`);
  }

  clearLineupLockAt(db);
  const players = [
    "masc-a-0",
    "masc-a-1",
    "masc-a-2",
    "masc-a-3",
    "masc-b-0",
    "fem-a-0",
    "fem-a-1",
    "fem-b-0",
  ];
  // Resolve to real ids from roster
  const ids: string[] = [];
  for (const hint of players) {
    const p = getPlayer(hint);
    if (p) ids.push(p.id);
  }
  // Fallback: pull first N from ensure via raw roster module
  const { ROSTER } = await import("../src/data/roster");
  while (ids.length < 8) {
    const next = ROSTER.find((p) => !ids.includes(p.id));
    if (!next) break;
    ids.push(next.id);
  }
  if (ids.length < 5) throw new Error("need roster players");

  // Seed quotes are 15k; inflate cash so this test isolates transfer_phase (not budget scarcity).
  db.prepare(`UPDATE lineups SET budget = 500000 WHERE team_id = ?`).run(t1.team.id);

  // >3 adds while initial should succeed
  const first4 = ids.slice(0, 4);
  const r1 = saveLineup(t1.team.id, first4, first4[0] ?? null);
  if (!r1.ok) throw new Error(`initial save 4: ${r1.error}`);

  const first7 = ids.slice(0, 7);
  const r2 = saveLineup(t1.team.id, first7, first7[0] ?? null);
  if (!r2.ok) throw new Error(`initial save 7 (>3 changes): ${r2.error}`);
  console.log("OK unlimited while initial:", first7.length, "players");

  // Simulate tip-off lock in the past
  const past = new Date(Date.now() - 60_000).toISOString();
  setLineupLockAt(past, db);
  const promoted = promoteInitialTeamsIfLocked(new Date(), db);
  if (promoted < 1) throw new Error("expected promote");
  if (getTeamTransferPhase(t1.team.id, db) !== "normal") {
    throw new Error("phase should be normal after lock");
  }
  console.log("OK promoted after tip-off lock:", promoted);

  // Locked: save rejected
  const locked = saveLineup(t1.team.id, ids.slice(0, 8), ids[0] ?? null);
  if (locked.ok) throw new Error("expected lock reject");
  console.log("OK tip-off blocks edits:", locked.error);

  // Clear lock, open window again — 3-cap applies (snapshot still empty-ish / prior)
  clearLineupLockAt(db);
  ensureLineupRow(t1.team.id);
  // Reset snapshot to current 7 so next adds count
  const { resetTransferSnapshot } = await import("../src/lib/scoring");
  const { getCurrentRound } = await import("../src/lib/db");
  resetTransferSnapshot(t1.team.id, getCurrentRound(db), db);

  const over = saveLineup(t1.team.id, ids.slice(0, 8), ids[0] ?? null);
  // 1 new player from snapshot of 7 → OK (1 change)
  if (!over.ok) throw new Error(`1 change should OK: ${over.error}`);

  // Snapshot is 8; keep 5 from snap + 4 newcomers = 4 changes > 3 (same budget band).
  const snap8 = ids.slice(0, 8);
  const cheapAlt = ROSTER.filter(
    (p) => !snap8.includes(p.id) && p.price <= 8_000,
  )
    .slice(0, 4)
    .map((p) => p.id);
  if (cheapAlt.length < 4) {
    // Fallback: any 4 not in snap; inflate budget so cap is the only gate
    const anyAlt = ROSTER.filter((p) => !snap8.includes(p.id))
      .slice(0, 4)
      .map((p) => p.id);
    if (anyAlt.length < 4) throw new Error("need alternate players");
    db.prepare(`UPDATE lineups SET budget = 500000 WHERE team_id = ?`).run(
      t1.team.id,
    );
    const capped = saveLineup(
      t1.team.id,
      [...snap8.slice(0, 4), ...anyAlt],
      snap8[0] ?? null,
    );
    if (capped.ok) throw new Error("expected 3-cap reject");
    if (!String(capped.error).includes("canvis")) {
      throw new Error(`expected canvis error, got: ${capped.error}`);
    }
    console.log("OK 3-cap after normal phase:", capped.error);
  } else {
    const capped = saveLineup(
      t1.team.id,
      [...snap8.slice(0, 4), ...cheapAlt],
      snap8[0] ?? null,
    );
    if (capped.ok) throw new Error("expected 3-cap reject");
    if (!String(capped.error).includes("canvis")) {
      throw new Error(`expected canvis error, got: ${capped.error}`);
    }
    console.log("OK 3-cap after normal phase:", capped.error);
  }

  // Existing-style team: create then force normal — already promoted path covered
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
