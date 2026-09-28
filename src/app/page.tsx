import Link from "next/link";
import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await readSession();
  if (user) redirect("/jornada");

  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgb(155_32_48/0.18),transparent_45%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <p className="font-display text-lg text-bone">Supermanager Balaguer</p>
        <div className="flex gap-2">
          <Link
            href="/login"
            className="rounded-sm border border-line px-3 py-2 text-sm text-bone hover:bg-white/5"
          >
            Entra
          </Link>
          <Link
            href="/register"
            className="rounded-sm bg-grana px-3 py-2 text-sm font-medium text-bone hover:bg-grana-bright"
          >
            Registra&apos;t
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pb-16 pt-10">
        <p className="animate-fade-up text-xs font-medium uppercase tracking-[0.28em] text-mute">
          Club Bàsquet Balaguer · Sèniors FCBQ
        </p>
        <h1 className="animate-fade-up mt-4 max-w-3xl font-display text-5xl leading-[0.95] text-bone sm:text-7xl">
          Supermanager
          <span className="block text-grana-bright">Balaguer</span>
        </h1>
        <p className="animate-fade-up-delay mt-6 max-w-xl text-base leading-relaxed text-mute sm:text-lg">
          Competició fantasy per als sèniors del club. Construeix la plantilla,
          confirma l&apos;alineació cada jornada i disputa la classificació
          general amb la resta de mànagers.
        </p>
        <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-sm bg-grana px-5 py-3 text-sm font-semibold uppercase tracking-wide text-bone hover:bg-grana-bright"
          >
            Crear compte
          </Link>
          <Link
            href="/login"
            className="rounded-sm border border-line px-5 py-3 text-sm font-semibold uppercase tracking-wide text-bone hover:bg-white/5"
          >
            Ja tinc compte
          </Link>
        </div>
        <ul className="animate-fade-up-delay mt-10 grid max-w-2xl gap-3 text-sm text-mute sm:grid-cols-3">
          <li className="border-l border-grana pl-3">
            Plantilla 8 jugadors
          </li>
          <li className="border-l border-line pl-3">Jornada + general</li>
          <li className="border-l border-line pl-3">Dades FCBQ 2026-27</li>
        </ul>
      </section>
    </main>
  );
}
