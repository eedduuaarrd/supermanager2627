"use client";

import { useManager } from "@/components/manager-provider";
import { TeamManager } from "@/components/team-manager";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/data/roster";
import { BUY_SELL_RULE_CA, MARKET_PRICE_FOOTNOTE_CA } from "@/lib/market-price";
import { patrimoni, squadMarketValue } from "@/lib/game";
import { VAL_FORMULA_FOOTNOTE_CA } from "@/lib/val";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ComptePage() {
  const { user, maxTeams, budget, lineup } = useManager();
  const router = useRouter();
  const marketValue = squadMarketValue(lineup.playerIds);
  const netWorth = patrimoni(budget, lineup.playerIds);

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
        <p className="mt-1 text-sm text-mute">Equip actiu: {user.teamName}</p>
        <p className="mt-3 truncate text-xs text-mute">{user.email}</p>
        {user.isAdmin && (
          <p className="mt-2 text-xs text-grana-bright">Administrador</p>
        )}
      </section>

      <TeamManager />

      <section className="border border-line bg-panel/80 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
          Patrimoni
        </p>
        <p className="mt-1 font-display text-xl tabular-nums text-bone">
          {formatPrice(netWorth)}
        </p>
        <p className="mt-2 text-[11px] tabular-nums text-mute">
          Efectiu {formatPrice(budget)} · Plantilla {formatPrice(marketValue)}
        </p>
      </section>

      <section className="border border-line bg-panel/60 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
          Regles ràpides
        </p>
        <ul className="mt-3 space-y-2 text-sm text-mute">
          <li>Fins a {maxTeams} equips per compte</li>
          <li>8 jugadors per alineació (3 pivots, 3 alers, 2 bases)</li>
          <li>Pressupost 100.000 € per equip</li>
          <li>{BUY_SELL_RULE_CA}</li>
          <li>Capità ×2 als punts de jornada</li>
          <li>
            Finestra de transferències: diumenge 23:59 (Madrid) → primer tip-off;
            màxim 3 canvis (afegir un jugador nou vs l&apos;instantània)
          </li>
          <li>Cada setmana, jornada nova amb els partits del club</li>
          <li>{VAL_FORMULA_FOOTNOTE_CA}</li>
          <li>{MARKET_PRICE_FOOTNOTE_CA}</li>
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
