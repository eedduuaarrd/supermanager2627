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
 * L'FCBQ no publica número de samarreta ni posició a la fitxa d'estadística.
 * Posicions assignades per heurística fantasy (perfil de tir / minuts) per
 * mantenir el mercat jugable amb 2 bases / 3 alers / 3 pivots.
 * Preus derivats de PTS + VAL + MIN de la mostra FCBQ (1 partit a la captura).
 *
 * Regles: es manté plantilla 8 (2/3/3). Pressupost pujat a 100.000 € perquè
 * el mercat cobreix 3 equips amb estadístiques (~26 jugadors únics).
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
    label: "Sifonet B",
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
    position: "aler",
    pts: 16,
    avgVal: avgFrom(-3, 16),
    price: priceFrom(16, -3, 23.5),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_0_54c7a3b9-226b-40ed-bb83-8cb8a5062797.jpeg",
  },
  {
    id: "eduard-bernat",
    name: "Eduard Bernat Sucarrat",
    number: null,
    position: "base",
    pts: 10,
    avgVal: avgFrom(-6, 10),
    price: priceFrom(10, -6, 27.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: null,
  },
  {
    id: "toni-salud",
    name: "Toni Salud Garcia",
    number: null,
    position: "pivot",
    pts: 8,
    avgVal: avgFrom(4, 8),
    price: priceFrom(8, 4, 24.2),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0637491b1-35a9-4ca9-86d7-2323df5404e3.jpg",
  },
  {
    id: "ivan-franco",
    name: "Ivan Franco Guerrero",
    number: null,
    position: "aler",
    pts: 8,
    avgVal: avgFrom(-15, 8),
    price: priceFrom(8, -15, 27.5),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_466700_2d99d5bb-2ed4-4b0e-979f-d2766cb091e2.png",
  },
  {
    id: "gerard-garcia",
    name: "Gerard Garcia Rosauro",
    number: null,
    position: "base",
    pts: 8,
    avgVal: avgFrom(-3, 8),
    price: priceFrom(8, -3, 26.4),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_074b432d0-55fc-45d5-9335-5ea7ce569baa.jpg",
  },
  {
    id: "marc-escoda",
    name: "Marc Escoda Angerri",
    number: null,
    position: "aler",
    pts: 6,
    avgVal: avgFrom(4, 6),
    price: priceFrom(6, 4, 18),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_227692_ec30a116-abce-4144-9f16-6573f8e178c7.jpg",
  },
  {
    id: "babacar-toure",
    name: "Babacar Touré Gassama",
    number: null,
    position: "pivot",
    pts: 6,
    avgVal: avgFrom(-15, 6),
    price: priceFrom(6, -15, 23),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_383137_ad007b3a-1b53-4616-9dad-713002f13d3c.jpg",
  },
  {
    id: "gerard-soldevila",
    name: "Gerard Soldevila Casas",
    number: null,
    position: "base",
    pts: 0,
    avgVal: 2,
    price: priceFrom(0, -2, 16.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_45890_caec6ef8-213e-413c-bf4c-c334a2c5845f.jpg",
  },
  {
    id: "roger-companys",
    name: "Roger Companys Solà",
    number: null,
    position: "pivot",
    pts: 0,
    avgVal: avgFrom(1, 0),
    price: priceFrom(0, 1, 14.1),
    source: "fcbq",
    teamId: "masc-a",
    teamIds: ["masc-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_293807_dd8246e8-6ad4-4f66-b36e-8ea2708a878d.jpg",
  },

  // —— Cudos Consultors CB Balaguer A (femení) ——
  {
    id: "ares-bunol",
    name: "Ares Buñol Perelló",
    number: null,
    position: "aler",
    pts: 16,
    avgVal: avgFrom(24, 16),
    price: priceFrom(16, 24, 26.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_329267_85505692-5d90-43c4-b5c1-03e7cd74437e.jpg",
  },
  {
    id: "julia-pla",
    name: "Júlia Pla Pla",
    number: null,
    position: "aler",
    pts: 15,
    avgVal: avgFrom(18, 15),
    price: priceFrom(15, 18, 29.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a", "fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_012cb9cdd-c129-4346-9ea6-7aee03c4f29a.jpg",
    note: "Apareix també a Farratges B (FCBQ).",
  },
  {
    id: "andrea-perat",
    name: "Andrea Perat Gràcia",
    number: null,
    position: "pivot",
    pts: 8,
    avgVal: avgFrom(18, 8),
    price: priceFrom(8, 18, 27.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0e63a3f12-bfe0-4240-8602-bbec0df1b7de.jpeg",
  },
  {
    id: "neus-escoda",
    name: "Neus Escoda Angerri",
    number: null,
    position: "pivot",
    pts: 8,
    avgVal: avgFrom(15, 8),
    price: priceFrom(8, 15, 26.8),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_09958ef53-48ee-42c1-96be-80493b36c5ec.jpg",
  },
  {
    id: "monica-fontanet",
    name: "Mònica Fontanet Mallol",
    number: null,
    position: "base",
    pts: 6,
    avgVal: avgFrom(13, 6),
    price: priceFrom(6, 13, 19.4),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_361373_44327862-1395-4f87-87d8-03562bc8483b.jpg",
  },
  {
    id: "gueralt-sole",
    name: "Gueralt Solé Torres",
    number: null,
    position: "pivot",
    pts: 23,
    avgVal: avgFrom(12, 23),
    price: priceFrom(23, 12, 37.5),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-a", "fem-b"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_332647_8d29bda3-c7a2-40b2-bf88-6f035e592415.jpg",
    note: "Apareix a Cudos A i Farratges B; preu/VAL agafen el millor mostreig FCBQ.",
  },
  {
    id: "clara-paniagua",
    name: "Clara Paniagua Marvà",
    number: null,
    position: "aler",
    pts: 2,
    avgVal: avgFrom(-2, 2),
    price: priceFrom(2, -2, 16.3),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_269827_b9c8396e-3b72-48d2-911a-4c993eef56d5.png",
  },
  {
    id: "mariana-mballo",
    name: "Mariana Mballo Diallo",
    number: null,
    position: "pivot",
    pts: 2,
    avgVal: avgFrom(12, 2),
    price: priceFrom(2, 12, 23.7),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-a", "fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0eacea48f-fafe-49ed-8a1e-6a419c064096.jpeg",
    note: "Apareix també a Cudos A (FCBQ).",
  },
  {
    id: "martina-benitez",
    name: "Martina Benítez Farrando",
    number: null,
    position: "base",
    pts: 1,
    avgVal: avgFrom(-15, 1),
    price: priceFrom(1, -15, 15.7),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_337373_4d33f03a-b1cd-4ec4-8eed-e21d6d115f70.jpg",
  },
  {
    id: "ada-dorienie",
    name: "Ada Doriene Moraleda",
    number: null,
    position: "pivot",
    pts: 0,
    avgVal: 1,
    price: priceFrom(0, -17, 13),
    source: "fcbq",
    teamId: "fem-a",
    teamIds: ["fem-a"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_374656_6d535a3b-dced-4e68-8646-f08e8cd24978.jpeg",
  },

  // —— Farratges La Noguera CB Balaguer B (només exclusives) ——
  {
    id: "jana-roldan",
    name: "Jana Roldán Arandilla",
    number: null,
    position: "base",
    pts: 5,
    avgVal: avgFrom(0, 5),
    price: priceFrom(5, 0, 19.3),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_352802_c6406ff0-012b-4691-810b-3082a9018d1b.jpg",
  },
  {
    id: "nuria-jimenez",
    name: "Núria Jiménez Aran",
    number: null,
    position: "aler",
    pts: 2,
    avgVal: avgFrom(1, 2),
    price: priceFrom(2, 1, 23),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0bba2ba64-94e1-44f0-bfa5-b441eee44573.jpeg",
  },
  {
    id: "abril-gracia",
    name: "Abril Gràcia Palacín",
    number: null,
    position: "base",
    pts: 2,
    avgVal: avgFrom(-3, 2),
    price: priceFrom(2, -3, 8.6),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_362772_d3e3c61a-da18-4d2b-b21e-dec63b10543d.jpeg",
  },
  {
    id: "xenia-andreu",
    name: "Xènia Andreu Monell",
    number: null,
    position: "aler",
    pts: 1,
    avgVal: avgFrom(-8, 1),
    price: priceFrom(1, -8, 11.1),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://d1wppq8sjja81z.cloudfront.net/basquet/FED_FOTO/Thumbs/PER_0_3a38f87b-57f2-4720-85d9-044331505379.jpg",
  },
  {
    id: "gina-betbese",
    name: "Gina Betbesé Sànchez",
    number: null,
    position: "aler",
    pts: 0,
    avgVal: 1,
    price: priceFrom(0, -6, 2.7),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_01f6a9dc4-8527-4389-a112-0c50d40a6af8.jpeg",
  },
  {
    id: "gina-trilla",
    name: "Gina Trilla Piniès",
    number: null,
    position: "base",
    pts: 0,
    avgVal: avgFrom(11, 0),
    price: priceFrom(0, 11, 33.5),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0d1b4bcd5-3781-4bc2-a1e6-9b1bfd28d6e0.jpg",
  },
  {
    id: "jana-alarcon",
    name: "Jana Alarcón Solanés",
    number: null,
    position: "pivot",
    pts: 0,
    avgVal: 1,
    price: priceFrom(0, -2, 4.2),
    source: "fcbq",
    teamId: "fem-b",
    teamIds: ["fem-b"],
    photoUrl: "https://playofffederacions.s3.eu-west-1.amazonaws.com/basquet/FED_FOTO/Thumbs/PER_0fc175a7e-6f7a-4ae5-ac9d-5acbea3a61ea.jpg",
  },
];

export const POSITION_LABEL: Record<Player["position"], string> = {
  base: "Base",
  aler: "Aler",
  pivot: "Pivot",
};

/** Manté 2/3/3: mercat més gran, mateixa plantilla fantasy jugable. */
export const LINEUP_SLOTS = {
  base: 2,
  aler: 3,
  pivot: 3,
} as const;

export const LINEUP_SIZE = 8;
/** Pujat de 90k → 100k amb mercat multi-equip. */
export const INITIAL_BUDGET = 100_000;
export const CAPTAIN_MULTIPLIER = 2;
export const WIN_BONUS = 0.2;

/** GameState.version — invalida partides amb plantilla antiga. */
export const GAME_VERSION = 3;

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

export function getPlayer(id: string): Player | undefined {
  return ROSTER.find((p) => p.id === id);
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
