import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRecord, parseRecord, usage } from "./lib/records.mjs";
import { nextStep } from "./lib/steps.mjs";

const LIMITS = { fixRounds: 2, tokens: 1000, timeMs: 60 * 60_000 };
const PR = { state: "open", draft: true };
const FAILED = (patch = "p1") => ({ kind: "gates", patch, blocking: ["verification FAIL: broken"] });
const PASSED = (patch = "p1") => ({ kind: "gates", patch, blocking: [] });
const WORK = (kind, attempts = 1, extra = {}) => ({ kind, attempts, tokens: 10, ms: 1000, ...extra });

const facts = (over = {}) => ({
  ticket: { status: "ready-for-agent", claimedBy: "me" },
  me: "me",
  blockers: [],
  verifiable: true,
  branchExists: false,
  pr: null,
  records: [],
  patch: "p1",
  conflict: null,
  humanNote: null,
  limits: LIMITS,
  ...over,
});

const rows = [
  ["a closed ticket is done", { ticket: { status: "closed" } }, { step: "none", why: "closed" }],
  ["a pull request a human merged finishes the ticket", { pr: { state: "merged" }, ticket: { status: "ready-for-human" } }, { step: "finish" }],
  ["a pull request a human closed is left alone", { pr: { state: "closed" } }, { step: "none" }],
  ["a ticket waiting for the human is left alone", { ticket: { status: "ready-for-human" }, pr: PR }, { step: "none", why: "ready-for-human" }],
  ["a ticket someone else holds is left alone", { ticket: { status: "ready-for-agent", claimedBy: "other" } }, { step: "none", why: "claimed by other" }],
  ["an open blocker keeps the ticket waiting", { blockers: [{ id: "01", status: "ready-for-human" }] }, { step: "none", why: "waiting on 01 (ready-for-human)" }],
  ["a verifiable ticket with no pull request is implemented", {}, { step: "implement" }],
  ["an unclaimed ticket is implemented too", { ticket: { status: "ready-for-agent", claimedBy: null } }, { step: "implement" }],
  ["a ticket with no Verify lines goes to triage", { verifiable: false }, { step: "triage" }],
  ["a started branch is continued even without Verify lines", { verifiable: false, branchExists: true }, { step: "implement" }],
  ["a pull request without records waits for gates", { pr: PR }, { step: "gates" }],
  ["a passing verdict on an older patch needs new gates", { pr: PR, records: [WORK("implement"), PASSED("old")] }, { step: "gates" }],
  ["a rework always gets fresh gates, even when its patch did not change", { pr: PR, records: [WORK("implement"), FAILED(), WORK("rework")] }, { step: "gates" }],
  ["a failed verdict under the round limit is reworked", { pr: PR, records: [WORK("implement"), FAILED()] }, { step: "rework", counted: true, findings: ["verification FAIL: broken"] }],
  [
    "a failed verdict at the round limit goes to the human",
    { pr: PR, records: [WORK("implement"), FAILED("p0"), WORK("rework"), FAILED("p2"), WORK("rework"), FAILED()] },
    { step: "human", why: "verification FAIL: broken" },
  ],
  ["conflict reworks do not count as fix rounds", { pr: PR, records: [WORK("implement"), WORK("rework", 1, { counted: false }), WORK("rework", 1, { counted: false }), FAILED()] }, { step: "rework" }],
  ["a passing verdict on the current patch merges", { pr: PR, records: [WORK("implement"), PASSED()] }, { step: "merge" }],
  ["a conflict with trunk is reworked without counting", { pr: PR, records: [WORK("implement"), PASSED()], conflict: ["src/a.js"] }, { step: "rework", counted: false, conflict: true }],
  ["over the token budget goes to the human", { pr: PR, records: [WORK("implement", 1, { tokens: 5000 }), FAILED()] }, { step: "human", why: "over the token budget (5000 > 1000)" }],
  ["over the time budget goes to the human", { pr: PR, records: [WORK("implement", 1, { ms: 61 * 60_000 })] }, { step: "human", why: "over the time budget (61 min)" }],
  [
    "a human hand-back reworks with the human's comment",
    { pr: PR, records: [WORK("implement"), FAILED(), { kind: "brief" }], humanNote: "use cents, not floats" },
    { step: "rework", humanReturn: true, findings: ["the human asked: use cents, not floats"] },
  ],
  [
    "after a hand-back the fix rounds and budget start over",
    {
      pr: PR,
      records: [WORK("implement", 1, { tokens: 900 }), FAILED("p0"), WORK("rework", 2, { tokens: 900 }), FAILED("p2"), { kind: "brief" }, { kind: "human-return" }, WORK("rework"), FAILED()],
    },
    { step: "rework", counted: true },
  ],
];

for (const [name, over, want] of rows) {
  test(`next step: ${name}`, () => {
    const got = nextStep(facts(over));
    for (const [k, v] of Object.entries(want)) {
      if (k === "why" && want.step === "none") assert.match(got.why, new RegExp(v.replace(/[()]/g, "\\$&")), name);
      else assert.deepEqual(got[k], v, `${name}: ${k}`);
    }
  });
}

test("a run record survives a round trip through a comment, even with an arrow in its findings", () => {
  const record = { kind: "gates", patch: "p1", blocking: ["the --> arrow broke the comment"], tokens: 3 };
  const body = formatRecord(record);
  assert.doesNotMatch(body.split("\n")[0].slice(4, -3), /-->/);
  assert.deepEqual(parseRecord(body), record);
  assert.equal(parseRecord("Looks good to me"), null);
});

test("usage sums tokens and time since the last hand-back, and counts fix rounds from attempts", () => {
  assert.deepEqual(usage([WORK("implement", 3, { tokens: 5, ms: 7 }), FAILED(), WORK("rework", 1, { tokens: 5, ms: 7 })]), { tokens: 10, ms: 14, fixRounds: 3 });
  assert.deepEqual(usage([WORK("implement", 3), { kind: "human-return" }, WORK("rework", 1, { tokens: 2, ms: 3 })]), { tokens: 2, ms: 3, fixRounds: 0 });
});
