import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runAutopilot } from "./lib/run.mjs";
import {
  PASS,
  SPEC,
  SPEC_OK,
  STANDARDS_OK,
  TICKET,
  fakeForge,
  fakeHarness,
  implementer,
  onTrunk,
  repoFixture,
  sh,
} from "./test-helpers.mjs";

const SPEC_PATH = ".scratch/demo/spec.md";
const T = (id) => `.scratch/demo/issues/${id}-thing.md`;

function oneTicket(opts) {
  return repoFixture({ [SPEC_PATH]: SPEC(), [T("01")]: TICKET("01", "First thing") }, opts);
}

const happyRoles = (extra = {}) => ({
  implementer: implementer(),
  verifier: PASS,
  "review-spec": SPEC_OK,
  "review-standards": STANDARDS_OK,
  ...extra,
});

function run(fx, harness, forge, options = {}) {
  return runAutopilot({ repoDir: fx.clone, spec: SPEC_PATH, harness, forge, stateDir: fx.stateDir, who: "autopilot@test", ...options });
}

// ---------- 04: claim, implement, open a pull request ----------

test("a spec that is not ready-for-agent is refused before any work", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC("needs-triage"), [T("01")]: TICKET("01", "First thing") });
  const harness = fakeHarness(happyRoles());
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(report.status, "refused");
  assert.match(report.reason, /needs-triage/);
  assert.equal(harness.calls.length, 0);
  assert.doesNotMatch(onTrunk(fx, T("01")), /Claimed-by/);
});

test("a ticket is claimed on trunk before the implementer starts", async () => {
  const fx = oneTicket();
  let claimSeenByImplementer = false;
  const harness = fakeHarness(
    happyRoles({
      implementer: (ctx) => {
        claimSeenByImplementer = /Claimed-by: autopilot@test/.test(sh(fx.remote, "show", `main:${T("01")}`));
        return implementer()(ctx);
      },
    }),
  );
  await run(fx, harness, fakeForge(fx));
  assert.ok(claimSeenByImplementer, "claim was pushed to trunk before implementing");
  const claimCommit = sh(fx.remote, "log", "--format=%H", "--grep=claim 01", "main");
  assert.ok(claimCommit, "a claim commit exists on trunk");
  assert.deepEqual(sh(fx.remote, "show", "--name-only", "--format=", claimCommit).split("\n"), [T("01")], "the claim touches only the ticket");
});

test("the implementer gets pointers to the spec and ticket, not their contents", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles());
  await run(fx, harness, fakeForge(fx));
  const prompt = harness.calls.find((c) => c.role === "implementer").prompt;
  assert.match(prompt, new RegExp(`^Spec: ${SPEC_PATH}$`, "m"));
  assert.match(prompt, new RegExp(`^Ticket: ${T("01")}$`, "m"));
  assert.doesNotMatch(prompt, /Build the demo\./, "spec body is not pasted");
});

test("the ticket branch carries the handoff and the closed status, and a pull request opens with the pr body", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  await run(fx, fakeHarness(happyRoles()), forge);
  assert.equal(forge.prs.length, 1);
  const pr = forge.prs[0];
  assert.equal(pr.base, "main");
  assert.match(pr.branch, /^autopilot\/demo\/01$/);
  assert.match(pr.body, /\*\*Door:\*\* two-way/);
  const onBranch = sh(fx.remote, "show", `${pr.branch}:${T("01")}`);
  assert.match(onBranch, /## Handoff/);
  assert.match(onBranch, /\*\*Status:\*\* closed/);
  assert.doesNotMatch(onBranch, /^Autopilot:/m, "the progress line is gone once the ticket closes");
});

test("a dry run reports the frontier and changes nothing", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles());
  const before = sh(fx.remote, "rev-parse", "main");
  const report = await run(fx, harness, fakeForge(fx), { dryRun: true });
  assert.equal(report.status, "dry-run");
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "ready"]]);
  assert.equal(harness.calls.length, 0);
  assert.equal(sh(fx.remote, "rev-parse", "main"), before);
});
