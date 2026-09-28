import type { Player, TeamId } from "@/lib/types";
import { computeMarketPrice } from "@/lib/market-price";
import marketPricesJson from "@/data/market-prices.json";

/**
 * Mercat fantasy — sèniors CB Balaguer (FCBQ temporada 2026-27).
 *
 * Fonts (basquetcatala.cat Plantilla live 2026-09-28, Chrome CDP + reCAPTCHA):
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
 * Noms = title-case de la Plantilla FCBQ (accents només si surten a Fede).
 * Dorsal = número de samarreta a la Plantilla (badge / columna).
 * VAL fantasy = PTS − FC − max(0, TLI−TLC) + PM (FCBQ Plantilla VAL ignora).
 * Sense posicions: alineació de 8 lliures.
 * Preus broker: theoretical = max(0, avgVal) × 1.000 €; actualització ±15%/jornada
 *   (rodona a 500 €). Compra/venda al preu de mercat actual. Veure market-prices.json.
 *   budget column = efectiu (cash); buy/sell al preu actual.
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

/** Fantasy avg seed = Balaguer VAL (PTS − PF − missed FT + PM). */
function avgFromVal(val: number): number {
  return Math.round(val);
}

/** Seed / fallback quote from avg VAL (no previous clamp). */
function priceFromAvg(avgVal: number): number {
  return computeMarketPrice(avgVal, null);
}

