"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getInstallModalOpen,
  isStandaloneDisplay,
  openInstallAppModal,
  shouldAutoShowInstall,
  subscribeInstallModalOpen,
} from "@/components/install-app-modal";
import {
  dismissPushPromptForSession,
  enablePushOnThisDevice,
  isPushPromptDismissed,
  readDeviceSubscription,
  readPushPermission,
  subscribePushPromptDismiss,
  subscribeThisDevice,
  type PushPermission,
} from "@/lib/push-client";
import { decidePushPrompt } from "@/lib/push-prompt";
import { isIosDevice } from "@/lib/pwa-install";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/** After the install tutorial's own delay, so the two dialogs do not open together. */
const SHOW_DELAY_MS = 2000;

function subscribeNoop() {
  return () => {};
}

function blockedByInstall(): boolean {
  return getInstallModalOpen() || shouldAutoShowInstall();
}

/**
 * Asks a signed-in user to allow notifications when this device is not subscribed.
 * Dismiss lasts for the session. A denied permission is not requested again.
 */
export function PushPrompt() {
  const dismissed = useSyncExternalStore(
    subscribePushPromptDismiss,
    isPushPromptDismissed,
    () => false,
  );
  const permission = useSyncExternalStore(
    subscribeNoop,
    readPushPermission,
    () => "unknown" as const,
  );
  const iosWithoutHomeScreen = useSyncExternalStore(
    subscribeNoop,
    () => isIosDevice() && !isStandaloneDisplay(),
    () => false,
  );
  const iosStandalone = useSyncExternalStore(
    subscribeNoop,
    () => isIosDevice() && isStandaloneDisplay(),
    () => false,
  );
  const installBlocking = useSyncExternalStore(
    subscribeInstallModalOpen,
    blockedByInstall,
    () => true,
  );
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [delayPassed, setDelayPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [permissionOverride, setPermissionOverride] = useState<PushPermission | null>(null);
  const permissionNow = permissionOverride ?? permission;

  useEffect(() => {
    const t = window.setTimeout(() => setDelayPassed(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancel = false;
    void readDeviceSubscription().then((has) => {
      if (!cancel) setHasSubscription(has);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (permissionNow !== "granted" || hasSubscription !== false) return;
    let cancel = false;
    void subscribeThisDevice()
      .then(() => {
        if (!cancel) setHasSubscription(true);
      })
      .catch(() => {
        /* Compte still offers a retry. Do not open the permission dialog. */
      });
    return () => {
      cancel = true;
    };
  }, [permissionNow, hasSubscription]);

  const mode = !delayPassed
    ? "hidden"
    : decidePushPrompt({
        dismissedThisSession: dismissed,
        permission: permissionNow,
        hasSubscription,
        iosWithoutHomeScreen,
        blockedByInstall: installBlocking,
      });

  function dismiss() {
    setError(false);
    dismissPushPromptForSession();
  }

  async function allow() {
    setBusy(true);
    setError(false);
    const result = await enablePushOnThisDevice();
    setBusy(false);
    if (result === "on") {
      setHasSubscription(true);
      setPermissionOverride("granted");
      return;
    }
    if (result === "denied") {
      setPermissionOverride("denied");
      return;
    }
    if (result === "unsupported") {
      setPermissionOverride("unsupported");
      return;
    }
    if (result === "default") return;
    setError(true);
  }

  function installInstead() {
    dismiss();
    openInstallAppModal();
  }

  if (mode === "hidden") return null;

  const iosHome = mode === "ios-home-screen";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[60] bg-ink/75 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-slot="push-prompt"
          className="fixed top-1/2 left-1/2 z-[60] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 rounded-xl border border-line bg-ink-soft p-0 text-sm text-bone outline-none ring-1 ring-line duration-100 sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2.5 right-2.5 text-mute hover:bg-ink hover:text-bone"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Tancar</span>
          </DialogClose>

          <DialogHeader className="gap-1.5 border-b border-line px-5 pt-5 pr-12 pb-4">
            <DialogTitle className="font-display text-lg tracking-tight text-bone">
              Activa les notificacions
            </DialogTitle>
            <DialogDescription className="text-sm leading-snug text-mute">
              {iosHome
                ? "A l'iPhone, els avisos només arriben amb Supermanager a la pantalla d'inici (iOS 16.4 o posterior). Instal·la l'app i, en obrir-la des de la icona, accepta el permís."
                : "Avisos al telèfon quan comença la jornada i quan l'equip ideal ja es pot consultar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 py-4">
            {error ? (
              <p className="text-sm text-mute">
                No s&apos;ha pogut activar. Torna-ho a provar d&apos;aquí una estona.
              </p>
            ) : null}
            {iosHome ? (
              <Button
                type="button"
                onClick={installInstead}
                className="h-11 min-h-11 w-full touch-manipulation bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
              >
                Com instal·lar
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void allow()}
                className="h-11 min-h-11 w-full touch-manipulation bg-grana text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright disabled:opacity-70"
              >
                {busy ? "Activant…" : "Activa les notificacions"}
              </Button>
            )}
            {iosStandalone ? (
              <p className="text-[11px] leading-snug text-mute">
                A l&apos;iPhone cal acceptar el permís del sistema.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={dismiss}
              className="h-11 min-h-11 w-full touch-manipulation border border-line bg-transparent font-semibold uppercase tracking-wide text-bone hover:bg-ink"
            >
              Ara no
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
