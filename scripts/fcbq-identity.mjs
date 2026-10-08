/**
 * Fantasy ids for Balaguer: person × team (no cross-team dedupe).
 * Shared by the plantilla merge and the per-game box-score ingest.
 */

export const TEAM_MAP = {
  "5f55017e-893e-4323-8b41-b58323ea8f73": { teamId: "masc-a", slug: "teixido-a" },
  "c057eeae-3aae-4e33-b2ab-54fabb2700ae": { teamId: "masc-b", slug: "sifonet-b" },
  "839e2243-48dc-4459-aec5-a2dadeb3ad53": { teamId: "fem-a", slug: "cudos-a" },
  "a5c75f3f-ca35-4553-9eb6-a29780eb2007": { teamId: "fem-b", slug: "farratges-b" },
};

export const BASE_IDS = {
  "HECTOR LOZANO MARTINEZ": "hector-lozano",
  "EDUARD BERNAT SUCARRAT": "eduard-bernat",
  "TONI SALUD GARCIA": "toni-salud",
  "IVAN FRANCO GUERRERO": "ivan-franco",
  "GERARD GARCIA ROSAURO": "gerard-garcia",
  "MARC ESCODA ANGERRI": "marc-escoda",
  "BABACAR TOURE GASSAMA": "babacar-toure",
  "GERARD SOLDEVILA CASAS": "gerard-soldevila",
  "ROGER COMPANYS SOLA": "roger-companys",
  "XAVIER BLANCH SIRERA": "xavier-blanch",
  // Teixidó A — names as msstats returns them (accents stripped by normName):
  // JOAN BOLADERES NOGUEROLA, DAVID OLTRA CARRANZA, MIQUEL RÚBIES PACH,
  // SANTI SANSALONI QUELIZ. Rúbies/Sansaloni also play for Lo Sifonet B, so
  // they are dual-team ids (see DUAL_BASES), like Júlia Pla.
  "JOAN BOLADERES NOGUEROLA": "joan-boladeres",
  "DAVID OLTRA CARRANZA": "david-oltra",
  "MIQUEL RUBIES PACH": "miquel-rubies",
  "SANTI SANSALONI QUELIZ": "santi-sansaloni",
  // Lo Sifonet B — JORDI GENSANA PEDRA, JOAN BARRI CASTELL,
  // ORIOL BRINGUÉ QUILES, ISAAC OSEI, FRANCISCO ROMERO GOMEZ.
  // "D.F." stays unmapped: msstats restricts that personal log (HTTP 405).
  "JORDI GENSANA PEDRA": "jordi-gensana",
  "JOAN BARRI CASTELL": "joan-barri",
  "ORIOL BRINGUE QUILES": "oriol-bringue",
  "ISAAC OSEI": "isaac-osei",
  "FRANCISCO ROMERO GOMEZ": "francisco-romero",
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

const DUAL_BASES = new Set([
  "julia-pla",
  "queralt-sole",
  "mariama-mballo",
  // Teixidó A + Lo Sifonet B (since J3): miquel-rubies__teixido-a / __sifonet-b
  "miquel-rubies",
  "santi-sansaloni",
]);

/**
 * Plain ids that became dual-team after data already existed under them.
 * Mirrors LEGACY_PLAYER_ID_MAP in src/data/roster.ts for the data files
 * (player-stats.json / market-prices.json): see scripts/migrate-dual-ids.mjs.
 */
export const RENAMED_IDS = {
  "miquel-rubies": "miquel-rubies__teixido-a",
  "santi-sansaloni": "santi-sansaloni__teixido-a",
};

export function normName(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fantasyId(base, teamSlug) {
  return DUAL_BASES.has(base) ? `${base}__${teamSlug}` : base;
}

/** Map an FCBQ plantilla/box-score name onto the fantasy id for that club side. */
export function fantasyIdFor(name, fcbqTeamId) {
  const meta = TEAM_MAP[fcbqTeamId];
  if (!meta) return null;
  const base = BASE_IDS[normName(name)];
  if (!base) return null;
  return { playerId: fantasyId(base, meta.slug), ...meta };
}

/**
 * Fantasy roster (src/data/roster.ts) → Map<playerId, teamIds[]>.
 * Only player entries carry `teamIds`; club-team objects are skipped.
 * Plain text parse so .mjs scripts don't need a TS loader.
 */
export function parseRosterTeams(src) {
  const roster = new Map();
  const re = /^\s+id: "([^"]+)",$/gm;
  const starts = [];
  let m;
  while ((m = re.exec(src))) starts.push({ id: m[1], at: m.index });
  for (let i = 0; i < starts.length; i++) {
    const block = src.slice(starts[i].at, starts[i + 1]?.at ?? src.length);
    const tm = /teamIds:\s*\[([^\]]*)\]/.exec(block);
    if (!tm) continue;
    const teamIds = [...tm[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    if (teamIds.length) roster.set(starts[i].id, teamIds);
  }
  return roster;
}
