/**
 * Push copy, kickoff choice, and one-shot dispatch.
 * Run: npm run test:push
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-push-"));
process.env.DATA_DIR = dir;
(globalThis as { __smDb?: unknown }).__smDb = undefined;

async function main() {
  const { firstWeekendKickoff } = await import("../src/lib/fixtures");
  const {
    decideIdealPush,
    decideJornadaStartPush,
    idealPushBody,
    jornadaStartPushBody,
    JORNADA_START_GRACE_MS,
    PUSH_TITLE,
  } = await import("../src/lib/push-policy");
  const { dispatchLoggedPush } = await import("../src/lib/push");

assert.equal(PUSH_TITLE, "Supermanager");
assert.equal(
  idealPushBody(2),
  "Ja pots consultar l'equip ideal de la jornada 2.",
);
assert.equal(jornadaStartPushBody(2), "La jornada 2 ja ha començat.");

assert.equal(decideIdealPush(false, false), "wait");
assert.equal(decideIdealPush(true, true), "wait");
assert.equal(decideIdealPush(true, false), "send");

const kickoff = "2026-10-10T16:00:00.000Z"; // 18:00 Madrid
const at = (iso: string) => Date.parse(iso);
assert.equal(
  decideJornadaStartPush({
    status: "open",
    kickoff,
    nowMs: at("2026-10-10T15:00:00.000Z"),
    alreadyDispatched: false,
  }),
  "wait",
);
assert.equal(
  decideJornadaStartPush({
    status: "open",
    kickoff,
    nowMs: at("2026-10-10T16:05:00.000Z"),
    alreadyDispatched: false,
  }),
  "send",
);
assert.equal(
  decideJornadaStartPush({
    status: "open",
    kickoff,
    nowMs: at(kickoff) + JORNADA_START_GRACE_MS + 60_000,
    alreadyDispatched: false,
  }),
  "skip",
);
assert.equal(
  decideJornadaStartPush({
    status: "closed",
    kickoff,
    nowMs: at("2026-10-10T16:05:00.000Z"),
    alreadyDispatched: false,
  }),
  "skip",
);
assert.equal(
  decideJornadaStartPush({
    status: "open",
    kickoff: null,
    nowMs: at("2026-10-10T16:05:00.000Z"),
    alreadyDispatched: false,
  }),
  "wait",
);
assert.equal(
  decideJornadaStartPush({
    status: "open",
    kickoff,
    nowMs: at("2026-10-10T16:05:00.000Z"),
    alreadyDispatched: true,
  }),
  "wait",
);

const file = {
  teams: [
    {
      fcbqTeamId: "a",
      teamId: "fem-a" as const,
      slug: "a",
      shortName: "A",
      fullName: "A",
      fixtures: [
        {
          date: "2026-10-03",
          tipOff: "2026-10-03T16:00:00.000Z",
          home: false,
          opponent: "X",
          jornada: 2,
        },
        {
          date: "2026-10-10",
          tipOff: "2026-10-10T16:00:00.000Z",
          home: false,
          opponent: "Y",
          jornada: null,
        },
        {
          date: "2026-10-10",
          tipOff: null,
          home: true,
          opponent: "Z",
          jornada: null,
        },
        {
          date: "2026-10-17",
          tipOff: "2026-10-17T18:00:00.000Z",
          home: true,
          opponent: "W",
          jornada: 3,
        },
      ],
    },
  ],
};

const duringJ2 = new Date("2026-10-04T10:00:00.000Z");
assert.equal(
  firstWeekendKickoff(2, file, duringJ2),
  "2026-10-03T16:00:00.000Z",
);
const duringJ3week = new Date("2026-10-10T10:00:00.000Z");
assert.equal(
  firstWeekendKickoff(3, file, duringJ3week),
  "2026-10-10T16:00:00.000Z",
);
assert.equal(
  firstWeekendKickoff(9, { teams: file.teams.map((t) => ({ ...t, fixtures: t.fixtures.filter((f) => f.tipOff == null) })) }, duringJ3week),
  null,
);

const sent: string[] = [];
const send = async (message: { body: string }) => {
  sent.push(message.body);
  return 4;
};

const skipped = await dispatchLoggedPush({
  kind: "jornada-start",
  round: 2,
  decision: "skip",
  message: { title: PUSH_TITLE, body: jornadaStartPushBody(2) },
  send,
});
assert.equal(skipped.outcome, "skipped");
assert.equal(sent.length, 0);

const late = await dispatchLoggedPush({
  kind: "jornada-start",
  round: 2,
  decision: "send",
  message: { title: PUSH_TITLE, body: jornadaStartPushBody(2) },
  send,
});
assert.equal(late.outcome, "already");
assert.equal(sent.length, 0);

const ideal = await dispatchLoggedPush({
  kind: "ideal",
  round: 2,
  decision: "send",
  message: { title: PUSH_TITLE, body: idealPushBody(2) },
  send,
});
assert.equal(ideal.outcome, "sent");
assert.equal(ideal.delivered, 4);
assert.deepEqual(sent, [idealPushBody(2)]);

const again = await dispatchLoggedPush({
  kind: "ideal",
  round: 2,
  decision: "send",
  message: { title: PUSH_TITLE, body: idealPushBody(2) },
  send,
});
assert.equal(again.outcome, "already");
assert.equal(sent.length, 1);

  console.log("OK push");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
