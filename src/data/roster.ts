import type { Player, TeamId } from "@/lib/types";

/**
 * Mercat fantasy — sèniors CB Balaguer (FCBQ temporada 2026-27).
 *
 * Fonts (basquetcatala.cat, extracció 2026-09-28):
 * - TEIXIDÓ ASSOCIATS CONSELLERS, SLU CB BALAGUER A
 *   https://www.basquetcatala.cat/estadistica/equip/5f55017e-893e-4323-8b41-b58323ea8f73
 * - LO SIFONET CB BALAGUER B (sense estadístiques encara)
 *   https://www.basquetcatala.cat/estadistica/equip/c057eeae-3aae-4e33-b2ab-54fabb2700ae
 * - CUDOS CONSULTORS CB BALAGUER A
 *   https://www.basquetcatala.cat/estadistica/equip/839e2243-48dc-4459-aec5-a2dadeb3ad53
 * - FARRATGES LA NOGUERA CB BALAGUER B
 *   https://www.basquetcatala.cat/estadistica/equip/a5c75f3f-ca35-4553-9eb6-a29780eb2007
 *
 * Regla Balaguer: persona × equip = jugador fantasy distint (no es deduplica).
 * Ids: `slug` per un sol equip; `slug__equip` quan la mateixa persona juga a dos.
 * L'FCBQ no publica número de samarreta. Sense posicions: alineació de 8 lliures.
 * Preus derivats de PTS + VAL + MIN de la mostra FCBQ (1 partit a la captura).
 *
 * Regles: plantilla 8, pressupost 100.000 € (mercat multi-equip, 29 entrades).
 */

export interface TeamInfo {
  id: TeamId;
  label: string;
  fullName: string;
  competition: string;
  fcbqId: string;
  /** Empty when FCBQ shows no roster/stats yet. */
  rosterAvailable: boolean;
}

export const TEAMS: Record<TeamId, TeamInfo> = {
  "masc-a": {
    id: "masc-a",
    label: "Teixidó A",
    fullName: "TEIXIDÓ ASSOCIATS CONSELLERS, SLU CB BALAGUER A",
    competition: "1A Territorial Senior Masculí",
    fcbqId: "5f55017e-893e-4323-8b41-b58323ea8f73",
    rosterAvailable: true,
  },
  "masc-b": {
    id: "masc-b",
    label: "Lo Sifonet B",
    fullName: "LO SIFONET CB BALAGUER B",
    competition: "2A Territorial Senior Masculí",
    fcbqId: "c057eeae-3aae-4e33-b2ab-54fabb2700ae",
    rosterAvailable: false,
  },
  "fem-a": {
    id: "fem-a",
    label: "Cudos A",
    fullName: "CUDOS CONSULTORS CB BALAGUER A",
    competition: "Copa Catalunya Femenina",
    fcbqId: "839e2243-48dc-4459-aec5-a2dadeb3ad53",
    rosterAvailable: true,
  },
  "fem-b": {
    id: "fem-b",
    label: "Farratges B",
    fullName: "FARRATGES LA NOGUERA CB BALAGUER B",
    competition: "C.C. Segona Categoria Femenina",
    fcbqId: "a5c75f3f-ca35-4553-9eb6-a29780eb2007",
    rosterAvailable: true,
  },
};

export const TEAM_ORDER: TeamId[] = ["masc-a", "masc-b", "fem-a", "fem-b"];

/** Human slug used in fantasy ids (`julia-pla__cudos-a`). */
export const TEAM_ID_SLUG: Record<TeamId, string> = {
  "masc-a": "teixido-a",
  "masc-b": "sifonet-b",
  "fem-a": "cudos-a",
  "fem-b": "farratges-b",
};

function priceFrom(pts: number, val: number, min: number): number {
  const raw = 5_000 + pts * 700 + Math.max(val, 0) * 450 + min * 120;
  return Math.min(16_500, Math.max(4_500, Math.round(raw / 500) * 500));
}

function avgFrom(val: number, pts: number): number {
  if (val > 0) return Math.round(val);
  return Math.max(1, Math.round(pts * 0.7));
}

