"use client";

import { Button } from "@/components/ui/button";
import {
  enablePushOnThisDevice,
  readPushPermission,
  subscribeThisDevice,
} from "@/lib/push-client";
import { useEffect, useState, useSyncExternalStore } from "react";

type UiState =
  | "unknown"
  | "unsupported"
  | "default"
  | "denied"
  | "on"
  | "busy"
  | "error";

function detectedState(): UiState {
  const permission = readPushPermission();
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "denied";
  if (permission === "granted") return "busy";
  if (permission === "unknown") return "unknown";
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
    const result = await enablePushOnThisDevice();
    if (result === "on") setOverride("on");
    else if (result === "denied") setOverride("denied");
    else if (result === "unsupported") setOverride("unsupported");
    else if (result === "error") setOverride("error");
    else setOverride("default");
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
