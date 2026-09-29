"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sm_install_hint_dismissed";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

/** Compact, dismissible PWA install steps for Android / iPhone. */
export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (isStandaloneDisplay()) return;
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <details className="hub-fade-late group border-t border-line/50 pt-3">
      <summary className="cursor-pointer list-none text-sm text-mute marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          Com instal·lar l&apos;app
          <span
            className="text-xs transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm text-bone">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
            Android
          </p>
          <p className="leading-snug text-mute">
            Chrome → menú ⋮ → «Afegeix a la pantalla d&apos;inici» / Instal·la
            l&apos;app
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
            iPhone
          </p>
          <p className="leading-snug text-mute">
            Safari → Compartir □↑ → «Afegeix a la pantalla d&apos;inici»
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs uppercase tracking-[0.12em] text-mute underline-offset-4 hover:text-bone hover:underline"
        >
          D&apos;acord
        </button>
      </div>
    </details>
  );
}
