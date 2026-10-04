import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureStoredIdealTeam } from "@/lib/ideal-team";

export const runtime = "nodejs";

/** Stored ideal lineup for Inici. The jornada only moves on the Sunday job. */
export async function GET() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const view = ensureStoredIdealTeam();
  return NextResponse.json(view);
}
