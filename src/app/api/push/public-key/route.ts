import { vapidPublicKey } from "@/lib/push";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Public VAPID key for PushManager.subscribe. The private key stays on the server. */
export async function GET() {
  const publicKey = vapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Les claus de push encara no estan disponibles." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}
