#!/usr/bin/env node
/**
 * Fetch / refresh src/data/fixtures.json for the 4 Balaguer club teams.
 *
 * Source preference:
 *   1) --calendar / --from-calendar → FCBQ team calendar HTML (date + Hora tip-off)
 *   2) FCBQ_COOKIE / --cookie / --live → msstats /v1/fcbq/teams/{id}/stats games[]
 *   3) --from-api path → JSON dump keyed by team id or stats URL
 *   4) merge into existing fixtures.json (preserve tipOff / results)
 *
 * Never invents tip-off times. Calendar "Hora" is a real published start (Europe/Madrid).
 * msstats games[] often lacks tipOff and upcoming fixtures — prefer calendar.
 *
 * Usage:
 *   node scripts/fetch-fcbq-fixtures.mjs --from-calendar /tmp/fcbq-calendar-rows.json
 *   FCBQ_COOKIE='fcbq_rc=…' node scripts/fetch-fcbq-fixtures.mjs --calendar
 *   FCBQ_COOKIE='…' node scripts/fetch-fcbq-fixtures.mjs --live
 *   node scripts/fetch-fcbq-fixtures.mjs --from-api /tmp/msstats-dump.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "src/data/fixtures.json");
const CLUB_ID = 402;

export const CLUB_TEAMS = [
  {
    fcbqTeamId: "5f55017e-893e-4323-8b41-b58323ea8f73",
    teamId: "masc-a",
    slug: "teixido-a",
    shortName: "Teixidó A",
    legacyTeamId: 92083,
    homeNames: [
      "TEIXIDÓ ASSOCIATS CONSELLERS, SLU CB BALAGUER A",
      "TEIXIDÓ ASSOCIATS",
    ],
  },
  {
    fcbqTeamId: "c057eeae-3aae-4e33-b2ab-54fabb2700ae",
    teamId: "masc-b",
    slug: "sifonet-b",
    shortName: "Lo Sifonet B",
    legacyTeamId: 94248,
    homeNames: ["LO SIFONET CB BALAGUER B", "LO SIFONET"],
  },
  {
    fcbqTeamId: "839e2243-48dc-4459-aec5-a2dadeb3ad53",
    teamId: "fem-a",
    slug: "cudos-a",
    shortName: "Cudos A",
    legacyTeamId: 91097,
    homeNames: ["CUDOS CONSULTORS CB BALAGUER A", "CUDOS CONSULTORS"],
  },
  {
    fcbqTeamId: "a5c75f3f-ca35-4553-9eb6-a29780eb2007",
    teamId: "fem-b",
    slug: "farratges-b",
    shortName: "Farratges B",
    legacyTeamId: 91098,
    homeNames: [
      "FARRATGES LA NOGUERA CB BALAGUER B",
      "FARRATGES LA NOGUERA",
    ],
  },
];

const MSSTATS = "https://msstats.optimalwayconsulting.com/v1/fcbq/teams";
const CAL_BASE = `https://www.basquetcatala.cat/partits/calendari_equip_global/${CLUB_ID}`;

function loadExisting() {
  if (!existsSync(OUT)) return { teams: [] };
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { teams: [] };
  }
}

function fixtureKey(f) {
  return [
    f.matchCallUuid || "",
    f.date || "",
    f.opponent || "",
    f.home === true ? "H" : f.home === false ? "A" : "?",
  ].join("|");
}

function normalizeGame(g) {
  const tipOff =
    typeof g.tipOff === "string" && g.tipOff.trim()
      ? g.tipOff
      : typeof g.startTime === "string" && g.startTime.trim()
        ? g.startTime
        : null;
  return {
    date: g.date ?? (tipOff ? String(tipOff).slice(0, 10) : null),
    tipOff,
    home: typeof g.home === "boolean" ? g.home : null,
    opponent: g.opponent?.name ?? g.opponent ?? null,
    opponentId: g.opponent?.uuid ?? g.opponentId ?? null,
    matchCallUuid: g.matchCallUuid ?? null,
    matchDayNum: g.matchDayNum ?? null,
    result: g.result ?? null,
    teamPoints: g.teamPoints ?? null,
    opponentPoints: g.opponentPoints ?? null,
    jornada: typeof g.jornada === "number" ? g.jornada : null,
    competition: g.competitionName ?? g.competition ?? null,
  };
}

function mergeOne(prev, f) {
  if (!prev) return f;
  return {
    ...prev,
    ...f,
    tipOff: f.tipOff ?? prev.tipOff ?? null,
    jornada:
      typeof f.jornada === "number"
        ? f.jornada
        : typeof prev.jornada === "number"
          ? prev.jornada
          : null,
    result: f.result ?? prev.result ?? null,
    teamPoints: f.teamPoints ?? prev.teamPoints ?? null,
    opponentPoints: f.opponentPoints ?? prev.opponentPoints ?? null,
    matchCallUuid: f.matchCallUuid ?? prev.matchCallUuid ?? null,
    opponentId: f.opponentId ?? prev.opponentId ?? null,
  };
}

function mergeFixtures(prevList, nextList) {
  const byKey = new Map();
  for (const f of prevList ?? []) {
    byKey.set(fixtureKey(f), { ...f });
  }
  for (const raw of nextList ?? []) {
    const f = normalizeGame(raw);
    const key = fixtureKey(f);
    let prev = byKey.get(key);
    if (!prev) {
      // Date + home soft match when opponent text drifts between sources.
      for (const [k, v] of byKey) {
        if (v.date === f.date && v.home === f.home) {
          prev = v;
          byKey.delete(k);
          break;
        }
      }
    }
    byKey.set(key, mergeOne(prev, f));
  }
  return [...byKey.values()].sort((a, b) =>
    String(a.date || a.tipOff || "").localeCompare(
      String(b.date || b.tipOff || ""),
    ),
  );
}

function extractTeamPayload(dump, fcbqTeamId) {
  if (!dump || typeof dump !== "object") return null;
  if (dump[fcbqTeamId]?.header) return dump[fcbqTeamId];
  if (dump[fcbqTeamId]?.games) return dump[fcbqTeamId];
  if (dump.header?.team?.uuid === fcbqTeamId) return dump;
  for (const [url, payload] of Object.entries(dump)) {
    if (!String(url).includes(fcbqTeamId)) continue;
    const body =
      payload && typeof payload === "object" && payload.json
        ? payload.json
        : payload;
    if (body?.header || body?.games) return body;
  }
  return null;
}

async function fetchLive(fcbqTeamId, cookie) {
  const url = `${MSSTATS}/${fcbqTeamId}/stats`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Origin: "https://www.basquetcatala.cat",
      Referer: `https://www.basquetcatala.cat/estadistica/equip/${fcbqTeamId}`,
      "User-Agent":
        "Mozilla/5.0 (compatible; SupermanagerBalaguer/1.0; +weekend-sync)",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`msstats ${fcbqTeamId} HTTP ${res.status}`);
  }
  return res.json();
}

function parseDateCa(raw) {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function tipOffFromDateHora(dateIso, hora) {
  const hm = String(hora || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!dateIso || !hm) return null;
  const [y, mo, d] = dateIso.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  // Europe/Madrid offset: use Intl to resolve (+01/+02).
  const rough = new Date(
    Date.UTC(y, mo - 1, d, Number(hm[1]) - 1, Number(hm[2])),
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(rough);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  // Build with explicit +02:00/+01:00 from a probe at noon Madrid that day.
  const noon = new Date(`${dateIso}T12:00:00Z`);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  })
    .formatToParts(noon)
    .find((p) => p.type === "timeZoneName")?.value;
  // GMT+2 / GMT+1 → +02:00
  let offset = "+02:00";
  const om = String(offsetPart || "").match(/GMT([+-])(\d{1,2})/i);
  if (om) {
    offset = `${om[1]}${pad(Number(om[2]))}:00`;
  }
  void get;
  return `${dateIso}T${pad(Number(hm[1]))}:${pad(Number(hm[2]))}:00${offset}`;
}

function isOurSide(name, homeNames) {
  const n = String(name || "").toUpperCase();
  return homeNames.some(
    (h) => n.includes(String(h).toUpperCase()) || String(h).toUpperCase().includes(n),
  );
}

/** Parse DataTables-style rows: [Data, Hora, Local, Visitant, Categoria, …] */
export function fixturesFromCalendarRows(rows, meta) {
  const out = [];
  for (const row of rows ?? []) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [dateRaw, hora, local, visitant, category] = row;
    const date = parseDateCa(dateRaw);
    if (!date) continue;
    const ourHome = isOurSide(local, meta.homeNames);
    const ourAway = isOurSide(visitant, meta.homeNames);
    if (!ourHome && !ourAway) continue;
    const home = Boolean(ourHome);
    out.push({
      date,
      tipOff: tipOffFromDateHora(date, hora),
      home,
      opponent: home ? visitant : local,
      opponentId: null,
      matchCallUuid: null,
      matchDayNum: null,
      result: null,
      teamPoints: null,
      opponentPoints: null,
      jornada: null,
      competition: category || null,
    });
  }
  return out;
}

