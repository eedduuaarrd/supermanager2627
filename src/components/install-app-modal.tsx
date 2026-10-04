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
  getDeferredInstallPrompt,
  isIosDevice,
  promptNativeInstall,
  subscribeDeferredInstallPrompt,
} from "@/lib/pwa-install";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

const DONT_SHOW_KEY = "sm_install_modal_dont_show";
const SESSION_KEY = "sm_install_modal_session_dismiss";
/** Delay before first-visit auto-open so onboarding / first paint aren't blocked. */
const AUTO_SHOW_DELAY_MS = 1500;
export const OPEN_INSTALL_MODAL_EVENT = "sm:open-install-modal";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export function shouldAutoShowInstall(): boolean {
  try {
    if (isStandaloneDisplay()) return false;
    if (localStorage.getItem(DONT_SHOW_KEY) === "1") return false;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
    return true;
  } catch {
    return !isStandaloneDisplay();
  }
}

let installModalOpen = false;
const installOpenListeners = new Set<() => void>();

function setInstallModalOpen(next: boolean) {
  if (installModalOpen === next) return;
  installModalOpen = next;
  for (const listener of installOpenListeners) listener();
}

export function subscribeInstallModalOpen(onStoreChange: () => void) {
  installOpenListeners.add(onStoreChange);
  return () => {
    installOpenListeners.delete(onStoreChange);
  };
}

export function getInstallModalOpen(): boolean {
  return installModalOpen;
}

function subscribeNoop() {
  return () => {};
}

/** Chrome / Chromium overflow menu — three vertical dots. */
function ChromeMenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** iOS Safari Share — box with upward arrow. */
function IosShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 3v11" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** iOS Safari / share-sheet «Més» — three horizontal dots. */
function IosMoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function IconChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="mx-0.5 inline-flex size-6 shrink-0 translate-y-[0.05em] items-center justify-center rounded-md border border-line bg-ink align-text-bottom text-bone/85 [&_svg]:size-3"
      aria-hidden
    >
      {children}
    </span>
  );
}

function PlatformLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-mute">
      {children}
    </p>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-grana/90 text-[0.65rem] font-bold text-bone"
      aria-hidden
    >
      {n}
    </span>
  );
}

function AndroidInstallSteps() {
  return (
    <div className="space-y-2">
      <PlatformLabel>Android</PlatformLabel>
      <ol className="list-none space-y-2.5 text-sm leading-snug text-bone/85">
        <li className="flex gap-2.5">
          <StepNumber n={1} />
          <span>
            Obriu{" "}
            <span className="font-semibold text-bone">supercbb.com</span> amb{" "}
            <span className="font-semibold text-bone">Chrome</span>.
          </span>
        </li>
        <li className="flex gap-2.5">
          <StepNumber n={2} />
          <span>
            Toqueu el menú{" "}
            <span className="font-semibold text-bone">⋮</span> (tres punts) a
            dalt a la dreta
            <IconChip>
              <ChromeMenuIcon />
            </IconChip>
            .
          </span>
        </li>
        <li className="flex gap-2.5">
          <StepNumber n={3} />
          <span>
            Toqueu{" "}
            <span className="font-semibold text-bone">
              «Instal·lar l&apos;app»
            </span>{" "}
            o{" "}
            <span className="font-semibold text-bone">
              «Afegeix a la pantalla d&apos;inici»
            </span>
            .
          </span>
        </li>
        <li className="flex gap-2.5">
          <StepNumber n={4} />
          <span>
            Confirmeu{" "}
            <span className="font-semibold text-bone">«Instal·la»</span> /{" "}
            <span className="font-semibold text-bone">«Afegeix»</span>.
          </span>
        </li>
      </ol>
    </div>
  );
}

