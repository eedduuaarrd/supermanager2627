#!/usr/bin/env node
/**
 * Refresh src/data/player-stats.json from FCBQ team plantillas.
 * Balaguer rule: person × team = distinct fantasy id (no cross-team dedupe).
 *
 * Merges into existing history — never invents future games.
 * New PJ=1 samples get round/jornada = null until weekly-jornada assigns them.
 * Existing games keep their round/jornada and box scores.
 *
 * Usage: node scripts/refresh-fcbq-stats.mjs [--from path]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVal } from "./compute-val.mjs";

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

function fingerprint(g) {
  return [g.teamId, g.pts, g.min, g.pm, g.pf, g.t2c, g.t3c, g.tlc, g.tli].join("|");
}

function loadExisting() {
  if (!existsSync(OUT)) return { players: {} };
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { players: {} };
  }
}

function buildFromRosters(rosters, existing) {
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
      const prev = existing.players?.[pid];
      const entry = (players[pid] ??= {
        playerId: pid,
        fcbqName: p.name,
        fcbqPersonId: prev?.fcbqPersonId ?? null,
        teamId,
        games: Array.isArray(prev?.games) ? [...prev.games] : [],
        source: "fcbq-team-page-aggregate",
      });
      entry.number = p.number ?? entry.number ?? null;

      if (pj === 1) {
        const pts = stats.PTS ?? null;
        const pf = stats.FC ?? null; // FCBQ personal fouls
        const tlc = stats.TLC ?? null;
        const tli = stats.TLI ?? null;
        const pm = stats.PM ?? null;
        const fantasyVal = computeVal({
          pts,
          pf,
          ftm: tlc,
          fta: tli,
          pm,
        });
        const candidate = {
          date: null,
          round: null,
          jornada: null,
          opponent: null,
          teamId,
          fcbqTeamId: t.id,
          competition: t.competition ?? null,
          min: stats.MIN ?? null,
          pts,
          t2c: stats.T2C ?? null,
          t2i: stats.T2I ?? null,
          t3c: stats.T3C ?? null,
          t3i: stats.T3I ?? null,
          tlc,
          tli,
          pf,
          // Stored fantasy VAL (Balaguer formula), not FCBQ Plantilla VAL column.
          val: fantasyVal,
          pm,
          note:
            "Mostreig FCBQ (PJ=1). VAL fantasy = PTS − FC − (TLI−TLC) + PM.",
        };
        const sameTeam = entry.games.filter((g) => g.teamId === teamId);
        const fp = fingerprint(candidate);
        const match =
          entry.games.find((g) => fingerprint(g) === fp) ||
          // Plantilla PJ=1 is a single aggregate row — update in place.
          (sameTeam.length === 1 ? sameTeam[0] : null);

        if (match) {
          // Preserve round/jornada/date/opponent; refresh box score fields only.
          match.min = candidate.min;
          match.pts = candidate.pts;
          match.t2c = candidate.t2c;
          match.t2i = candidate.t2i;
          match.t3c = candidate.t3c;
          match.t3i = candidate.t3i;
          match.tlc = candidate.tlc;
          match.tli = candidate.tli;
          match.pf = candidate.pf;
          match.val = candidate.val;
          match.pm = candidate.pm;
          match.note = candidate.note;
          match.competition = candidate.competition;
          match.fcbqTeamId = candidate.fcbqTeamId;
          if (match.round == null && match.jornada != null) {
            match.round = match.jornada;
          }
          if (match.jornada == null && match.round != null) {
            match.jornada = match.round;
          }
        } else {
          // Truly new box score — leave round null for weekly-jornada to assign.
          entry.games.push(candidate);
        }
      } else if (pj > 1) {
        entry.seasonNote = `FCBQ mostra PJ=${pj} (mitjanes); cal scrape per partit per afegir jornades.`;
      } else if (pj === 0 && entry.games.length === 0) {
        // No invent — leave empty history.
      }
    }
  }

  // Preserve players that disappeared from a snapshot (history stays).
  for (const [pid, prev] of Object.entries(existing.players ?? {})) {
    if (!players[pid]) {
      players[pid] = prev;
    }
  }

  return {
    extractedAt: new Date().toISOString().slice(0, 10),
    source: "basquetcatala.cat estadistica/equip (team plantilla tables)",
    teamUrls: TEAM_URLS,
    notes: [
      "When PJ=1, team-page totals equal that one game (honest seed).",
      "Person × team = distinct fantasy id (no cross-team dedupe).",
      "Each game.round/jornada maps to fantasy jornada when assigned.",
      "Do not invent future games; append only when FCBQ publishes new stats.",
      "Fantasy VAL = PTS − FC (pf) − max(0, TLI−TLC) + PM; FCBQ Plantilla VAL ignored.",
      "Refresh: node scripts/refresh-fcbq-stats.mjs [--from path]",
      "Weekly ops: node scripts/weekly-jornada.mjs",
    ],
    players,
  };
}

const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
if (args.includes("--live")) throw new Error("Use --from snapshot (reCAPTCHA).");
const path = fromIdx >= 0 ? args[fromIdx + 1] : join(root, "src/data/fcbq-rosters.json");
const existing = loadExisting();
const out = buildFromRosters(JSON.parse(readFileSync(path, "utf8")), existing);
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const withGames = Object.values(out.players).filter((p) => p.games.length > 0);
console.log(
  `Wrote ${OUT}: ${Object.keys(out.players).length} players, ${withGames.length} with games, ${withGames.reduce((n, p) => n + p.games.length, 0)} game rows`,
);

if (!process.env.SKIP_MARKET_PRICES) {
  console.log("→ update-market-prices.mjs");
  const priceRun = spawnSync(
    process.execPath,
    [join(root, "scripts/update-market-prices.mjs")],
    { stdio: "inherit", cwd: root },
  );
  if (priceRun.status !== 0) process.exit(priceRun.status ?? 1);
} else {
  console.log("→ skip market prices (SKIP_MARKET_PRICES)");
}
