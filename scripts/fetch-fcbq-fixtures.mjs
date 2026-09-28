#!/usr/bin/env node
/**
 * Fetch / refresh src/data/fixtures.json for the 4 Balaguer club teams.
 *
 * Source preference:
 *   1) FCBQ_COOKIE / --cookie → live msstats /v1/fcbq/teams/{id}/stats
 *   2) --from-api path → JSON dump keyed by team id or stats URL
 *   3) merge into existing fixtures.json (preserve tipOff when API only has date)
 *
 * Never invents tip-off times. msstats games[] exposes date + home/away + opponent;
 * tipOff stays null until calendar/matchCall publishes a real start time.
 *
 * Usage:
 *   node scripts/fetch-fcbq-fixtures.mjs
 *   FCBQ_COOKIE='fcbq_rc=…' node scripts/fetch-fcbq-fixtures.mjs
 *   node scripts/fetch-fcbq-fixtures.mjs --from-api /tmp/msstats-dump.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "src/data/fixtures.json");

export const CLUB_TEAMS = [
  {
    fcbqTeamId: "5f55017e-893e-4323-8b41-b58323ea8f73",
    teamId: "masc-a",
    slug: "teixido-a",
    shortName: "Teixidó A",
  },
  {
    fcbqTeamId: "c057eeae-3aae-4e33-b2ab-54fabb2700ae",
    teamId: "masc-b",
    slug: "sifonet-b",
    shortName: "Lo Sifonet B",
  },
  {
    fcbqTeamId: "839e2243-48dc-4459-aec5-a2dadeb3ad53",
    teamId: "fem-a",
    slug: "cudos-a",
    shortName: "Cudos A",
  },
  {
    fcbqTeamId: "a5c75f3f-ca35-4553-9eb6-a29780eb2007",
    teamId: "fem-b",
    slug: "farratges-b",
    shortName: "Farratges B",
  },
];

const MSSTATS = "https://msstats.optimalwayconsulting.com/v1/fcbq/teams";

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
  // Refuse date-only invention for tipOff.
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

function mergeFixtures(prevList, nextList) {
  const byKey = new Map();
  for (const f of prevList ?? []) {
    byKey.set(fixtureKey(f), { ...f });
  }
  for (const raw of nextList ?? []) {
    const f = normalizeGame(raw);
    const key = fixtureKey(f);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, f);
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...f,
      // Keep previously known real tipOff if new payload lacks it.
      tipOff: f.tipOff ?? prev.tipOff ?? null,
      jornada:
        typeof f.jornada === "number"
          ? f.jornada
          : typeof prev.jornada === "number"
            ? prev.jornada
            : null,
    });
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
  if (dump.header?.team?.uuid === fcbqTeamId) return dump;
  for (const [url, payload] of Object.entries(dump)) {
    if (!String(url).includes(fcbqTeamId)) continue;
    const body =
      payload && typeof payload === "object" && payload.json
        ? payload.json
        : payload;
    if (body?.header) return body;
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

/**
 * Tag fixtures that still lack jornada with the current fantasy round when
 * their calendar date falls in the Madrid week of `anchorDate` (default: now).
 * Does not invent tipOff.
 */
export function tagJornadaWeek(file, jornada, anchor = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const anchorDay = fmt.format(anchor); // YYYY-MM-DD
  // Monday-start week in Madrid
  const [y, m, d] = anchorDay.split("-").map(Number);
  const utcApprox = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = utcApprox.getUTCDay(); // 0 Sun
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
    return {
      ...meta,
      fixtures: mergeFixtures(prev.fixtures, incoming),
    };
  });

  const allGaps = [
    ...(existing.gaps ?? []),
    ...gaps,
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    updatedAt: new Date().toISOString(),
    source:
      source ||
      "msstats.optimalwayconsulting.com /v1/fcbq/teams/{id}/stats games[]",
    timezone: "Europe/Madrid",
    notes: [
      "tipOff is ISO only when FCBQ publishes a real start time — never invent from date alone.",
      "Without tipOff among the jornada's club games, lineup stays open (lockAt=null).",
      "Refresh: node scripts/fetch-fcbq-fixtures.mjs ; weekend: node scripts/weekend-sync.mjs",
    ],
    gaps: allGaps,
    teams,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from-api");
  const cookieIdx = args.indexOf("--cookie");
  const cookie =
    (cookieIdx >= 0 ? args[cookieIdx + 1] : null) ||
    process.env.FCBQ_COOKIE ||
    "";
  const existing = loadExisting();
  const payloadsByTeam = {};
  const gaps = [];

  if (fromIdx >= 0) {
    const path = args[fromIdx + 1];
    const dump = JSON.parse(readFileSync(path, "utf8"));
    for (const t of CLUB_TEAMS) {
      const body = extractTeamPayload(dump, t.fcbqTeamId);
      if (body) payloadsByTeam[t.fcbqTeamId] = body;
      else gaps.push(`No API payload for ${t.shortName} in ${path}`);
    }
  } else if (cookie || args.includes("--live")) {
    for (const t of CLUB_TEAMS) {
      try {
        payloadsByTeam[t.fcbqTeamId] = await fetchLive(t.fcbqTeamId, cookie);
      } catch (err) {
        gaps.push(`${t.shortName}: ${err.message}`);
        console.warn("fetch failed", t.shortName, err.message);
      }
    }
    if (Object.keys(payloadsByTeam).length === 0) {
      console.warn(
        "Live msstats failed for all teams (reCAPTCHA/cookie?). Keeping existing fixtures.",
      );
    }
  } else {
    console.log(
      "No --live/--cookie/--from-api — rewriting fixtures from existing merge only.",
    );
  }

  // Preserve tipOff note about calendar gap
  if (!gaps.some((g) => /tip-off/i.test(g))) {
    gaps.push(
      "msstats games[] has date/home/opponent but not tip-off; calendar pages need FCBQ_COOKIE.",
    );
  }

  const out = buildFixturesFile({
    existing,
    payloadsByTeam,
    gaps,
    source: fromIdx >= 0
      ? `API dump ${args[fromIdx + 1]}`
      : cookie || args.includes("--live")
        ? "msstats live"
        : existing.source,
  });

  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const counts = out.teams.map(
    (t) => `${t.shortName}:${t.fixtures.length}`,
  );
  console.log(`Wrote ${OUT} (${counts.join(", ")})`);
  if (gaps.length) console.log("Gaps:", gaps.join(" | "));
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