export const ROSTER: Player[] = [
  // —— Teixidó Associats CB Balaguer A (masculí) ——
  {
    id: "hector-lozano",
    name: "Hèctor Lozano Martínez",
    number: null,
    pts: 16,
    avgVal: avgFrom(-3, 16),
    price: priceFrom(16, -3, 23.5),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/hector-lozano.jpg",
  },
  {
    id: "eduard-bernat",
    name: "Eduard Bernat Sucarrat",
    number: null,
    pts: 10,
    avgVal: avgFrom(-6, 10),
    price: priceFrom(10, -6, 27.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/eduard-bernat.png",
  },
  {
    id: "gerard-garcia",
    name: "Gerard Garcia Rosauro",
    number: null,
    pts: 8,
    avgVal: avgFrom(-3, 8),
    price: priceFrom(8, -3, 26.4),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/gerard-garcia.jpg",
  },
  {
    id: "ivan-franco",
    name: "Ivan Franco Guerrero",
    number: null,
    pts: 8,
    avgVal: avgFrom(-15, 8),
    price: priceFrom(8, -15, 27.5),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/ivan-franco.png",
  },
  {
    id: "toni-salud",
    name: "Toni Salud Garcia",
    number: null,
    pts: 8,
    avgVal: avgFrom(4, 8),
    price: priceFrom(8, 4, 24.2),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/toni-salud.jpg",
  },
  {
    id: "babacar-toure",
    name: "Babacar Touré Gassama",
    number: null,
    pts: 6,
    avgVal: avgFrom(-15, 6),
    price: priceFrom(6, -15, 23.0),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/babacar-toure.jpg",
  },
  {
    id: "marc-escoda",
    name: "Marc Escoda Angerri",
    number: null,
    pts: 6,
    avgVal: avgFrom(4, 6),
    price: priceFrom(6, 4, 18.0),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/marc-escoda.jpg",
  },
  {
    id: "gerard-soldevila",
    name: "Gerard Soldevila Casas",
    number: null,
    pts: 0,
    avgVal: avgFrom(-2, 0),
    price: priceFrom(0, -2, 16.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/gerard-soldevila.jpg",
  },
  {
    id: "roger-companys",
    name: "Roger Companys Solà",
    number: null,
    pts: 0,
    avgVal: avgFrom(1, 0),
    price: priceFrom(0, 1, 14.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/roger-companys.jpg",
  },
  // —— Cudos Consultors CB Balaguer A (femení) ——
  {
    id: "ares-bunol",
    name: "Ares Buñol Perelló",
    number: null,
    pts: 16,
    avgVal: avgFrom(24, 16),
    price: priceFrom(16, 24, 26.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/ares-bunol.jpg",
  },
  {
    id: "julia-pla__cudos-a",
    name: "Júlia Pla Pla",
    number: null,
    pts: 13,
    avgVal: avgFrom(18, 13),
    price: priceFrom(13, 18, 29.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/julia-pla.jpg",
    note: "També al mercat com a julia-pla__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "andrea-perat",
    name: "Andrea Perat Gràcia",
    number: null,
    pts: 8,
    avgVal: avgFrom(18, 8),
    price: priceFrom(8, 18, 27.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/andrea-perat.jpg",
  },
  {
    id: "neus-escoda",
    name: "Neus Escoda Angerri",
    number: null,
    pts: 8,
    avgVal: avgFrom(15, 8),
    price: priceFrom(8, 15, 26.8),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/neus-escoda.jpg",
  },
  {
    id: "monica-fontanet",
    name: "Mònica Fontanet Mallol",
    number: null,
    pts: 6,
    avgVal: avgFrom(13, 6),
    price: priceFrom(6, 13, 19.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/monica-fontanet.jpg",
  },
  {
    id: "gueralt-sole__cudos-a",
    name: "Gueralt Solé Torres",
    number: null,
    pts: 5,
    avgVal: avgFrom(-13, 5),
    price: priceFrom(5, -13, 10.8),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/gueralt-sole.jpg",
    note: "També al mercat com a gueralt-sole__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "clara-paniagua",
    name: "Clara Paniagua Marvà",
    number: null,
    pts: 2,
    avgVal: avgFrom(-2, 2),
    price: priceFrom(2, -2, 16.3),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/clara-paniagua.png",
  },
  {
    id: "mariana-mballo__cudos-a",
    name: "Mariana Mballo Diallo",
    number: null,
    pts: 1,
    avgVal: avgFrom(-12, 1),
    price: priceFrom(1, -12, 10.6),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/mariana-mballo.jpg",
    note: "També al mercat com a mariana-mballo__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "martina-benitez",
    name: "Martina Benítez Farrando",
    number: null,
    pts: 1,
    avgVal: avgFrom(-15, 1),
    price: priceFrom(1, -15, 15.7),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/martina-benitez.jpg",
  },
  {
    id: "ada-dorienie",
    name: "Ada Doriene Moraleda",
    number: null,
    pts: 0,
    avgVal: avgFrom(-17, 0),
    price: priceFrom(0, -17, 13.0),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/ada-dorienie.jpg",
  },
  // —— Farratges La Noguera CB Balaguer B (femení) ——
  {
    id: "gueralt-sole__farratges-b",
    name: "Gueralt Solé Torres",
    number: null,
    pts: 23,
    avgVal: avgFrom(-1, 23),
    price: priceFrom(23, -1, 37.5),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/gueralt-sole.jpg",
    note: "També al mercat com a gueralt-sole__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "julia-pla__farratges-b",
    name: "Júlia Pla Pla",
    number: null,
    pts: 15,
    avgVal: avgFrom(7, 15),
    price: priceFrom(15, 7, 24.4),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/julia-pla.jpg",
    note: "També al mercat com a julia-pla__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "jana-roldan",
    name: "Jana Roldán Arandilla",
    number: null,
    pts: 5,
    avgVal: avgFrom(0, 5),
    price: priceFrom(5, 0, 19.3),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/jana-roldan.jpg",
  },
  {
    id: "abril-gracia",
    name: "Abril Gràcia Palacín",
    number: null,
    pts: 2,
    avgVal: avgFrom(-3, 2),
    price: priceFrom(2, -3, 8.6),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/abril-gracia.jpg",
  },
  {
    id: "mariana-mballo__farratges-b",
    name: "Mariana Mballo Diallo",
    number: null,
    pts: 2,
    avgVal: avgFrom(12, 2),
    price: priceFrom(2, 12, 23.7),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/mariana-mballo.jpg",
    note: "També al mercat com a mariana-mballo__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "nuria-jimenez",
    name: "Núria Jiménez Aran",
    number: null,
    pts: 2,
    avgVal: avgFrom(1, 2),
    price: priceFrom(2, 1, 23.0),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/nuria-jimenez.jpg",
  },
  {
    id: "xenia-andreu",
    name: "Xènia Andreu Monell",
    number: null,
    pts: 1,
    avgVal: avgFrom(-8, 1),
    price: priceFrom(1, -8, 11.1),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/xenia-andreu.jpg",
  },
  {
    id: "gina-betbese",
    name: "Gina Betbesé Sànchez",
    number: null,
    pts: 0,
    avgVal: avgFrom(-6, 0),
    price: priceFrom(0, -6, 2.7),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/gina-betbese.jpg",
  },
  {
    id: "gina-trilla",
    name: "Gina Trilla Piniès",
    number: null,
    pts: 0,
    avgVal: avgFrom(11, 0),
    price: priceFrom(0, 11, 33.5),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/gina-trilla.jpg",
  },
  {
    id: "jana-alarcon",
    name: "Jana Alarcón Solanés",
    number: null,
    pts: 0,
    avgVal: avgFrom(-2, 0),
    price: priceFrom(0, -2, 4.2),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/jana-alarcon.jpg",
  },
];

export const LINEUP_SIZE = 8;
/** Pressupost amb mercat multi-equip. */
export const INITIAL_BUDGET = 100_000;
export const CAPTAIN_MULTIPLIER = 2;
export const WIN_BONUS = 0.2;

/** GameState.version — bump when roster ids / dual-team rule change. */
export const GAME_VERSION = 5;

export const OPPONENTS = [
  "CB Cervera",
  "CB Fraga",
  "Casal Vilafranca",
  "CB Torrefarrera",
  "Peña Fragatina",
  "BAC Agramunt",
  "CB Mollerussa",
  "Sícoris Lleida",
];

/**
 * Map collapsed / legacy fantasy ids → current primary-team variant.
 * Dual-roster people previously shared one id; now person×team.
 */
export const LEGACY_PLAYER_ID_MAP: Record<string, string> = {
  "julia-pla": "julia-pla__cudos-a",
  "gueralt-sole": "gueralt-sole__farratges-b",
  "mariana-mballo": "mariana-mballo__farratges-b",
};

export function resolvePlayerId(id: string): string | null {
  const mapped = LEGACY_PLAYER_ID_MAP[id] ?? id;
  return ROSTER.some((p) => p.id === mapped) ? mapped : null;
}

export function getPlayer(id: string): Player | undefined {
  const resolved = resolvePlayerId(id);
  if (!resolved) return undefined;
  return ROSTER.find((p) => p.id === resolved);
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function teamLabel(teamId: TeamId): string {
  return TEAMS[teamId].label;
}

/** Title-case a single token; preserves accents via ca locale. */
function titleCaseToken(token: string): string {
  const lower = token.toLocaleLowerCase("ca");
  if (!lower) return token;
  return lower.charAt(0).toLocaleUpperCase("ca") + lower.slice(1);
}

/**
 * Given name (nom) for compact court labels.
 * FCBQ / Catalan is usually "Nom Cognoms…"; also handles "Cognom, Nom".
 * Does not invent accents — keeps roster casing when already mixed-case.
 */
export function displayFirstName(fullName: string): string {
  const raw = fullName.trim();
  if (!raw) return "?";

  let given: string | undefined;
  if (raw.includes(",")) {
    const afterComma = raw.slice(raw.indexOf(",") + 1).trim();
    given = afterComma.split(/\s+/).filter(Boolean)[0];
    if (!given) {
      given = raw.split(",")[0]?.trim().split(/\s+/).filter(Boolean)[0];
    }
  } else {
    given = raw.split(/\s+/).filter(Boolean)[0];
  }

  if (!given) return "?";

  const allCaps =
    given === given.toLocaleUpperCase("ca") &&
    given !== given.toLocaleLowerCase("ca");
  const display = allCaps ? titleCaseToken(given) : given;

  return display.length > 9 ? `${display.slice(0, 8)}…` : display;
}

/** Court-chip label alias — first name only. */
export function shortName(fullName: string): string {
  return displayFirstName(fullName);
}
