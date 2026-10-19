import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runAutopilot } from "./lib/run.mjs";
import {
  PASS,
  PR_BODY,
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

// ---------- 05: independent verify, review, merge ----------

test("a ticket that passes every gate is verified and reviewed by other roles, then merged with its handoff on trunk", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles());
  const forge = fakeForge(fx);
  const report = await run(fx, harness, forge);
  assert.deepEqual(harness.calls.map((c) => c.role).sort(), ["implementer", "review-spec", "review-standards", "verifier"]);
  const cwd = (role) => harness.calls.find((c) => c.role === role).cwd;
  assert.notEqual(cwd("verifier"), cwd("implementer"), "the verifier works in its own checkout");
  assert.match(harness.calls.find((c) => c.role === "verifier").prompt, /^Verification doc: docs\/agents\/verify\.md$/m);
  const comments = forge.prs[0].comments.join("\n");
  assert.match(comments, /Verdict: PASS/);
  assert.match(comments, /Patch: [0-9a-f]{40}/);
  assert.match(comments, /review-spec: pass/);
  assert.match(comments, /review-standards: pass/);
  assert.equal(forge.prs[0].state, "merged");
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "merged"]]);
  const trunkTicket = onTrunk(fx, T("01"));
  assert.match(trunkTicket, /## Handoff/);
  assert.match(trunkTicket, /\*\*Status:\*\* closed/);
  assert.match(onTrunk(fx, "src/01.js"), /t01/);
});

test("a failed verification keeps the pull request open and hands the ticket to the human", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  const report = await run(fx, fakeHarness(happyRoles({ verifier: () => ({ verdict: "FAIL", evidence: "button does nothing" }) })), forge, { maxFixRounds: 0 });
  assert.equal(forge.prs[0].state, "open");
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /button does nothing/);
  const trunkTicket = onTrunk(fx, T("01"));
  assert.match(trunkTicket, /\*\*Status:\*\* ready-for-human/);
  assert.doesNotMatch(trunkTicket, /^Autopilot:/m);
  assert.match(trunkTicket, /button does nothing/);
});

test("a hard standards finding blocks the merge", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  const report = await run(
    fx,
    fakeHarness(happyRoles({ "review-standards": () => ({ verdict: "fail", findings: [{ severity: "hard", rule: "AGENTS.md: no tool names", detail: "names a tool" }] }) })),
    forge,
    { maxFixRounds: 0 },
  );
  assert.equal(forge.prs[0].state, "open");
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /no tool names/);
});

test("judgement-only standards findings do not block the merge", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  await run(fx, fakeHarness(happyRoles({ "review-standards": () => ({ verdict: "pass", findings: [{ severity: "judgement", rule: "Feature Envy" }] }) })), forge);
  assert.equal(forge.prs[0].state, "merged");
});

// ---------- 06: merge policy ----------

const POLICY = ({ auto = "on", blast = ["none", "low"], protect = [], unprotect = [] } = {}) =>
  `# Merge policy\n\nAuto-merge: ${auto}\n\n## Allowed blast radius\n\n${blast.map((b) => `- ${b}`).join("\n")}\n\n## Protected paths\n\n${protect.map((p) => `- ${p}`).join("\n") || "- (none)"}\n\n## Unprotected defaults\n\n${unprotect.map((p) => `- ${p}`).join("\n")}\n`;

async function policyRun({ files = {}, verifyDoc = true, roles = {} } = {}) {
  const fx = repoFixture({ [SPEC_PATH]: SPEC(), [T("01")]: TICKET("01", "First thing"), ...files }, { verifyDoc });
  const harness = fakeHarness(happyRoles(roles));
  const forge = fakeForge(fx);
  const report = await run(fx, harness, forge);
  return { fx, harness, forge, ticket: report.tickets[0] };
}

const touching = (rel) =>
  implementer({
    change: ({ cwd }) => {
      fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
      fs.writeFileSync(path.join(cwd, rel), "x\n");
    },
  });

