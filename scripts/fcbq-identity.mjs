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
