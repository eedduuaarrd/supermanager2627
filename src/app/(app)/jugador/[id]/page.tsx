import { PlayerAvatar } from "@/components/player-avatar";
import { PriceLabel } from "@/components/price-label";
import { Badge } from "@/components/ui/badge";
import { teamLabel } from "@/data/roster";
import {
  dateForGame,
  formatMatchupLine,
  nextMatchForTeamId,
  opponentForGame,
} from "@/lib/fixtures";
import { MARKET_PRICE_FOOTNOTE_CA } from "@/lib/market-price";
import { buildPlayerDetail, gameJornada } from "@/lib/player-stats";
import { computeVal, missedFt, VAL_FORMULA_FOOTNOTE_CA } from "@/lib/val";
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

function StatCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-mute">{label}</dt>
      <dd
        className={
          emphasize
            ? "mt-0.5 text-sm font-semibold tabular-nums text-grana-bright"
            : "mt-0.5 text-sm tabular-nums text-bone"
        }
      >
        {value}
      </dd>
    </div>
  );
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
  const nextLine =
    nextMatch?.matchup ||
    (nextMatch
      ? formatMatchupLine(
          nextMatch.fullName || nextMatch.shortName,
          nextMatch.opponent,
          nextMatch.home,
        )
      : null);

  return (
    <div className="space-y-5 pb-4">
      <Link
        href="/equip"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-mute hover:text-bone"
      >
        <ArrowLeft className="size-3.5" /> Tornar a l&apos;equip
      </Link>

      <section className="flex items-start gap-3.5">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="lg"
          className="!h-20 !w-20 shrink-0 rounded-full ring-2 ring-bone/25"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight tracking-wide break-words text-bone sm:text-3xl">
            {player.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="max-w-full border-white/15 text-[10px] uppercase tracking-wide text-mute"
            >
              <span className="truncate">{teamLabel(player.teamId)}</span>
            </Badge>
          </div>
          <p className="mt-2 text-sm text-mute">
            Preu{" "}
            <PriceLabel
              price={player.price}
              prevPrice={player.prevPrice}
              className="font-semibold text-bone"
              showDelta
              variacioLabel
            />
          </p>
        </div>
      </section>

      {nextMatch && (
        <section className="border-b border-line/60 pb-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            Proper partit · {nextMatch.fullName || nextMatch.shortName}
          </p>
          {nextLine ? (
            <div className="mt-1.5 flex flex-col gap-0.5">
              <p className="w-full whitespace-normal text-sm leading-snug break-words text-bone">
                {nextLine}
              </p>
              <p className="text-xs tabular-nums text-mute">
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
            {games.map((g, i) => {
              const opponent = opponentForGame(g);
              const gameDate = dateForGame(g);
              const jornada = gameJornada(g);
              const tlMiss = missedFt(g.tli, g.tlc);
              const val =
                g.val ??
                computeVal({
                  pts: g.pts,
                  pf: g.pf,
                  ftm: g.tlc,
                  fta: g.tli,
                  pm: g.pm,
                });
              return (
                <li key={`${g.teamId}-${i}`} className="bg-panel/40 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug break-words text-bone">
                        {opponent
                          ? `vs ${opponent}`
                          : jornada
                            ? `Jornada ${jornada}`
                            : "Partit FCBQ"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-mute">
                        {teamLabel(g.teamId)}
                        {gameDate ? ` · ${gameDate}` : ""}
                        {jornada != null ? ` · J${jornada}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl tabular-nums text-grana-bright">
                        {val != null ? `VAL ${fmt(val, 0)}` : "—"}
                      </p>
                    </div>
                  </div>
                  {/* VAL formula row: PTS − PF − missed FT + PM */}
                  <dl className="mt-3 grid grid-cols-5 gap-1.5 border border-line/70 bg-ink/30 px-2 py-2 text-center">
                    <StatCell label="PTS" value={fmt(g.pts)} />
                    <StatCell label="PF" value={fmt(g.pf)} />
                    <StatCell label="TL↓" value={fmt(tlMiss)} />
                    <StatCell label="±" value={fmt(g.pm)} />
                    <StatCell
                      label="VAL"
                      value={val != null ? fmt(val, 0) : "—"}
                      emphasize
                    />
                  </dl>
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-center sm:grid-cols-6">
                    <StatCell label="MIN" value={fmt(g.min, 1)} />
                    <StatCell label="T2" value={shooting(g.t2c, g.t2i)} />
                    <StatCell label="T3" value={shooting(g.t3c, g.t3i)} />
                    <StatCell label="TL" value={shooting(g.tlc, g.tli)} />
                    {(g.reb != null || g.ast != null) && (
                      <>
                        <StatCell label="REB" value={fmt(g.reb)} />
                        <StatCell label="AST" value={fmt(g.ast)} />
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {player.note && (
        <p className="text-xs leading-relaxed text-mute">{player.note}</p>
      )}
    </div>
  );
}