export const ROSTER_SEED: Player[] = [
  // —— Teixidó Associats CB Balaguer A (masculí) ——
  {
    id: "hector-lozano",
    name: "Hector Lozano Martinez",
    number: 19,
    pts: 15,
    avgVal: avgFromVal(9),
    price: priceFromAvg(avgFromVal(9)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/hector-lozano.jpg",
  },
  {
    id: "eduard-bernat",
    name: "Eduard Bernat Sucarrat",
    number: 20,
    pts: 10,
    avgVal: avgFromVal(-1),
    price: priceFromAvg(avgFromVal(-1)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/eduard-bernat.png",
  },
  {
    id: "toni-salud",
    name: "Toni Salud Garcia",
    number: 43,
    pts: 9,
    avgVal: avgFromVal(8),
    price: priceFromAvg(avgFromVal(8)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/toni-salud.jpg",
  },
  {
    id: "ivan-franco",
    name: "Ivan Franco Guerrero",
    number: 6,
    pts: 9,
    avgVal: avgFromVal(-8),
    price: priceFromAvg(avgFromVal(-8)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/ivan-franco.png",
  },
  {
    id: "gerard-garcia",
    name: "Gerard Garcia Rosauro",
    number: 0,
    pts: 8,
    avgVal: avgFromVal(1),
    price: priceFromAvg(avgFromVal(1)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/gerard-garcia.jpg",
  },
  {
    id: "marc-escoda",
    name: "Marc Escoda Angerri",
    number: 24,
    pts: 6,
    avgVal: avgFromVal(7),
    price: priceFromAvg(avgFromVal(7)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/marc-escoda.jpg",
  },
  {
    id: "babacar-toure",
    name: "Babacar Toure Gassama",
    number: 68,
    pts: 6,
    avgVal: avgFromVal(-12),
    price: priceFromAvg(avgFromVal(-12)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/babacar-toure.jpg",
  },
  {
    id: "gerard-soldevila",
    name: "Gerard Soldevila Casas",
    number: 26,
    pts: 0,
    avgVal: avgFromVal(-5),
    price: priceFromAvg(avgFromVal(-5)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/gerard-soldevila.jpg",
  },
  {
    id: "roger-companys",
    name: "Roger Companys Solà",
    number: 8,
    pts: 0,
    avgVal: avgFromVal(-5),
    price: priceFromAvg(avgFromVal(-5)),
    prevPrice: null,
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "/players/roger-companys.jpg",
  },
  // —— Cudos Consultors CB Balaguer A (femení) ——
  {
    id: "ares-bunol",
    name: "Ares Buñol Perelló",
    number: 11,
    pts: 15,
    avgVal: avgFromVal(34),
    price: priceFromAvg(avgFromVal(34)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/ares-bunol.jpg",
  },
  {
    id: "julia-pla__cudos-a",
    name: "Júlia Pla Pla",
    number: 13,
    pts: 13,
    avgVal: avgFromVal(27),
    price: priceFromAvg(avgFromVal(27)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/julia-pla.jpg",
    note: "També al mercat com a julia-pla__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "andrea-perat",
    name: "Andrea Perat Gracia",
    number: 21,
    pts: 8,
    avgVal: avgFromVal(22),
    price: priceFromAvg(avgFromVal(22)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/andrea-perat.jpg",
  },
  {
    id: "neus-escoda",
    name: "Neus Escoda Angerri",
    number: 88,
    pts: 8,
    avgVal: avgFromVal(20),
    price: priceFromAvg(avgFromVal(20)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/neus-escoda.jpg",
  },
  {
    id: "monica-fontanet",
    name: "Monica Fontanet Mallol",
    number: 95,
    pts: 6,
    avgVal: avgFromVal(17),
    price: priceFromAvg(avgFromVal(17)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/monica-fontanet.jpg",
  },
  {
    id: "queralt-sole__cudos-a",
    name: "Queralt Sole Torres",
    number: 23,
    pts: 5,
    avgVal: avgFromVal(-11),
    price: priceFromAvg(avgFromVal(-11)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/queralt-sole.jpg",
    note: "També al mercat com a queralt-sole__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "clara-paniagua",
    name: "Clara Paniagua Marvà",
    number: 10,
    pts: 2,
    avgVal: avgFromVal(-5),
    price: priceFromAvg(avgFromVal(-5)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/clara-paniagua.png",
  },
  {
    id: "mariama-mballo__cudos-a",
    name: "Mariama Mballo Diallo",
    number: 27,
    pts: 1,
    avgVal: avgFromVal(-12),
    price: priceFromAvg(avgFromVal(-12)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/mariama-mballo.jpg",
    note: "També al mercat com a mariama-mballo__farratges-b (Farratges La Noguera CB Balaguer B).",
  },
  {
    id: "martina-benitez",
    name: "Martina Benítez Farrando",
    number: 79,
    pts: 1,
    avgVal: avgFromVal(-16),
    price: priceFromAvg(avgFromVal(-16)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/martina-benitez.jpg",
  },
  {
    id: "ada-domene",
    name: "Ada Domene Moraleda",
    number: 24,
    pts: 0,
    avgVal: avgFromVal(-17),
    price: priceFromAvg(avgFromVal(-17)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "/players/ada-domene.jpg",
  },
  // —— Farratges La Noguera CB Balaguer B (femení) ——
  {
    id: "queralt-sole__farratges-b",
    name: "Queralt Sole Torres",
    number: 23,
    pts: 29,
    avgVal: avgFromVal(20),
    price: priceFromAvg(avgFromVal(20)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/queralt-sole.jpg",
    note: "També al mercat com a queralt-sole__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "julia-pla__farratges-b",
    name: "Júlia Pla Pla",
    number: 13,
    pts: 15,
    avgVal: avgFromVal(16),
    price: priceFromAvg(avgFromVal(16)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/julia-pla.jpg",
    note: "També al mercat com a julia-pla__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "jana-roldan",
    name: "Jana Roldan Arandilla",
    number: 8,
    pts: 5,
    avgVal: avgFromVal(4),
    price: priceFromAvg(avgFromVal(4)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/jana-roldan.jpg",
  },
  {
    id: "nuria-jimenez",
    name: "Núria Jiménez Aran",
    number: 30,
    pts: 2,
    avgVal: avgFromVal(1),
    price: priceFromAvg(avgFromVal(1)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/nuria-jimenez.jpg",
  },
  {
    id: "mariama-mballo__farratges-b",
    name: "Mariama Mballo Diallo",
    number: 27,
    pts: 2,
    avgVal: avgFromVal(10),
    price: priceFromAvg(avgFromVal(10)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/mariama-mballo.jpg",
    note: "També al mercat com a mariama-mballo__cudos-a (Cudos Consultors CB Balaguer A).",
  },
  {
    id: "abril-gracia",
    name: "Abril Gràcia Palacín",
    number: 33,
    pts: 2,
    avgVal: avgFromVal(-2),
    price: priceFromAvg(avgFromVal(-2)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/abril-gracia.jpg",
  },
  {
    id: "xenia-andreu",
    name: "Xenia Andreu Monell",
    number: 93,
    pts: 1,
    avgVal: avgFromVal(-10),
    price: priceFromAvg(avgFromVal(-10)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/xenia-andreu.jpg",
  },
  {
    id: "gina-betbese",
    name: "Gina Betbesé Sánchez",
    number: 11,
    pts: 0,
    avgVal: avgFromVal(-7),
    price: priceFromAvg(avgFromVal(-7)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/gina-betbese.jpg",
  },
  {
    id: "gina-trilla",
    name: "Gina Trilla Piniés",
    number: 25,
    pts: 0,
    avgVal: avgFromVal(7),
    price: priceFromAvg(avgFromVal(7)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/gina-trilla.jpg",
  },
  {
    id: "jana-alarcon",
    name: "Jana Alarcon Solanes",
    number: 24,
    pts: 0,
    avgVal: avgFromVal(-3),
    price: priceFromAvg(avgFromVal(-3)),
    prevPrice: null,
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "/players/jana-alarcon.jpg",
  },
];

type MarketPricesFile = {
  prices?: Record<
    string,
    { price: number; prevPrice?: number | null; avgVal?: number | null }
  >;
};

/** Apply broker quotes from market-prices.json onto seed roster rows. */
function applyMarketPrices(seed: Player[]): Player[] {
  const file = marketPricesJson as MarketPricesFile;
  const map = file.prices ?? {};
  return seed.map((p) => {
    const mp = map[p.id];
    if (!mp) return p;
    return {
      ...p,
      price: mp.price,
      prevPrice: mp.prevPrice ?? null,
      ...(typeof mp.avgVal === "number" ? { avgVal: Math.round(mp.avgVal) } : {}),
    };
  });
}

export const ROSTER: Player[] = applyMarketPrices(ROSTER_SEED);

export const LINEUP_SIZE = 8;
/** Pressupost amb mercat multi-equip. */
export const INITIAL_BUDGET = 100_000;
export const CAPTAIN_MULTIPLIER = 2;
export const WIN_BONUS = 0.2;

/** GameState.version — bump when roster ids / dual-team / pricing rule change. */
export const GAME_VERSION = 10;

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
 * Also maps spelling fixes (Gueralt→Queralt, Mariana→Mariama, Doriene→Domene).
 */
export const LEGACY_PLAYER_ID_MAP: Record<string, string> = {
  "julia-pla": "julia-pla__cudos-a",
  "gueralt-sole": "queralt-sole__farratges-b",
  "gueralt-sole__cudos-a": "queralt-sole__cudos-a",
  "gueralt-sole__farratges-b": "queralt-sole__farratges-b",
  "queralt-sole": "queralt-sole__farratges-b",
  "mariana-mballo": "mariama-mballo__farratges-b",
  "mariana-mballo__cudos-a": "mariama-mballo__cudos-a",
  "mariana-mballo__farratges-b": "mariama-mballo__farratges-b",
  "mariama-mballo": "mariama-mballo__farratges-b",
  "ada-dorienie": "ada-domene",
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
