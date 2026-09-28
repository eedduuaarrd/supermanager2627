import { PlayerAvatar } from "@/components/player-avatar";
import { PriceLabel } from "@/components/price-label";
import { Badge } from "@/components/ui/badge";
import { teamLabel } from "@/data/roster";
import { nextMatchForTeamId } from "@/lib/fixtures";
import { MARKET_PRICE_FOOTNOTE_CA } from "@/lib/market-price";
import { buildPlayerDetail, gameJornada } from "@/lib/player-stats";
import { VAL_FORMULA_FOOTNOTE_CA } from "@/lib/val";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n * 10) / 10);
}

function shooting(made?: number | null, att?: number | null) {
  if (made == null || att == null) return "—";
  return `${made}/${att}`;
}

function formatNextWhen(tipOff: string | null, date: string | null): string {
  if (tipOff) {
    try {
      return new Intl.DateTimeFormat("ca-ES", {
        timeZone: "Europe/Madrid",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(tipOff));
    } catch {
      /* fall through */
    }
  }
  if (date) {
    try {
      return new Intl.DateTimeFormat("ca-ES", {
        timeZone: "Europe/Madrid",
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(`${date}T12:00:00`));
    } catch {
      return date;
    }
  }
  return "Data pendent";
}

export default async function JugadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = buildPlayerDetail(id);
  if (!detail) notFound();

  const { player, games, summary, meta } = detail;
  // Dual-team fantasy ids use this variant's teamId → that side's FCBQ schedule.
  const nextMatch = nextMatchForTeamId(player.teamId);

  return (
    <div className="space-y-5 pb-4">
      <Link
        href="/equip"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-mute hover:text-bone"
      >
        <ArrowLeft className="size-3.5" /> Tornar a l&apos;equip
      </Link>

      <section className="flex items-start gap-4">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className="!h-20 !w-20 rounded-full ring-2 ring-bone/25"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight tracking-wide text-bone sm:text-3xl">
            {player.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="border-white/15 text-[10px] uppercase tracking-wide text-mute"
            >
              {teamLabel(player.teamId)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-mute">
            Preu{" "}
            <PriceLabel
              price={player.price}
              prevPrice={player.prevPrice}
              className="font-semibold text-bone"
            />
          </p>
        </div>
      </section>

      {nextMatch && (
        <section className="border-b border-line/60 pb-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Proper partit · {nextMatch.fullName || nextMatch.shortName}
          </p>
          {nextMatch.matchup || nextMatch.opponent ? (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-bone">
                {nextMatch.matchup ||
                  (nextMatch.home === false
                    ? `${nextMatch.opponent} vs ${nextMatch.fullName || nextMatch.shortName}`
                    : `${nextMatch.fullName || nextMatch.shortName} vs ${nextMatch.opponent}`)}
              </p>
              <p className="shrink-0 text-xs tabular-nums text-mute">
                {formatNextWhen(nextMatch.tipOff, nextMatch.date)}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-mute">
              Sense proper partit al calendari FCBQ
            </p>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-2 border border-line bg-panel/70 px-3 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Partits
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums text-bone">
            {summary.gamesPlayed}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Mitj. VAL
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums text-grana-bright">
            {summary.avgVal == null ? "—" : fmt(summary.avgVal, 1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Mitj. PTS
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums text-bone">
            {summary.avgPts == null ? "—" : fmt(summary.avgPts, 1)}
          </p>
        </div>
      </section>
      <p className="text-[11px] leading-relaxed text-mute">
        {VAL_FORMULA_FOOTNOTE_CA}
      </p>
      <p className="text-[11px] leading-relaxed text-mute">
        {MARKET_PRICE_FOOTNOTE_CA}
      </p>

      <section>
        <header className="mb-2 flex items-end justify-between gap-2">
          <h2 className="font-display text-xl tracking-wide text-bone">
            Partits
          </h2>
          {meta.extractedAt && (
            <p className="text-[10px] text-mute">FCBQ · {meta.extractedAt}</p>
          )}
        </header>

        {games.length === 0 ? (
          <div className="border border-dashed border-line px-4 py-10 text-center">
            <p className="text-sm text-mute">
              Encara no hi ha partits registrats
            </p>
            <p className="mt-2 text-xs text-mute">
              L&apos;historial creix cada setmana amb els partits FCBQ del club.
              No s&apos;inventen partits futurs.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {games.map((g, i) => (
              <li key={`${g.teamId}-${i}`} className="bg-panel/40 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bone">
                      {g.opponent
                        ? `vs ${g.opponent}`
                        : gameJornada(g)
                          ? `Jornada ${gameJornada(g)}`
                          : "Partit FCBQ"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-mute">
                      {teamLabel(g.teamId)}
                      {g.date ? ` · ${g.date}` : ""}
                      {gameJornada(g) != null && g.opponent
                        ? ` · J${gameJornada(g)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl tabular-nums text-grana-bright">
                      {g.val != null ? `VAL ${fmt(g.val, 0)}` : "—"}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center sm:grid-cols-6">
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      MIN
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {fmt(g.min, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      PTS
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {fmt(g.pts)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      FP
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {fmt(g.pf)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      T2
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {shooting(g.t2c, g.t2i)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      T3
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {shooting(g.t3c, g.t3i)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      TL
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {shooting(g.tlc, g.tli)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] uppercase tracking-wider text-mute">
                      ±
                    </dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-bone">
                      {fmt(g.pm)}
                    </dd>
                  </div>
                  {(g.reb != null || g.ast != null) && (
                    <>
                      <div>
                        <dt className="text-[9px] uppercase tracking-wider text-mute">
                          REB
                        </dt>
                        <dd className="mt-0.5 text-sm tabular-nums text-bone">
                          {fmt(g.reb)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase tracking-wider text-mute">
                          AST
                        </dt>
                        <dd className="mt-0.5 text-sm tabular-nums text-bone">
                          {fmt(g.ast)}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {player.note && (
        <p className="text-xs leading-relaxed text-mute">{player.note}</p>
      )}
    </div>
  );
}
