"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "sm-onboarding-seen";

export function OnboardingClient() {
  const router = useRouter();

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    router.replace("/jornada");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <p className="text-xs uppercase tracking-[0.22em] text-mute">
        Benvingut/da
      </p>
      <h1 className="mt-2 font-display text-4xl text-bone">Com funciona</h1>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        Cada jornada construeixes una alineació de 8 jugadors dels sèniors del
        club, amb pressupost limitat. El capità suma el doble. Confirma abans
        que es tanqui la jornada i disputa la classificació.
      </p>
      <ul className="mt-6 space-y-3 border-l border-grana pl-4 text-sm text-bone">
        <li>8 jugadors (qualsevol mix)</li>
        <li>Pressupost 100.000 €</li>
        <li>Capità ×2</li>
        <li>Toca + a la pista per triar per equip del club</li>
      </ul>
      <Button
        type="button"
        onClick={dismiss}
        className="mt-10 h-12 w-full bg-grana font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
      >
        Entès · Anar a l&apos;inici
      </Button>
      <p className="mt-4 text-center text-xs text-mute">
        Pots revisar les regles a{" "}
        <Link href="/compte" className="text-bone underline underline-offset-4">
          Compte
        </Link>
        .
      </p>
    </main>
  );
}
