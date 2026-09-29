import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getDb, type DbUser } from "@/lib/db";
import { createTeamForUser, getActiveTeam, listTeams } from "@/lib/teams";
import type { SessionUser } from "@/lib/types";

export type { SessionUser };

const COOKIE = "sm_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Dev fallback — production must set SESSION_SECRET in systemd/env
    return new TextEncoder().encode(
      "supermanager-balaguer-dev-secret-min-32-chars!!",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    displayName: user.displayName,
    teamName: user.teamName,
    activeTeamId: user.activeTeamId,
    isAdmin: user.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function readSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;

    // Prefer live DB state (active team can change without re-login).
    // Never trust JWT alone — purged / deleted accounts must re-login
    // (ghost sessions used to hit /api/lineup → 500 «No hi ha cap equip actiu»).
    const row = findUserById(payload.sub);
    if (!row) return null;
    return toSessionUser(row);
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function toSessionUser(row: DbUser): SessionUser {
  const active = getActiveTeam(row.id);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    teamName: active?.name ?? row.team_name,
    activeTeamId: active?.id ?? row.active_team_id,
    isAdmin: row.is_admin === 1,
  };
}

export function findUserByEmail(email: string): DbUser | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim()) as DbUser | undefined;
}

export function findUserById(id: string): DbUser | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | DbUser
    | undefined;
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  teamName: string;
}): Promise<{ user: SessionUser } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const teamName = input.teamName.trim();
  const password = input.password;

  if (!email.includes("@") || email.length < 5) {
    return { error: "Introdueix un correu vàlid." };
  }
  if (password.length < 8) {
    return { error: "La contrasenya ha de tenir almenys 8 caràcters." };
  }
  if (displayName.length < 2) {
    return { error: "Cal un nom de mànager." };
  }
  if (teamName.length < 2) {
    return { error: "Cal un nom d'equip fantasy." };
  }
  if (findUserByEmail(email)) {
    return { error: "Aquest correu ja està registrat." };
  }

  const db = getDb();
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  const isAdmin = count === 0 ? 1 : 0;
  const id = randomUUID();
  const password_hash = await hashPassword(password);
  const created_at = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, team_name, is_admin, created_at, active_team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      email,
      password_hash,
      displayName,
      teamName,
      isAdmin,
      created_at,
    );
  });
  tx();

  const teamResult = createTeamForUser(id, teamName, {
    setActive: true,
    createdAt: created_at,
  });
  if (!teamResult.ok) {
    db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return { error: teamResult.error };
  }

  return {
    user: {
      id,
      email,
      displayName,
      teamName: teamResult.team.name,
      activeTeamId: teamResult.team.id,
      isAdmin: isAdmin === 1,
    },
  };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: SessionUser } | { error: string }> {
  const row = findUserByEmail(email);
  if (!row) return { error: "Correu o contrasenya incorrectes." };
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return { error: "Correu o contrasenya incorrectes." };
  // Ensure migrated users have at least one team.
  if (listTeams(row.id).length === 0) {
    createTeamForUser(row.id, row.team_name || row.display_name || "Equip 1", {
      setActive: true,
    });
  }
  const fresh = findUserById(row.id)!;
  return { user: toSessionUser(fresh) };
}
