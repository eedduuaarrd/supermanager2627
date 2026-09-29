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
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const DONT_SHOW_KEY = "sm_install_modal_dont_show";
const SESSION_KEY = "sm_install_modal_session_dismiss";
export const OPEN_INSTALL_MODAL_EVENT = "sm:open-install-modal";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function shouldAutoShow(): boolean {
  try {
    if (isStandaloneDisplay()) return false;
    if (localStorage.getItem(DONT_SHOW_KEY) === "1") return false;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
    return true;
  } catch {
    return !isStandaloneDisplay();
  }
}

function subscribeNoop() {
  return () => {};
}

/** Open the install modal (e.g. from «Com instal·lar»). */
export function openInstallAppModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_INSTALL_MODAL_EVENT));
}

/** First-visit PWA install tutorial (Android + iPhone). */
export function InstallAppModal() {
  const autoShow = useSyncExternalStore(
    subscribeNoop,
    shouldAutoShow,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const open = manualOpen || (autoShow && !dismissed);

  useEffect(() => {
    function onOpenRequest() {
      if (isStandaloneDisplay()) return;
      setDontShowAgain(false);
      setManualOpen(true);
    }

    window.addEventListener(OPEN_INSTALL_MODAL_EVENT, onOpenRequest);
    return () =>
      window.removeEventListener(OPEN_INSTALL_MODAL_EVENT, onOpenRequest);
  }, []);

  function persistAndClose() {
    try {
      if (dontShowAgain) {
        localStorage.setItem(DONT_SHOW_KEY, "1");
      } else {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
    setManualOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setManualOpen(true);
      return;
    }
    persistAndClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink/75 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 rounded-xl border border-line bg-ink-soft p-0 text-sm text-bone outline-none ring-1 ring-line duration-100 sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
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

          <DialogHeader className="gap-1.5 border-b border-line px-5 pb-4 pt-5 pr-12">
            <DialogTitle className="font-display text-lg tracking-tight text-bone">
              Instal·la l&apos;app
            </DialogTitle>
            <DialogDescription className="text-sm leading-snug text-mute">
              Accés ràpid des de la pantalla d&apos;inici, com una app nativa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-grana-bright">
                Android
              </p>
              <p className="text-sm leading-snug text-mute">
                Chrome → menú ⋮ → «Afegeix a la pantalla d&apos;inici» o
                «Instal·la l&apos;app».
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-grana-bright">
                iPhone
              </p>
              <p className="text-sm leading-snug text-mute">
                Safari → Compartir □↑ → «Afegeix a la pantalla d&apos;inici».
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm text-mute">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--grana)]"
              />
              <span>No tornar a mostrar</span>
            </label>
          </div>

          <div className="border-t border-line px-5 py-4">
            <Button
              type="button"
              onClick={persistAndClose}
              className="h-11 min-h-11 w-full touch-manipulation bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
            >
              D&apos;acord
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

/** Tiny Inici link that reopens the install modal. */
export function InstallReopenLink({ className }: { className?: string }) {
  const show = useSyncExternalStore(
    subscribeNoop,
    () => !isStandaloneDisplay(),
    () => false,
  );

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={openInstallAppModal}
      className={
        className ??
        "text-xs text-mute underline-offset-4 hover:text-bone hover:underline"
      }
    >
      Com instal·lar
    </button>
  );
}
