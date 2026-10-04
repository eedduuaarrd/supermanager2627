"use client";

import { useLayoutEffect } from "react";

export function AppViewportLock() {
  useLayoutEffect(() => {
    const apply = (window as Window & { __applyAppViewport?: () => void })
      .__applyAppViewport;
    apply?.();
  }, []);
  return null;
}
