import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Manager confirm removed — lineups autosave; admin closes the round. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Ja no cal confirmar l'alineació. Es desa automàticament; l'admin tanca la jornada.",
    },
    { status: 410 },
  );
}
