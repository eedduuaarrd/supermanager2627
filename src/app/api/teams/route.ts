import { NextResponse } from "next/server";
import { readSession, setSessionCookie, toSessionUser, findUserById } from "@/lib/auth";
import { MAX_TEAMS_PER_USER } from "@/lib/db";
import {
  createTeamForUser,
  deleteTeam,
  listTeams,
  renameTeam,
  setActiveTeam,
} from "@/lib/teams";

export const runtime = "nodejs";

export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const teams = listTeams(user.id);
  return NextResponse.json({
    teams,
    activeTeamId: user.activeTeamId,
    maxTeams: MAX_TEAMS_PER_USER,
  });
}

export async function POST(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const body = (await req.json()) as { name?: string };
  const result = createTeamForUser(user.id, body.name ?? "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // New team becomes active by default.
  const fresh = findUserById(user.id)!;
  const session = toSessionUser(fresh);
  await setSessionCookie(session);
  return NextResponse.json({
    team: result.team,
    teams: listTeams(user.id),
    activeTeamId: session.activeTeamId,
    user: session,
    maxTeams: MAX_TEAMS_PER_USER,
  });
}

export async function PATCH(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const body = (await req.json()) as {
    activeTeamId?: string;
    teamId?: string;
    name?: string;
  };

  if (body.name && body.teamId) {
    const renamed = renameTeam(user.id, body.teamId, body.name);
    if (!renamed.ok) {
      return NextResponse.json({ error: renamed.error }, { status: 400 });
    }
  }

  if (body.activeTeamId) {
    const switched = setActiveTeam(user.id, body.activeTeamId);
    if (!switched.ok) {
      return NextResponse.json({ error: switched.error }, { status: 400 });
    }
  }

  const fresh = findUserById(user.id)!;
  const session = toSessionUser(fresh);
  await setSessionCookie(session);

  return NextResponse.json({
    teams: listTeams(user.id),
    activeTeamId: session.activeTeamId,
    user: session,
    maxTeams: MAX_TEAMS_PER_USER,
  });
}

export async function DELETE(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  let teamId = searchParams.get("teamId");
  if (!teamId) {
    try {
      const body = (await req.json()) as { teamId?: string };
      teamId = body.teamId ?? null;
    } catch {
      teamId = null;
    }
  }
  if (!teamId) {
    return NextResponse.json({ error: "Cal indicar l'equip." }, { status: 400 });
  }
  const result = deleteTeam(user.id, teamId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const fresh = findUserById(user.id)!;
  const session = toSessionUser(fresh);
  await setSessionCookie(session);
  return NextResponse.json({
    teams: listTeams(user.id),
    activeTeamId: session.activeTeamId,
    user: session,
    maxTeams: MAX_TEAMS_PER_USER,
  });
}
