"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPlayer } from "@/data/roster";
import { sortedStandings } from "@/lib/game";
import type { GameState, RoundResult } from "@/lib/types";
import { Crown, Loader2, Trophy } from "lucide-react";

interface ResultsPanelProps {
  state: GameState;
  lastResult: RoundResult | null;
  onPlayRound: () => void;
  playing?: boolean;
  error?: string | null;
}

export function ResultsPanel({
  state,
  lastResult,
  onPlayRound,
  playing,
  error,
}: ResultsPanelProps) {
  const standings = sortedStandings(state.league);
  const youRank = standings.findIndex((m) => m.isYou) + 1;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-navy/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gold/80">
          Proper jornada
        </p>
        <h2 className="mt-1 font-display text-3xl text-cream">
          Jornada {state.currentRound}
        </h2>
        <p className="mt-1 text-sm text-cream/60">
          {state.lineup.confirmed
            ? "Alineació tancada. Simula la jornada del sènior a Segona Catalana."
            : "Confirma l'alineació a Equip abans de jugar la jornada."}
        </p>
        <Button
          type="button"
          size="lg"
          disabled={!state.lineup.confirmed || playing}
          onClick={onPlayRound}
          className="mt-4 h-12 w-full bg-grana text-cream hover:bg-grana-bright"
        >
          {playing ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Simulant partit…
            </>
          ) : (
            `Jugar jornada ${state.currentRound}`
          )}
        </Button>
        {error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}
      </section>

      {lastResult ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy/60">
          <header className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-cream/50">Jornada {lastResult.round}</p>
                <h3 className="font-display text-xl text-cream">
                  vs {lastResult.opponent}
                </h3>
              </div>
              <Badge
                className={
                  lastResult.won
                    ? "bg-emerald-600 text-white"
                    : "bg-white/15 text-cream"
                }
              >
                {lastResult.won ? "Victòria (+20%)" : "Derrota"}
              </Badge>
            </div>
            <p className="mt-2 font-display text-4xl text-gold">
              {lastResult.teamPoints}{" "}
              <span className="text-lg text-cream/50">pts</span>
            </p>
          </header>
          <div>
            {lastResult.scores
              .slice()
              .sort((a, b) => b.points - a.points)
              .map((score) => {
                const player = getPlayer(score.playerId);
                const isCaptain = lastResult.captainId === score.playerId;
                return (
                  <div
                    key={score.playerId}
                    className="flex items-center justify-between border-b border-white/8 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-cream">
                        {player?.name ?? score.playerId}
                        {isCaptain ? " · C" : ""}
                      </p>
                      <p className="text-xs text-cream/50">
                        {score.minutes}&apos; ·{" "}
                        {score.winBonus ? "bonus victòria" : "sense bonus"}
                        {isCaptain ? " · ×2 capità" : ""}
                      </p>
                    </div>
                    <p className="font-display text-2xl text-gold">{score.points}</p>
                  </div>
                );
              })}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/15 bg-navy/40 px-4 py-12 text-center">
          <Trophy className="mx-auto size-8 text-gold/70" />
          <p className="mt-3 font-medium text-cream">Encara no hi ha resultats</p>
          <p className="mt-1 text-sm text-cream/55">
            Quan confirmis l&apos;alineació i juguis la jornada, veuràs la valoració de
            cada jugador aquí.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy/60">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-display text-xl text-cream">Lliga amics CBB</h3>
          <Badge variant="outline" className="border-gold/40 text-gold">
            #{youRank || "—"}
          </Badge>
        </header>
        {standings.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center gap-3 border-b border-white/8 px-4 py-3 ${
              member.isYou ? "bg-grana/20" : ""
            }`}
          >
            <span className="w-6 font-display text-lg text-gold/80">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-cream">
                {member.name}
                {member.isYou ? " (tu)" : ""}
              </p>
              <p className="text-xs text-cream/50">
                Última jornada: {member.lastRoundPoints} pts
              </p>
            </div>
            {index === 0 && <Crown className="size-4 text-gold" />}
            <p className="font-display text-xl text-cream">{member.totalPoints}</p>
          </div>
        ))}
      </section>

      {state.history.length > 1 && (
        <section className="rounded-2xl border border-white/10 bg-navy/50 p-4">
          <h3 className="font-display text-lg text-cream">Historial</h3>
          <ul className="mt-3 space-y-2">
            {state.history.slice(0, 6).map((h) => (
              <li
                key={`${h.round}-${h.playedAt}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-cream/70">
                  J{h.round} · {h.opponent}
                </span>
                <span className="font-semibold text-gold">{h.teamPoints} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
