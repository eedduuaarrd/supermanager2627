import { readSession } from "@/lib/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/push";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SubBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function parseSub(body: SubBody): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = body.endpoint?.trim() ?? "";
  const p256dh = body.keys?.p256dh?.trim() ?? "";
  const auth = body.keys?.auth?.trim() ?? "";
  if (!endpoint || !p256dh || !auth) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { endpoint, p256dh, auth };
}

/** Store this browser's push subscription for the logged-in user. */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  let body: SubBody = {};
  try {
    body = (await req.json()) as SubBody;
  } catch {
    body = {};
  }
  const sub = parseSub(body);
  if (!sub) {
    return NextResponse.json(
      { error: "Subscripció de push invàlida." },
      { status: 400 },
    );
  }
  savePushSubscription({ userId: session.id, ...sub });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Cal iniciar sessió." }, { status: 401 });
  }
  let body: { endpoint?: string } = {};
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    body = {};
  }
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint) {
    return NextResponse.json({ error: "Cal l'endpoint." }, { status: 400 });
  }
  deletePushSubscription(session.id, endpoint);
  return NextResponse.json({ ok: true });
}
