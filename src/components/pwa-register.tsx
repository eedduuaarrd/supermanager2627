"use client";

import { useEffect } from "react";
import { captureBeforeInstallPrompt } from "@/lib/pwa-install";

/** Registers the installable PWA service worker and captures install prompts. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stopCapture = captureBeforeInstallPrompt();

    if (!("serviceWorker" in navigator)) {
      return () => {
        stopCapture();
      };
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore SW failures in private mode / unsupported hosts */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      stopCapture();
    };
  }, []);

  return null;
}
