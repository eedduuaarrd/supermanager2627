import type { Player } from "@/lib/types";

/**
 * Plantilla fantasy del sènior masculí del CB Balaguer.
 *
 * Fonts:
 * - Ràdio Balaguer (Nit de l'Esport): plantilla Sisival Sènior Masc. A
 * - CB Cappont (acta 2018): SANCHEZ, SAURI, CASTILLO, FARRE, ORTIZ, CASTELLARNAU,
 *   COLEA, BOLADERES, ESCODA, POU, LESAN
 * - Ràdio Balaguer (setembre 2026): Adrià Ortiz és entrenador (retirat com a jugador)
 *
 * L'FCBQ (basquetcatala.cat) bloqueja l'accés automatitzat amb reCAPTCHA; no s'ha
 * pogut baixar la plantilla oficial 2025/26–2026/27. Els jugadors amb
 * source="placeholder" són inventats per completar el mercat fantasy i estan
 * etiquetats clarament a la UI.
 */
export const ROSTER: Player[] = [
  {
    id: "sanchez",
    name: "Edgar Sánchez",
    number: 4,
    position: "base",
    price: 12_500,
    avgVal: 14,
    source: "documentat",
    note: "Documentat a actes i Nit de l'Esport.",
  },
  {
    id: "castillo",
    name: "Pol Castillo",
    number: 7,
    position: "base",
    price: 11_000,
    avgVal: 12,
    source: "documentat",
  },
  {
    id: "farre",
    name: "Joan Farré",
    number: 10,
    position: "aler",
    price: 13_500,
    avgVal: 15,
    source: "documentat",
  },
  {
    id: "colea",
    name: "Marçal Colea",
    number: 8,
    position: "aler",
    price: 10_500,
    avgVal: 11,
    source: "documentat",
  },
  {
    id: "escoda",
    name: "Marc Escoda",
    number: 11,
    position: "aler",
    price: 12_000,
    avgVal: 13,
    source: "documentat",
  },
  {
    id: "boladeres",
    name: "Joan Boladeres",
    number: 14,
    position: "pivot",
    price: 11_500,
    avgVal: 12,
    source: "documentat",
  },
  {
    id: "lesan",
    name: "Jordi Lesan",
    number: 15,
    position: "pivot",
    price: 9_500,
    avgVal: 10,
    source: "documentat",
  },
  {
    id: "pou",
    name: "Humbert Pou",
    number: 9,
    position: "pivot",
    price: 10_000,
    avgVal: 11,
    source: "documentat",
  },
  {
    id: "sauri",
    name: "Albert Sauri",
    number: 5,
    position: "aler",
    price: 8_500,
    avgVal: 9,
    source: "documentat",
  },
  {
    id: "jimenez",
    name: "Txema Jiménez",
    number: 6,
    position: "base",
    price: 8_000,
    avgVal: 8,
    source: "documentat",
  },
  {
    id: "martinez",
    name: "Josep Martínez",
    number: 12,
    position: "pivot",
    price: 7_500,
    avgVal: 8,
    source: "documentat",
  },
  {
    id: "rubies",
    name: "Xavier Rúbies",
    number: 13,
    position: "aler",
    price: 7_000,
    avgVal: 7,
    source: "documentat",
  },
  {
    id: "castellarnau",
    name: "Castellarnau",
    number: 3,
    position: "base",
    price: 6_500,
    avgVal: 7,
    source: "documentat",
    note: "Cognom documentat a l'acta CB Cappont 2018; nom de pila no confirmat.",
  },
  {
    id: "placeholder-riera",
    name: "Nil Riera",
    number: 21,
    position: "aler",
    price: 6_000,
    avgVal: 8,
    source: "placeholder",
    note: "Placeholder — no confirmat a fonts públiques.",
  },
  {
    id: "placeholder-valls",
    name: "Gerard Valls",
    number: 22,
    position: "pivot",
    price: 5_500,
    avgVal: 7,
    source: "placeholder",
    note: "Placeholder — no confirmat a fonts públiques.",
  },
  {
    id: "placeholder-soler",
    name: "Pau Soler",
    number: 23,
    position: "base",
    price: 5_000,
    avgVal: 6,
    source: "placeholder",
    note: "Placeholder — no confirmat a fonts públiques.",
  },
];

export const POSITION_LABEL: Record<Player["position"], string> = {
  base: "Base",
  aler: "Aler",
  pivot: "Pivot",
};

export const LINEUP_SLOTS = {
  base: 2,
  aler: 3,
  pivot: 3,
} as const;

export const LINEUP_SIZE = 8;
export const INITIAL_BUDGET = 90_000;
export const CAPTAIN_MULTIPLIER = 2;
export const WIN_BONUS = 0.2;

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
