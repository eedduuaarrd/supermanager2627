"use client";

import { LineupBuilder } from "@/components/lineup-builder";
import { ResultsPanel } from "@/components/results-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createInitialState, simulateRound } from "@/lib/game";
import { bootstrapGame, clearGame, saveGame } from "@/lib/storage";
import type { GameState, RoundResult } from "@/lib/types";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

export function FantasyApp() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [tab, setTab] = useState("equip");
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [nameDraft, setNameDraft] = useState("Mànager CBB");
  const [confirming, startConfirm] = useTransition();
  const [playing, startPlay] = useTransition();

  useEffect(() => {
    try {
      const game = bootstrapGame();
      setState(game);
      setNameDraft(game.managerName);
      setLastResult(game.history[0] ?? null);
    } catch {
      setBootError("No s'ha pogut carregar la partida desada.");
    } finally {
      setReady(true);
    }
  }, []);

  function persist(next: GameState) {
    setState(next);
    try {
      saveGame(next);
    } catch {
      setActionError("No s'ha pogut desar a localStorage.");
    }
  }

  function handleConfirm() {
    if (!state) return;
    setActionError(null);
    startConfirm(() => {
      const next: GameState = {
        ...state,
        lineup: {
          ...state.lineup,
          confirmed: true,
          confirmedAt: new Date().toISOString(),
        },
        managerName: nameDraft.trim() || state.managerName,
        league: state.league.map((m) =>
          m.isYou
            ? { ...m, name: nameDraft.trim() || state.managerName }
            : m,
        ),
      };
      persist(next);
      setTab("jornada");
    });
  }

  function handlePlayRound() {
    if (!state) return;
    setActionError(null);
    startPlay(() => {
      const outcome = simulateRound(state);
      if ("error" in outcome) {
        setActionError(outcome.error);
        return;
      }
      persist(outcome.state);
      setLastResult(outcome.result);
    });
  }

  function handleReset() {
    clearGame();
    const fresh = createInitialState(nameDraft.trim() || "Mànager CBB");
    persist(fresh);
    setLastResult(null);
    setActionError(null);
    setTab("equip");
  }

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-gold/40 border-t-gold" />
        <p className="text-cream/70">Carregant el mercat de Balaguer…</p>
      </div>
    );
  }

  if (bootError || !state) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="size-10 text-gold" />
        <h2 className="font-display text-3xl text-cream">Error de càrrega</h2>
        <p className="text-cream/65">
          {bootError ?? "Alguna cosa ha fallat en iniciar Supermanager Balaguer."}
        </p>
        <Button
          type="button"
          onClick={() => {
            clearGame();
            const fresh = createInitialState();
            setState(fresh);
            setBootError(null);
            setNameDraft(fresh.managerName);
          }}
          className="bg-gold text-navy-deep hover:bg-gold/90"
        >
          Començar de nou
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <div className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="manager-name" className="text-xs text-cream/50">
            Nom del mànager
          </label>
          <Input
            id="manager-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              const name = nameDraft.trim() || "Mànager CBB";
              persist({
                ...state,
                managerName: name,
                league: state.league.map((m) =>
                  m.isYou ? { ...m, name } : m,
                ),
              });
            }}
            className="mt-1 border-white/15 bg-navy/50 text-cream placeholder:text-cream/40"
            placeholder="El teu nom"
            maxLength={24}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleReset}
          className="mb-0.5 text-cream/60 hover:bg-white/10 hover:text-cream"
          aria-label="Reiniciar partida"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="grid h-11 w-full grid-cols-2 bg-navy/80">
          <TabsTrigger value="equip" className="text-cream data-active:bg-grana">
            Equip
          </TabsTrigger>
          <TabsTrigger value="jornada" className="text-cream data-active:bg-grana">
            Jornada
          </TabsTrigger>
        </TabsList>
        <TabsContent value="equip" className="mt-0">
          <LineupBuilder
            state={state}
            onChange={persist}
            onConfirm={handleConfirm}
            confirming={confirming}
            error={actionError}
          />
        </TabsContent>
        <TabsContent value="jornada" className="mt-0">
          <ResultsPanel
            state={state}
            lastResult={lastResult}
            onPlayRound={handlePlayRound}
            playing={playing}
            error={actionError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
