/**
 * Transfer phase: new teams unlimited until tip-off lock flips to normal.
 * Run: DATA_DIR=/tmp/sm-phase-test npx --yes tsx scripts/test-transfer-phase.ts
 */
import fs from "node:fs";

const dir = "/tmp/sm-phase-test";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

async function main() {
  const { getDb, getCurrentRound } = await import("../src/lib/db");
  const {
    createTeamForUser,
    getTeamTransferPhase,
    promoteInitialTeamsIfLocked,
    restoreInitialPhaseUntilNextTipOff,
  } = await import("../src/lib/teams");
  const { saveLineup, ensureLineupRow, resetTransferSnapshot } = await import(
    "../src/lib/scoring"
  );
  const { setLineupLockAt, clearLineupLockAt, openRound } = await import(
    "../src/lib/rounds"
  );
  const { ROSTER } = await import("../src/data/roster");
  const { computeLineupLockAt, loadFixtures } = await import(
    "../src/lib/fixtures"
  );

  const db = getDb();
  const userId = "u-phase";
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, team_name, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(userId, "phase@test.com", "x", "Phase", "T1", new Date().toISOString());

  // Seed round 2 so restore uses J1 tip-off as cutoff (mirrors production).
  openRound(2, db);
  clearLineupLockAt(db);

  const t1 = createTeamForUser(userId, "Nou Equip", { setActive: true });
  if (!t1.ok) throw new Error(t1.error);
  if (t1.team.transferPhase !== "initial") {
    throw new Error(`expected initial, got ${t1.team.transferPhase}`);
  }

  const byPos = {
    P: ROSTER.filter((p) => p.position === "P").map((p) => p.id),
    A: ROSTER.filter((p) => p.position === "A").map((p) => p.id),
    B: ROSTER.filter((p) => p.position === "B").map((p) => p.id),
  };
  if (byPos.P.length < 3 || byPos.A.length < 3 || byPos.B.length < 2) {
    throw new Error("need roster positions for court slots");
  }

  const lineup8 = [
    ...byPos.P.slice(0, 3),
    ...byPos.A.slice(0, 3),
    ...byPos.B.slice(0, 2),
  ];

  db.prepare(`UPDATE lineups SET budget = 500000 WHERE team_id = ?`).run(
    t1.team.id,
  );

  // >3 adds while initial should succeed
  const first4 = lineup8.slice(0, 4);
  const r1 = saveLineup(t1.team.id, first4, first4[0] ?? null);
  if (!r1.ok) throw new Error(`initial save 4: ${r1.error}`);

  const first7 = lineup8.slice(0, 7);
  const r2 = saveLineup(t1.team.id, first7, first7[0] ?? null);
  if (!r2.ok) throw new Error(`initial save 7 (>3 changes): ${r2.error}`);
  console.log("OK unlimited while initial:", first7.length, "players");

  // Tip-off in the past — team existed before lock → promote
  const createdBefore = new Date(Date.now() - 120_000).toISOString();
  db.prepare(`UPDATE fantasy_teams SET created_at = ? WHERE id = ?`).run(
    createdBefore,
    t1.team.id,
  );
  const past = new Date(Date.now() - 60_000).toISOString();
  setLineupLockAt(past, db);
  const promoted = promoteInitialTeamsIfLocked(new Date(), db);
  if (promoted < 1) throw new Error("expected promote");
  if (getTeamTransferPhase(t1.team.id, db) !== "normal") {
    throw new Error("phase should be normal after lock");
  }
  console.log("OK promoted after tip-off lock:", promoted);

  // Locked: save rejected
  const locked = saveLineup(t1.team.id, lineup8, lineup8[0] ?? null);
  if (locked.ok) throw new Error("expected lock reject");
  console.log("OK tip-off blocks edits:", locked.error);

  // Team created WHILE locked must stay initial (next tip-off rule)
  const midLock = createTeamForUser(userId, "Creat en bloqueig", {
    setActive: false,
  });
  if (!midLock.ok) throw new Error(midLock.error);
  // Premature blanket promote must NOT flip post-lock creates
  promoteInitialTeamsIfLocked(new Date(), db);
  if (getTeamTransferPhase(midLock.team.id, db) !== "initial") {
    throw new Error("post-lock create must stay initial");
  }
  console.log("OK created-while-locked stays initial");

  // Clear lock, open window — restore wrongly-normal teams created after J1 tip-off
  clearLineupLockAt(db);
  // Simulate wrongly stuck normal (migration / old promote)
  db.prepare(
    `UPDATE fantasy_teams SET transfer_phase = 'normal' WHERE id = ?`,
  ).run(midLock.team.id);
  const j1Lock = computeLineupLockAt(1, loadFixtures());
  if (!j1Lock) throw new Error("need J1 tip-off in fixtures");
  // Ensure created_at is after J1 tip-off so restore applies
  const afterJ1 = new Date(Date.parse(j1Lock) + 3600_000).toISOString();
  db.prepare(`UPDATE fantasy_teams SET created_at = ? WHERE id = ?`).run(
    afterJ1,
    midLock.team.id,
  );
  const restored = restoreInitialPhaseUntilNextTipOff(new Date(), db);
  if (restored < 1) throw new Error("expected restore of post-J1 normals");
  if (getTeamTransferPhase(midLock.team.id, db) !== "initial") {
    throw new Error("restore should set initial");
  }
  console.log("OK restore post-tip-off normals → initial:", restored);

  // midLock: unlimited >3 while initial
  db.prepare(`UPDATE lineups SET budget = 500000 WHERE team_id = ?`).run(
    midLock.team.id,
  );
  ensureLineupRow(midLock.team.id, getCurrentRound(db));
  const midSave = saveLineup(midLock.team.id, lineup8, lineup8[0] ?? null);
  if (!midSave.ok) throw new Error(`mid-lock team unlimited: ${midSave.error}`);
  console.log("OK unlimited for restored/post-lock team:", lineup8.length);

  // t1 is normal: 3-cap applies after snapshot reset.
  // Place created_at before J1 tip-off so restore won't revive it as initial.
  const beforeJ1 = new Date(Date.parse(j1Lock) - 3600_000).toISOString();
  db.prepare(
    `UPDATE fantasy_teams SET transfer_phase = 'normal', created_at = ? WHERE id = ?`,
  ).run(beforeJ1, t1.team.id);
  restoreInitialPhaseUntilNextTipOff(new Date(), db);
  if (getTeamTransferPhase(t1.team.id, db) !== "normal") {
    throw new Error("pre-J1 team must stay normal");
  }

  ensureLineupRow(t1.team.id);
  resetTransferSnapshot(t1.team.id, getCurrentRound(db), db);

  const over = saveLineup(t1.team.id, lineup8, lineup8[0] ?? null);
  // snapshot was 7 from earlier; 1 new → OK
  if (!over.ok) throw new Error(`1 change should OK: ${over.error}`);

  resetTransferSnapshot(t1.team.id, getCurrentRound(db), db);
  const altP = byPos.P.filter((id) => !lineup8.includes(id)).slice(0, 2);
  const altA = byPos.A.filter((id) => !lineup8.includes(id)).slice(0, 2);
  if (altP.length < 2 || altA.length < 2) {
    throw new Error("need alternate P/A for 4-change cap test");
  }
  // Keep 4 from snap, replace 4 with newcomers → 4 changes > 3
  const cappedIds = [
    ...altP,
    lineup8[2], // P
    ...altA,
    lineup8[5], // A
    lineup8[6], // B
    lineup8[7], // B
  ];
  db.prepare(`UPDATE lineups SET budget = 500000 WHERE team_id = ?`).run(
    t1.team.id,
  );
  const capped = saveLineup(t1.team.id, cappedIds, cappedIds[0] ?? null);
  if (capped.ok) throw new Error("expected 3-cap reject");
  if (!String(capped.error).includes("canvis")) {
    throw new Error(`expected canvis error, got: ${capped.error}`);
  }
  console.log("OK 3-cap after normal phase:", capped.error);

  // Future tip-off after midLock created_at → then promote midLock
  const futureLock = new Date(Date.now() + 86_400_000).toISOString();
  setLineupLockAt(futureLock, db);
  if (promoteInitialTeamsIfLocked(new Date(), db) !== 0) {
    throw new Error("future lock must not promote yet");
  }
  // Jump time past future lock
  const afterFuture = new Date(Date.parse(futureLock) + 1000);
  const promo2 = promoteInitialTeamsIfLocked(afterFuture, db);
  if (promo2 < 1) throw new Error("expected promote at next tip-off");
  if (getTeamTransferPhase(midLock.team.id, db) !== "normal") {
    throw new Error("post-lock team promotes at next tip-off");
  }
  console.log("OK next tip-off promotes post-lock create");

  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
