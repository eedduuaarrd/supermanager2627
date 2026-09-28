import { NextResponse } from "next/server";
import { loginUser, setSessionCookie } from "@/lib/auth";
import { ensureLineupRow } from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const result = await loginUser(body.email ?? "", body.password ?? "");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    await setSessionCookie(result.user);
    ensureLineupRow(result.user.id);
    return NextResponse.json({ user: result.user });
  } catch {
    return NextResponse.json(
      { error: "No s'ha pogut iniciar la sessió." },
      { status: 500 },
    );
  }
}
