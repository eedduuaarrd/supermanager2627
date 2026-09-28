#!/usr/bin/env node
/**
 * Refresh src/data/player-stats.json from FCBQ team plantillas.
 * Balaguer rule: person × team = distinct fantasy id (no cross-team dedupe).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "src/data/player-stats.json");

const TEAM_URLS = [
  "https://www.basquetcatala.cat/estadistica/equip/5f55017e-893e-4323-8b41-b58323ea8f73",
  "https://www.basquetcatala.cat/estadistica/equip/c057eeae-3aae-4e33-b2ab-54fabb2700ae",
  "https://www.basquetcatala.cat/estadistica/equip/839e2243-48dc-4459-aec5-a2dadeb3ad53",
  "https://www.basquetcatala.cat/estadistica/equip/a5c75f3f-ca35-4553-9eb6-a29780eb2007",
];

const TEAM_MAP = {
  "5f55017e-893e-4323-8b41-b58323ea8f73": { teamId: "masc-a", slug: "teixido-a" },
  "c057eeae-3aae-4e33-b2ab-54fabb2700ae": { teamId: "masc-b", slug: "sifonet-b" },
  "839e2243-48dc-4459-aec5-a2dadeb3ad53": { teamId: "fem-a", slug: "cudos-a" },
  "a5c75f3f-ca35-4553-9eb6-a29780eb2007": { teamId: "fem-b", slug: "farratges-b" },
};

const BASE_IDS = {
  "HECTOR LOZANO MARTINEZ": "hector-lozano",
  "EDUARD BERNAT SUCARRAT": "eduard-bernat",
  "TONI SALUD GARCIA": "toni-salud",
  "IVAN FRANCO GUERRERO": "ivan-franco",
  "GERARD GARCIA ROSAURO": "gerard-garcia",
  "MARC ESCODA ANGERRI": "marc-escoda",
  "BABACAR TOURE GASSAMA": "babacar-toure",
  "GERARD SOLDEVILA CASAS": "gerard-soldevila",
  "ROGER COMPANYS SOLA": "roger-companys",
  "ARES BUNOL PERELLO": "ares-bunol",
  "JULIA PLA PLA": "julia-pla",
  "ANDREA PERAT GRACIA": "andrea-perat",
  "NEUS ESCODA ANGERRI": "neus-escoda",
  "MONICA FONTANET MALLOL": "monica-fontanet",
  "QUERALT SOLE TORRES": "queralt-sole",
  "CLARA PANIAGUA MARVA": "clara-paniagua",
  "MARIAMA MBALLO DIALLO": "mariama-mballo",
  "MARTINA BENITEZ FARRANDO": "martina-benitez",
  "ADA DOMENE MORALEDA": "ada-domene",
  "JANA ROLDAN ARANDILLA": "jana-roldan",
  "NURIA JIMENEZ ARAN": "nuria-jimenez",
  "ABRIL GRACIA PALACIN": "abril-gracia",
  "XENIA ANDREU MONELL": "xenia-andreu",
  "GINA BETBESE SANCHEZ": "gina-betbese",
  "GINA TRILLA PINIES": "gina-trilla",
  "JANA ALARCON SOLANES": "jana-alarcon",
};

const DUAL_BASES = new Set(["julia-pla", "queralt-sole", "mariama-mballo"]);

function norm(s) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

function fantasyId(base, teamSlug) {
  return DUAL_BASES.has(base) ? `${base}__${teamSlug}` : base;
}

function buildFromRosters(rosters) {
  const players = {};
  for (const t of rosters.teams ?? []) {
    const meta = TEAM_MAP[t.id];
    if (!meta) continue;
    const { teamId, slug } = meta;
    for (const p of t.players ?? []) {
      const base = BASE_IDS[norm(p.name)];
      if (!base) { console.warn("Unmapped FCBQ name:", p.name); continue; }
      const pid = fantasyId(base, slug);
      const stats = p.stats ?? {};
      const pj = stats.PJ ?? 0;
      const entry = (players[pid] ??= {
        playerId: pid, fcbqName: p.name, fcbqPersonId: null, teamId, games: [],
        source: "fcbq-team-page-aggregate",
      });
      if (pj === 1) {
        if (entry.games.some((g) => g.teamId === teamId)) continue;
        entry.number = p.number ?? null;
        entry.games.push({
          date: null, round: null, opponent: null, teamId, fcbqTeamId: t.id,
          competition: t.competition ?? null,
          min: stats.MIN ?? null, pts: stats.PTS ?? null,
          t2c: stats.T2C ?? null, t2i: stats.T2I ?? null,
          t3c: stats.T3C ?? null, t3i: stats.T3I ?? null,
          tlc: stats.TLC ?? null, tli: stats.TLI ?? null,
          // FCBQ Plantilla often leaves VAL as "—"; PM is +/-.
          val: stats.VAL ?? null,
          pm: stats.PM ?? null,
          note:
            stats.VAL == null
              ? "Mostreig FCBQ (PJ=1). VAL no publicat a Plantilla; PM = +/-."
              : "Mostreig FCBQ (PJ=1 a la fitxa d'equip; totals = aquest partit).",
        });
      } else if (pj > 1) {
        entry.seasonNote = `FCBQ mostra PJ=${pj} (mitjanes); cal scrape per partit.`;
      }
    }
  }
  return {
    extractedAt: new Date().toISOString().slice(0, 10),
    source: "basquetcatala.cat estadistica/equip (team plantilla tables)",
    teamUrls: TEAM_URLS,
    notes: [
      "When PJ=1, team-page totals equal that one game (honest seed).",
      "Person × team = distinct fantasy id (no cross-team dedupe).",
      "Refresh: node scripts/refresh-fcbq-stats.mjs [--from path | --live]",
    ],
    players,
  };
}

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
if (args.includes("--live")) throw new Error("Use --from snapshot (reCAPTCHA).");
const path = fromIdx >= 0 ? args[fromIdx + 1] : join(root, "src/data/fcbq-rosters.json");
const out = buildFromRosters(JSON.parse(readFileSync(path, "utf8")));
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const withGames = Object.values(out.players).filter((p) => p.games.length > 0);
console.log(`Wrote ${OUT}: ${Object.keys(out.players).length} players, ${withGames.length} with games, ${withGames.reduce((n, p) => n + p.games.length, 0)} game rows`);
