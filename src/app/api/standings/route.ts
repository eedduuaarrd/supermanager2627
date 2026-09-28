import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getStandings } from "@/lib/scoring";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") === "jornada" ? "jornada" : "general";
  const data = getStandings(scope, user.id);
  return NextResponse.json(data);
}
