import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { buildPlayerDetail } from "@/lib/player-stats";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const detail = buildPlayerDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Jugador no trobat." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
