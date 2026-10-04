"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState, useSyncExternalStore } from "react";

type UiState =
  | "unknown"
  | "unsupported"
  | "default"
  | "denied"
  | "on"
  | "busy"
  | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribeThisDevice(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
  if (!keyRes.ok) throw new Error("no-key");
  const { publicKey } = (await keyRes.json()) as { publicKey?: string };
  if (!publicKey) throw new Error("no-key");
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw new Error("save");
}

function detectedState(): UiState {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "busy";
  return "default";
}

function subscribeNoop() {
  return () => {};
}

/** Compte control: permission is a user gesture, required on iPhone. */
export function PushOptIn() {
  const detected = useSyncExternalStore(
    subscribeNoop,
    detectedState,
    () => "unknown" as UiState,
  );
  const [override, setOverride] = useState<UiState | null>(null);
  const state = override ?? detected;

  useEffect(() => {
    if (detectedState() !== "busy") return;
    let cancel = false;
    void subscribeThisDevice()
      .then(() => {
        if (!cancel) setOverride("on");
      })
      .catch(() => {
        if (!cancel) setOverride("error");
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function enable() {
    setOverride("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setOverride(permission === "denied" ? "denied" : "default");
        return;
      }
      await subscribeThisDevice();
      setOverride("on");
    } catch {
      setOverride("error");
    }
  }

  return (
    <section className="border border-line bg-panel/80 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
        Notificacions
      </p>
      <p className="mt-2 text-sm text-bone">
        Avisos al telèfon quan comença la jornada i quan l&apos;equip ideal ja
        es pot consultar.
      </p>
      {state === "on" ? (
        <p className="mt-3 text-sm text-emerald-400">Activades en aquest dispositiu.</p>
      ) : null}
      {state === "denied" ? (
        <p className="mt-3 text-sm text-mute">
          El permís està bloquejat. Activa les notificacions de Supermanager a
          la configuració del telèfon.
        </p>
      ) : null}
      {state === "unsupported" ? (
        <p className="mt-3 text-sm text-mute">
          Aquest navegador no pot rebre avisos. A l&apos;iPhone, instal·la
          l&apos;app a la pantalla d&apos;inici (iOS 16.4 o posterior) i torna-ho
          a provar.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="mt-3 text-sm text-mute">
          No s&apos;ha pogut activar. Torna-ho a provar d&apos;aquí una estona.
        </p>
      ) : null}
      {state === "default" || state === "busy" || state === "error" ? (
        <Button
          type="button"
          disabled={state === "busy"}
          onClick={() => void enable()}
          className="mt-3 h-11 w-full bg-grana text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright disabled:opacity-70"
        >
          {state === "busy" ? "Activant…" : "Activa les notificacions"}
        </Button>
      ) : null}
      <p className="mt-3 text-[11px] leading-snug text-mute">
        A l&apos;iPhone cal tenir Supermanager a la pantalla d&apos;inici i
        acceptar el permís. No s&apos;envia res de jornades ja començades o ja
        tancades.
      </p>
    </section>
  );
}