test("without a verification doc nothing auto-merges", async () => {
  const { forge, ticket } = await policyRun({ verifyDoc: false });
  assert.equal(forge.prs[0].state, "open");
  assert.equal(ticket.outcome, "ready-for-human");
  assert.match(ticket.reason, /no verification doc/);
});

test("a change under a default protected path goes to the human", async () => {
  const { forge, ticket } = await policyRun({ roles: { implementer: touching("db/migrations/001.sql") } });
  assert.equal(forge.prs[0].state, "open");
  assert.match(ticket.reason, /protected path: db\/migrations\/001\.sql/);
});

test("a lockfile change goes to the human", async () => {
  const { ticket } = await policyRun({ roles: { implementer: touching("package-lock.json") } });
  assert.match(ticket.reason, /protected path: package-lock\.json/);
});

test("a one-way door goes to the human", async () => {
  const { ticket } = await policyRun({ roles: { implementer: implementer({ prBody: PR_BODY({ door: "one-way" }) }) } });
  assert.equal(ticket.outcome, "ready-for-human");
  assert.match(ticket.reason, /one-way door/);
});

test("a blast radius outside the allowed set goes to the human", async () => {
  const { ticket } = await policyRun({
    files: { "docs/agents/merge-policy.md": POLICY({ blast: ["none"] }) },
    roles: { implementer: implementer({ prBody: PR_BODY({ blast: "Checkout" }) }) },
  });
  assert.match(ticket.reason, /blast radius "Checkout" is not allowed/);
});

test("auto-merge can be turned off by the policy", async () => {
  const { ticket } = await policyRun({ files: { "docs/agents/merge-policy.md": POLICY({ auto: "off" }) } });
  assert.match(ticket.reason, /auto-merge is off/);
});

test("a project may protect more paths, and unprotect a default only with a reason", async () => {
  const added = await policyRun({ files: { "docs/agents/merge-policy.md": POLICY({ protect: ["src/billing/"] }) }, roles: { implementer: touching("src/billing/pay.js") } });
  assert.match(added.ticket.reason, /protected path: src\/billing\/pay\.js/);

  const noReason = await policyRun({ files: { "docs/agents/merge-policy.md": POLICY({ unprotect: [".github/"] }) }, roles: { implementer: touching(".github/workflows/ci.yml") } });
  assert.match(noReason.ticket.reason, /protected path: \.github\/workflows\/ci\.yml/);

  const withReason = await policyRun({
    files: { "docs/agents/merge-policy.md": POLICY({ unprotect: [".github/: CI here only runs lint, reviewed weekly"] }) },
    roles: { implementer: touching(".github/workflows/ci.yml") },
  });
  assert.equal(withReason.ticket.outcome, "merged");
});

test("a verdict for an older patch is re-verified before merging", async () => {
  const { fx, harness, forge, ticket } = await policyRun({
    roles: {
      "review-standards": ({ cwd, call }) => {
        if (call === 1) {
          fs.writeFileSync(path.join(cwd, "src/late.js"), "late\n");
          sh(cwd, "add", "-A");
          sh(cwd, "commit", "-qm", "late change");
          const branch = "autopilot/demo/01";
          sh(cwd, "push", "-q", "origin", `HEAD:${branch}`);
        }
        return STANDARDS_OK();
      },
    },
  });
  assert.equal(harness.calls.filter((c) => c.role === "verifier").length, 2, "the new patch got its own verdict");
  assert.equal(ticket.outcome, "merged");
  assert.equal(forge.prs[0].state, "merged");
  assert.equal(onTrunk(fx, "src/late.js"), "late");
});

test("the merge policy seed template parses to the built-in defaults", async () => {
  const { loadPolicy } = await import("./lib/policy.mjs");
  const seed = fs.readFileSync(new URL("../../setup-software-context/merge-policy.md", import.meta.url), "utf8");
  assert.deepEqual(loadPolicy(seed), loadPolicy(null));
});

// ---------- 07: fix rounds and budgets ----------

