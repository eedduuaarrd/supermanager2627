/** Browser push subscription shared by Compte and the open-app prompt. */

export const PUSH_PROMPT_SESSION_KEY = "sm_push_prompt_session_dismiss";

export type PushPermission = "unknown" | "default" | "granted" | "denied" | "unsupported";

export type EnablePushResult = "on" | "denied" | "default" | "unsupported" | "error";

const dismissListeners = new Set<() => void>();

export function subscribePushPromptDismiss(onStoreChange: () => void) {
  dismissListeners.add(onStoreChange);
  return () => {
    dismissListeners.delete(onStoreChange);
  };
}

export function isPushPromptDismissed(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(PUSH_PROMPT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPushPromptForSession() {
  try {
    sessionStorage.setItem(PUSH_PROMPT_SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
  for (const listener of dismissListeners) listener();
}

export function readPushPermission(): PushPermission {
  if (typeof window === "undefined") return "unknown";
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "default";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function readDeviceSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub != null;
  } catch {
    return false;
  }
}

/** Save this device with the same payload Compte already posts. */
export async function subscribeThisDevice(): Promise<void> {
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
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("save");
}

/** User gesture only. Does not send a notification. */
export async function enablePushOnThisDevice(): Promise<EnablePushResult> {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "default";
  }
  try {
    await subscribeThisDevice();
    return "on";
  } catch {
    return "error";
  }
}
