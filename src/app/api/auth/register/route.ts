import { NextResponse } from "next/server";
import { registerUser, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      teamName?: string;
    };
    const result = await registerUser({
      email: body.email ?? "",
      password: body.password ?? "",
      displayName: body.displayName ?? "",
      teamName: body.teamName ?? "",
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await setSessionCookie(result.user);
    // Lineup row is created with the fantasy team in registerUser/createTeamForUser.
    return NextResponse.json({ user: result.user });
  } catch {
    return NextResponse.json(
      { error: "No s'ha pogut completar el registre." },
      { status: 500 },
    );
  }
}