test("a failed verification goes back to a fresh implementer with the findings, and merges once fixed", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles({ verifier: ({ call }) => (call === 1 ? { verdict: "FAIL", evidence: "total is off by one" } : PASS()) }));
  const forge = fakeForge(fx);
  const report = await run(fx, harness, forge);
  const impl = harness.calls.filter((c) => c.role === "implementer");
  assert.equal(impl.length, 2);
  assert.match(impl[1].prompt, /^Finding to fix: verification FAIL: total is off by one$/m);
  assert.match(impl[1].prompt, /^Branch: autopilot\/demo\/01$/m);
  assert.match(impl[1].prompt, new RegExp(`^Ticket: ${T("01")}$`, "m"));
  assert.equal(report.tickets[0].outcome, "merged");
});

test("after two fix rounds the ticket goes to the human and no third round starts", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles({ verifier: () => ({ verdict: "FAIL", evidence: "still broken" }) }));
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(harness.calls.filter((c) => c.role === "implementer").length, 3, "the first build plus two fix rounds");
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /still broken/);
});

test("a ticket over its token budget stops and goes to the human", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles({ implementer: (ctx) => ({ ...implementer()(ctx), tokens: 5000 }) }));
  const report = await run(fx, harness, fakeForge(fx), { budget: { tokens: 1000 } });
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /token budget/);
  assert.equal(harness.calls.filter((c) => c.role === "verifier").length, 0);
});

test("a ticket over its time budget stops and goes to the human", async () => {
  const fx = oneTicket();
  let now = 0;
  const harness = fakeHarness(happyRoles({ implementer: (ctx) => ((now += 61 * 60_000), implementer()(ctx)) }));
  const report = await run(fx, harness, fakeForge(fx), { budget: { timeMs: 60 * 60_000 }, clock: () => now });
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /time budget/);
});

test("per-machine counters live outside the repository", async () => {
  const fx = oneTicket();
  await run(fx, fakeHarness(happyRoles({ verifier: ({ call }) => (call === 1 ? { verdict: "FAIL", evidence: "x" } : PASS()) })), fakeForge(fx));
  const state = JSON.parse(fs.readFileSync(path.join(fx.stateDir, "demo.json"), "utf8"));
  assert.equal(state.tickets["01"].rounds, 2);
  assert.ok(state.tickets["01"].tokens > 0);
  assert.equal(sh(fx.clone, "status", "--porcelain"), "", "the clone stays clean");
});

test("an implementer that leaves no handoff, or reports failure, gets a fix round before any review", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(
    happyRoles({
      implementer: (ctx) => (ctx.call === 1 ? implementer({ handoff: false })(ctx) : ctx.call === 2 ? { ok: false, note: "tests would not run" } : implementer()(ctx)),
    }),
  );
  const report = await run(fx, harness, fakeForge(fx));
  const impl = harness.calls.filter((c) => c.role === "implementer");
  assert.equal(impl.length, 3);
  assert.match(impl[1].prompt, /^Finding to fix: the ticket has no ## Handoff section$/m);
  assert.match(impl[2].prompt, /^Finding to fix: the implementer could not finish: tests would not run$/m);
  assert.equal(harness.calls.filter((c) => c.role === "verifier").length, 1, "review waits for a complete attempt");
  assert.equal(report.tickets[0].outcome, "merged");
});

// ---------- 09: pushes only with a lease on the run's own branch ----------

test("a push by someone else to the ticket branch stops the run instead of being overwritten", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(
    happyRoles({
      verifier: ({ cwd, call }) => {
        if (call === 1) {
          fs.writeFileSync(path.join(cwd, "src/theirs.js"), "theirs\n");
          sh(cwd, "add", "-A");
          sh(cwd, "commit", "-qm", "someone else");
          sh(cwd, "push", "-q", "origin", "HEAD:autopilot/demo/01");
          return { verdict: "FAIL", evidence: "needs a fix" };
        }
        return PASS();
      },
    }),
  );
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /someone else pushed/);
  assert.equal(sh(fx.remote, "show", "autopilot/demo/01:src/theirs.js"), "theirs", "their commit survives");
});
