"use client";

import { useManager } from "@/components/manager-provider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ComptePage() {
  const { user } = useManager();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-3xl tracking-wide text-bone">Compte</h1>
        <p className="mt-2 text-sm text-mute">Dades del teu mànager.</p>
      </section>

      <section className="border border-line bg-panel/80 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
          Mànager
        </p>
        <p className="mt-1 font-medium text-bone">{user.displayName}</p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-mute">
          Equip fantasy
        </p>
        <p className="mt-1 font-display text-2xl text-bone">{user.teamName}</p>
        <p className="mt-3 truncate text-xs text-mute">{user.email}</p>
        {user.isAdmin && (
          <p className="mt-2 text-xs text-grana-bright">Administrador</p>
        )}
      </section>

      <section className="border border-line bg-panel/60 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
          Regles ràpides
        </p>
        <ul className="mt-3 space-y-2 text-sm text-mute">
          <li>8 jugadors per alineació (qualsevol mix)</li>
          <li>Pressupost 100.000 €</li>
          <li>Capità ×2 als punts de jornada</li>
        </ul>
      </section>

      <Button
        type="button"
        onClick={() => void logout()}
        className="h-11 w-full border border-line bg-panel-2 text-bone hover:bg-white/10"
      >
        <LogOut className="size-4" /> Surt
      </Button>
    </div>
  );
}