function IphoneInstallSteps() {
  return (
    <div className="space-y-2">
      <PlatformLabel>iPhone</PlatformLabel>
      <ol className="list-none space-y-2.5 text-sm leading-snug text-bone/85">
        <li className="flex gap-2.5">
          <StepNumber n={1} />
          <span>
            Obriu{" "}
            <span className="font-semibold text-bone">https://supercbb.com</span>{" "}
            amb <span className="font-semibold text-bone">Safari</span> (Chrome
            també va bé a iOS 16.4+). Toqueu la{" "}
            <span className="font-semibold text-bone">barra d&apos;adreces</span>{" "}
            a la part inferior perquè s&apos;obri la barra d&apos;eines i
            aparegui Compartir. Si veieu{" "}
            <span className="font-semibold text-bone">⋯</span> (Més) en lloc de
            Compartir, toqueu-lo primer
            <IconChip>
              <IosMoreIcon />
            </IconChip>
            .
          </span>
        </li>
        <li className="flex gap-2.5">
          <StepNumber n={2} />
          <span>
            Toqueu{" "}
            <span className="font-semibold text-bone">Compartir</span> (quadrat
            amb fletxa cap amunt)
            <IconChip>
              <IosShareIcon />
            </IconChip>
            .
          </span>
        </li>
        <li className="flex gap-2.5">
          <StepNumber n={3} />
          <span>
            Al full de compartir, feu lliscar cap avall la llista d&apos;accions
            (sovint no es veu de primer). Si no la trobeu: toqueu{" "}
            <span className="font-semibold text-bone">Més</span>
            <IconChip>
              <IosMoreIcon />
            </IconChip>{" "}
            /{" "}
            <span className="font-semibold text-bone">
              Edita les accions…
            </span>
            , activeu{" "}
            <span className="font-semibold text-bone">
              «Afegeix a la pantalla d&apos;inici»
            </span>
            . Després toqueu{" "}
            <span className="font-semibold text-bone">
              «Afegeix a la pantalla d&apos;inici»
            </span>{" "}
            i confirmeu{" "}
            <span className="font-semibold text-bone">«Afegeix»</span>.
          </span>
        </li>
      </ol>
    </div>
  );
}

/** Open the install modal (e.g. from «Com instal·lar»). */
export function openInstallAppModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_INSTALL_MODAL_EVENT));
}

/** First-visit PWA install tutorial (Android + iPhone). */
export function InstallAppModal() {
  const pathname = usePathname();
  const onOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const autoShowEligible = useSyncExternalStore(
    subscribeNoop,
    shouldAutoShowInstall,
    () => false,
  );
  const deferredPrompt = useSyncExternalStore(
    subscribeDeferredInstallPrompt,
    getDeferredInstallPrompt,
    () => null,
  );
  const ios = useSyncExternalStore(
    subscribeNoop,
    isIosDevice,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [delayPassed, setDelayPassed] = useState(false);

  const canNativeInstall = deferredPrompt != null;
  const autoShow =
    autoShowEligible && !onOnboarding && delayPassed && !dismissed;
  const open = manualOpen || autoShow;

  useEffect(() => {
    setInstallModalOpen(open);
    return () => setInstallModalOpen(false);
  }, [open]);

  useEffect(() => {
    if (!autoShowEligible || onOnboarding) {
      setDelayPassed(false);
      return;
    }
    const t = window.setTimeout(() => setDelayPassed(true), AUTO_SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [autoShowEligible, onOnboarding]);

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

  async function handleNativeInstall() {
    setInstalling(true);
    try {
      const outcome = await promptNativeInstall();
      if (outcome === "accepted") {
        try {
          localStorage.setItem(DONT_SHOW_KEY, "1");
        } catch {
          /* ignore */
        }
        setDismissed(true);
        setManualOpen(false);
        return;
      }
    } finally {
      setInstalling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink/75 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed top-1/2 left-1/2 z-50 grid max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-y-auto rounded-xl border border-line bg-ink-soft p-0 text-sm text-bone outline-none ring-1 ring-line duration-100 sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
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
              Instal·leu Supermanager
            </DialogTitle>
            <DialogDescription className="text-sm leading-snug text-mute">
              Accediu des de la pantalla d&apos;inici, com una app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            {canNativeInstall ? (
              <>
                <div className="space-y-2">
                  <Button
                    type="button"
                    disabled={installing}
                    onClick={() => void handleNativeInstall()}
                    className="h-11 min-h-11 w-full touch-manipulation bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright disabled:opacity-70"
                  >
                    {installing ? "Instal·lant…" : "Instal·lar l'app"}
                  </Button>
                  <p className="text-sm leading-snug text-mute">
                    Això afegeix Supermanager a la pantalla d&apos;inici.
                  </p>
                </div>
                <div className="space-y-3.5">
                  <AndroidInstallSteps />
                  <IphoneInstallSteps />
                </div>
              </>
            ) : ios ? (
              <div className="space-y-3.5">
                <IphoneInstallSteps />
                <p className="text-xs leading-snug text-mute/80">
                  A l&apos;iPhone cal fer-ho així — no hi ha botó Instal·lar.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <AndroidInstallSteps />
                <IphoneInstallSteps />
              </div>
            )}

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
              className={
                canNativeInstall
                  ? "h-11 min-h-11 w-full touch-manipulation border border-line bg-transparent font-semibold uppercase tracking-wide text-bone hover:bg-ink"
                  : "h-11 min-h-11 w-full touch-manipulation bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
              }
              variant={canNativeInstall ? "outline" : "default"}
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