/** Extract table rows from FCBQ calendar HTML (server-rendered DataTables). */
export function parseCalendarHtml(html, meta) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (c) =>
        c[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim(),
    );
    if (cells.length >= 4 && /^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) {
      rows.push(cells);
    }
  }
  return fixturesFromCalendarRows(rows, meta);
}

async function fetchCalendarHtml(legacyTeamId, cookie) {
  const url = `${CAL_BASE}/${legacyTeamId}`;
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; SupermanagerBalaguer/1.0; +weekend-sync)",
      Referer: `https://www.basquetcatala.cat/equip/${legacyTeamId}`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!res.ok) throw new Error(`calendar ${legacyTeamId} HTTP ${res.status}`);
  const html = await res.text();
  if (/Verificació de seguretat|CONFIRMA QUE ETS UNA PERSONA/i.test(html)) {
    throw new Error(`calendar ${legacyTeamId} blocked by reCAPTCHA`);
  }
  return html;
}

/**
 * Tag fixtures that still lack jornada with the current fantasy round when
 * their calendar date falls in the Madrid week of `anchorDate` (default: now).
 */
export function tagJornadaWeek(file, jornada, anchor = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const anchorDay = fmt.format(anchor);
  const [y, m, d] = anchorDay.split("-").map(Number);
  const utcApprox = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = utcApprox.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(utcApprox);
  monday.setUTCDate(utcApprox.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const from = fmt.format(monday);
  const to = fmt.format(sunday);

  for (const team of file.teams ?? []) {
    for (const f of team.fixtures ?? []) {
      if (typeof f.jornada === "number") continue;
      const day = (f.date || f.tipOff || "").slice(0, 10);
      if (!day) continue;
      if (day >= from && day <= to) f.jornada = jornada;
    }
  }
  return { from, to };
}

export function buildFixturesFile({
  existing,
  payloadsByTeam,
  gaps = [],
  source,
}) {
  const teams = CLUB_TEAMS.map((meta) => {
    const prev =
      (existing.teams ?? []).find((t) => t.fcbqTeamId === meta.fcbqTeamId) ??
      {};
    const payload = payloadsByTeam[meta.fcbqTeamId];
    const incoming = payload?.games ?? [];
    const { homeNames: _hn, ...publicMeta } = meta;
    return {
      ...publicMeta,
      fixtures: mergeFixtures(prev.fixtures, incoming),
    };
  });

  const allGaps = [...(existing.gaps ?? []), ...gaps].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return {
    updatedAt: new Date().toISOString(),
    source:
      source ||
      "msstats.optimalwayconsulting.com /v1/fcbq/teams/{id}/stats games[]",
    timezone: "Europe/Madrid",
    notes: [
      "tipOff is ISO only when FCBQ publishes a real start time — never invent from date alone.",
      "Prefer calendari_equip_global (Hora column) over msstats games[] for upcoming fixtures.",
      "Without tipOff among the jornada's club games, lineup stays open (lockAt=null).",
      "Refresh: node scripts/fetch-fcbq-fixtures.mjs --calendar ; weekend: node scripts/weekend-sync.mjs",
    ],
    gaps: allGaps,
    teams,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from-api");
  const fromCalIdx = args.indexOf("--from-calendar");
  const cookieIdx = args.indexOf("--cookie");
  const wantCalendar =
    args.includes("--calendar") || fromCalIdx >= 0;
  const cookie =
    (cookieIdx >= 0 ? args[cookieIdx + 1] : null) ||
    process.env.FCBQ_COOKIE ||
    "";
  const existing = loadExisting();
  const payloadsByTeam = {};
  const gaps = [];
  let source = existing.source;

  if (fromCalIdx >= 0) {
    const path = args[fromCalIdx + 1];
    const dump = JSON.parse(readFileSync(path, "utf8"));
    for (const t of CLUB_TEAMS) {
      const entry = dump[t.fcbqTeamId] || dump[String(t.legacyTeamId)];
      const rows = entry?.rows ?? entry?.calendar?.tables?.[0]?.rows ?? [];
      const games = fixturesFromCalendarRows(rows, t);
      if (games.length) payloadsByTeam[t.fcbqTeamId] = { games };
      else gaps.push(`No calendar rows for ${t.shortName} in ${path}`);
    }
    source = `FCBQ calendar dump ${path}`;
  } else if (wantCalendar) {
    for (const t of CLUB_TEAMS) {
      try {
        const html = await fetchCalendarHtml(t.legacyTeamId, cookie);
        const games = parseCalendarHtml(html, t);
        if (!games.length) {
          gaps.push(`${t.shortName}: calendar HTML parsed 0 rows`);
        }
        payloadsByTeam[t.fcbqTeamId] = { games };
      } catch (err) {
        gaps.push(`${t.shortName}: ${err.message}`);
        console.warn("calendar fetch failed", t.shortName, err.message);
      }
    }
    source = `basquetcatala.cat/partits/calendari_equip_global/${CLUB_ID}/{legacyId}`;
    if (Object.keys(payloadsByTeam).length === 0) {
      console.warn(
        "Calendar fetch failed for all teams (reCAPTCHA/cookie?). Keeping existing fixtures.",
      );
    }
  } else if (fromIdx >= 0) {
    const path = args[fromIdx + 1];
    const dump = JSON.parse(readFileSync(path, "utf8"));
    for (const t of CLUB_TEAMS) {
      const body = extractTeamPayload(dump, t.fcbqTeamId);
      if (body) payloadsByTeam[t.fcbqTeamId] = body;
      else gaps.push(`No API payload for ${t.shortName} in ${path}`);
    }
    source = `API dump ${path}`;
  } else if (cookie || args.includes("--live")) {
    for (const t of CLUB_TEAMS) {
      try {
        payloadsByTeam[t.fcbqTeamId] = await fetchLive(t.fcbqTeamId, cookie);
      } catch (err) {
        gaps.push(`${t.shortName}: ${err.message}`);
        console.warn("fetch failed", t.shortName, err.message);
      }
    }
    source = "msstats live";
    if (Object.keys(payloadsByTeam).length === 0) {
      console.warn(
        "Live msstats failed for all teams (reCAPTCHA/cookie?). Keeping existing fixtures.",
      );
    }
  } else {
    console.log(
      "No --calendar/--live/--cookie/--from-api — rewriting fixtures from existing merge only.",
    );
  }

  if (
    !wantCalendar &&
    fromCalIdx < 0 &&
    !gaps.some((g) => /tip-off|calendar/i.test(g))
  ) {
    gaps.push(
      "msstats games[] often lacks upcoming fixtures + tip-off; use --calendar with FCBQ_COOKIE.",
    );
  }

  const out = buildFixturesFile({
    existing,
    payloadsByTeam,
    gaps,
    source,
  });

  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const counts = out.teams.map((t) => `${t.shortName}:${t.fixtures.length}`);
  const next = out.teams.map((t) => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
    }).format(new Date());
    const up = (t.fixtures || []).find((f) => (f.date || "") >= today);
    return `${t.shortName}→${up ? up.opponent : "—"}`;
  });
  console.log(`Wrote ${OUT} (${counts.join(", ")})`);
  console.log(`Next: ${next.join(" | ")}`);
  if (gaps.length) console.log("Gaps:", gaps.join(" | "));
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
