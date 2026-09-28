import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { simulateJornada } from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST() {
  const user = await readSession();
  if (!user) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "Només l'administrador pot tancar la jornada." },
      { status: 403 },
    );
  }
  try {
    const result = simulateJornada();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No s'ha pogut simular la jornada." },
      { status: 500 },
    );
  }
}
