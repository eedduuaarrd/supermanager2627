"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Trophy } from "lucide-react";

type StandingRow = {
  teamId: string;
  userId: string;
  displayName: string;
  teamName: string;
  points: number;
  rank: number;
  isYou: boolean;
};

export function StandingsPanel() {
  const [scope, setScope] = useState<"jornada" | "general">("general");
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [round, setRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextScope = scope) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/standings?scope=${nextScope}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setRows(data.rows);
      setRound(data.round);
    } catch {
      setError("No s'ha pogut carregar la classificació.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch standings on scope change
    void load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setScope("general")}
          className={
            scope === "general"
              ? "bg-grana text-bone hover:bg-grana-bright"
              : "bg-transparent text-mute hover:bg-white/10 hover:text-bone"
          }
        >
          General
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => setScope("jornada")}
          className={
            scope === "jornada"
              ? "bg-grana text-bone hover:bg-grana-bright"
              : "bg-transparent text-mute hover:bg-white/10 hover:text-bone"
          }
        >
          Jornada
        </Button>
      </div>

      <section className="border border-line bg-panel/90">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Trophy className="size-4 text-grana-bright" />
          <h2 className="font-display text-xl text-bone">
            {scope === "general"
              ? "Classificació general"
              : `Classificació jornada ${round}`}
          </h2>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-mute">
            <Loader2 className="size-4 animate-spin" /> Carregant…
          </div>
        ) : error ? (
          <div className="flex gap-2 px-4 py-8 text-sm text-red-200">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-mute">
            Encara no hi ha equips a la lliga.
          </div>
        ) : (
          <ol>
            {rows.map((row) => (
              <li
                key={row.teamId}
                className={cn(
                  "flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
                  row.isYou && "bg-grana/10",
                )}
              >
                <span className="w-8 font-display text-lg text-mute">
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-bone">
                    {row.teamName}
                    {row.isYou ? " · tu" : ""}
                  </p>
                  <p className="truncate text-xs text-mute">{row.displayName}</p>
                </div>
                <span className="font-display text-xl text-bone">{row.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
