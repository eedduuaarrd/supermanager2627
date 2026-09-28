import { FantasyApp } from "@/components/fantasy-app";

export default function Home() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col">
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(226_179_74/0.18),transparent_40%)]" />
        <div className="relative mx-auto max-w-lg px-4 pb-8 pt-8">
          <p className="animate-rise text-xs uppercase tracking-[0.28em] text-gold/90">
            Club Bàsquet Balaguer · Sènior
          </p>
          <h1 className="animate-rise brand-pulse mt-2 inline-block font-display text-5xl leading-none text-cream sm:text-6xl">
            Supermanager
            <span className="block text-gold">Balaguer</span>
          </h1>
          <p className="animate-rise-delay mt-4 max-w-md text-sm leading-relaxed text-cream/70 sm:text-base">
            Fitxa 8 jugadors del pavelló, nomena capità i suma valoració cada
            jornada. Inspirat en els fantasy de bàsquet i futbol, fet per a la
            grana de la Noguera.
          </p>
          <div className="animate-rise-delay mt-5 flex flex-wrap gap-2 text-xs text-cream/55">
            <span className="rounded-md border border-white/15 px-2 py-1">
              2 Bases · 3 Alers · 3 Pivots
            </span>
            <span className="rounded-md border border-white/15 px-2 py-1">
              Capità ×2
            </span>
            <span className="rounded-md border border-white/15 px-2 py-1">
              Bonus victòria +20%
            </span>
          </div>
        </div>
      </header>

      <FantasyApp />

      <footer className="mt-auto border-t border-white/10 px-4 py-6 text-center text-xs text-cream/40">
        Projecte no oficial · No afiliat a l&apos;ACB ni a Fantasy LaLiga · Dades
        de plantilla documentades amb placeholders etiquetats
      </footer>
    </main>
  );
}
