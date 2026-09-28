import {
  getDb,
  getCurrentRound,
  setCurrentRound,
  type DbMeta,
} from "@/lib/db";

export type RoundStatus = "open" | "closed";

export type DbRound = {
  id: number;
  label: string;
  status: RoundStatus;
  opened_at: string | null;
  scored_at: string | null;
};

/** Ensure meta + rounds row exist for the current fantasy jornada. */
export function ensureRoundInfrastructure(db = getDb()) {
  const statusRow = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("round_status") as DbMeta | undefined;
  if (!statusRow) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
      "round_status",
      "open",
    );
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT,
      scored_at TEXT
    );
  `);

  const round = getCurrentRound(db);
  const existing = db
    .prepare("SELECT id FROM rounds WHERE id = ?")
    .get(round) as { id: number } | undefined;
  if (!existing) {
    const statusMeta = db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get("round_status") as DbMeta | undefined;
    const status: RoundStatus =
      statusMeta?.value === "closed" ? "closed" : "open";
    db.prepare(
      `INSERT INTO rounds (id, label, status, opened_at, scored_at)
       VALUES (?, ?, ?, ?, NULL)`,
    ).run(round, `Jornada ${round}`, status, new Date().toISOString());
  }
}

export function getRoundStatus(db = getDb()): RoundStatus {
  ensureRoundInfrastructure(db);
  const row = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get("round_status") as DbMeta | undefined;
  return row?.value === "closed" ? "closed" : "open";
}

export function setRoundStatus(status: RoundStatus, db = getDb()) {
  ensureRoundInfrastructure(db);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run("round_status", status);

  const round = getCurrentRound(db);
  db.prepare(
    `INSERT INTO rounds (id, label, status, opened_at, scored_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status`,
  ).run(round, `Jornada ${round}`, status, new Date().toISOString());
}

export function getRoundRow(round?: number, db = getDb()): DbRound | null {
  ensureRoundInfrastructure(db);
  const id = round ?? getCurrentRound(db);
  return (
    (db.prepare("SELECT * FROM rounds WHERE id = ?").get(id) as
      | DbRound
      | undefined) ?? null
  );
}

export function markRoundScored(round: number, scoredAt: string, db = getDb()) {
  ensureRoundInfrastructure(db);
  db.prepare(
    `INSERT INTO rounds (id, label, status, opened_at, scored_at)
     VALUES (?, ?, 'closed', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = 'closed',
       scored_at = excluded.scored_at`,
  ).run(round, `Jornada ${round}`, scoredAt, scoredAt);
  setRoundStatus("closed", db);
}

export function openRound(round: number, db = getDb()) {
  ensureRoundInfrastructure(db);
  const openedAt = new Date().toISOString();
  setCurrentRound(round, db);
  db.prepare(
    `INSERT INTO rounds (id, label, status, opened_at, scored_at)
     VALUES (?, ?, 'open', ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       status = 'open',
       opened_at = excluded.opened_at,
       scored_at = NULL`,
  ).run(round, `Jornada ${round}`, openedAt);
  setRoundStatus("open", db);
}
