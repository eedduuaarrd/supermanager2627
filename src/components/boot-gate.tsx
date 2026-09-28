"use client";

import { useManager } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Shared loading / boot-error gate for pages that need roster + lineup. */
export function BootGate({ children }: { children: ReactNode }) {
  const { ready, bootError, roster } = useManager();

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-mute" />
        <p className="text-mute">Carregant…</p>
      </div>
    );
  }

  if (bootError || !roster) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
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

  return children;
}
