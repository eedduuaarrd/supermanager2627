"use client";

import { useManager } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Shared loading / boot-error gate for pages that need roster + lineup. */
export function BootGate({
  children,
  scroll = false,
}: {
  children: ReactNode;
  /** Grow with the page so the shell can scroll (Inici). Equip stays height-locked. */
  scroll?: boolean;
}) {
  const { ready, bootError, roster } = useManager();

  if (!ready) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-mute" />
        <p className="text-mute">Carregant…</p>
      </div>
    );
  }

  if (bootError || !roster) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="size-10 text-grana-bright" />
        <h2 className="font-display text-3xl text-bone">Error de càrrega</h2>
        <p className="text-mute">{bootError}</p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-grana text-bone hover:bg-grana-bright"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (scroll) return children;

  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}
