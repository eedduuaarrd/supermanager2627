"use client";

import { useLayoutEffect } from "react";

function applyAppViewport() {
  const vv = window.visualViewport;
  const height = vv && vv.height > 0 ? vv.height : window.innerHeight;
  const top = vv && vv.offsetTop > 0 ? vv.offsetTop : 0;
  if (!(height > 0)) return;
  const root = document.documentElement;
  root.style.setProperty("--app-height", `${height}px`);
  root.style.setProperty("--app-top", `${top}px`);
}

export function AppViewportLock() {
  useLayoutEffect(() => {
    applyAppViewport();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", applyAppViewport);
    vv?.addEventListener("scroll", applyAppViewport);
    window.addEventListener("resize", applyAppViewport);
    window.addEventListener("orientationchange", applyAppViewport);
    window.addEventListener("pageshow", applyAppViewport);
    return () => {
      vv?.removeEventListener("resize", applyAppViewport);
      vv?.removeEventListener("scroll", applyAppViewport);
      window.removeEventListener("resize", applyAppViewport);
      window.removeEventListener("orientationchange", applyAppViewport);
      window.removeEventListener("pageshow", applyAppViewport);
    };
  }, []);
  return null;
}
