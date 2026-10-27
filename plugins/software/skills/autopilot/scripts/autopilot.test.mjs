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
  anotherClone,
  fakeForge,
  fakeHarness,
  implementer,
  onTrunk,
  repoFixture,
  sh,
  write,
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

test("the implementer gets the ticket pointer only, not the parent spec", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles());
  await run(fx, harness, fakeForge(fx));
  const prompt = harness.calls.find((c) => c.role === "implementer").prompt;
  assert.match(prompt, new RegExp(`^Ticket: ${T("01")}$`, "m"));
  assert.doesNotMatch(prompt, /^Spec:/m, "the parent spec is not a per-ticket contract");
  assert.doesNotMatch(prompt, /spec\.md/, "the parent spec path is not pasted");
  assert.doesNotMatch(prompt, /Build the demo\./, "spec body is not pasted");
});

test("the verifier and both reviewers get the ticket only, never the parent spec", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(happyRoles());
  await run(fx, harness, fakeForge(fx));
  const prompts = harness.calls.filter((c) => ["verifier", "review-spec", "review-standards"].includes(c.role)).map((c) => c.prompt);
  assert.equal(prompts.length, 3);
  for (const prompt of prompts) {
    assert.match(prompt, new RegExp(`^Ticket: ${T("01")}$`, "m"));
    assert.doesNotMatch(prompt, /^Spec:/m);
    assert.doesNotMatch(prompt, /spec\.md/);
  }
});

test("the ticket branch carries the handoff file, and a draft pull request opens with the pr body", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  let draftWhileGating = null;
  await run(fx, fakeHarness(happyRoles({ verifier: () => ((draftWhileGating = forge.prs[0].draft), PASS()) })), forge);
  assert.equal(forge.prs.length, 1);
  const pr = forge.prs[0];
  assert.equal(pr.base, "main");
  assert.match(pr.branch, /^autopilot\/demo\/01$/);
  assert.match(pr.body, /\*\*Door:\*\* two-way/);
  assert.equal(draftWhileGating, true, "the pull request is a draft while the machine works");
  assert.equal(pr.draft, false, "gates passing marks it ready");
  assert.match(sh(fx.remote, "show", `${pr.branch}:.scratch/demo/handoff/01.md`), /\*\*Delivered:\*\* ticket 01/);
  assert.doesNotMatch(sh(fx.remote, "show", `${pr.branch}:${T("01")}`), /## Handoff/, "the ticket file is left to the tracker until the merge");
  assert.doesNotMatch(onTrunk(fx, T("01")), /^Autopilot:/m, "no progress line on the ticket");
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

test("an implementer that returns no handoff, or reports failure, gets a fix round before any review", async () => {
  const fx = oneTicket();
  const harness = fakeHarness(
    happyRoles({
      implementer: (ctx) => (ctx.call === 1 ? implementer({ handoff: false })(ctx) : ctx.call === 2 ? { ok: false, note: "tests would not run" } : implementer()(ctx)),
    }),
  );
  const report = await run(fx, harness, fakeForge(fx));
  const impl = harness.calls.filter((c) => c.role === "implementer");
  assert.equal(impl.length, 3);
  assert.match(impl[1].prompt, /^Finding to fix: the implementer returned no handoff$/m);
  assert.match(impl[2].prompt, /^Finding to fix: the implementer could not finish: tests would not run$/m);
  assert.equal(harness.calls.filter((c) => c.role === "verifier").length, 1, "review waits for a complete attempt");
  assert.equal(report.tickets[0].outcome, "merged");
});

// ---------- 09: pushes only with a lease on the run's own branch ----------

test("a push by someone else to the ticket branch while a run works stops the run instead of being overwritten", async () => {
  const fx = oneTicket();
  const rival = anotherClone(fx, "rival");
  const harness = fakeHarness(
    happyRoles({
      verifier: ({ call }) => (call === 1 ? { verdict: "FAIL", evidence: "needs a fix" } : PASS()),
      implementer: (ctx) => {
        if (ctx.call === 2) {
          sh(rival, "fetch", "-q", "origin");
          sh(rival, "checkout", "-q", "-B", "theirs", "origin/autopilot/demo/01");
          write(rival, { "src/theirs.js": "theirs\n" });
          sh(rival, "add", "-A");
          sh(rival, "commit", "-qm", "someone else");
          sh(rival, "push", "-q", "origin", "HEAD:autopilot/demo/01");
        }
        return implementer()(ctx);
      },
    }),
  );
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.match(report.tickets[0].reason, /someone else pushed/);
  assert.equal(sh(fx.remote, "show", "autopilot/demo/01:src/theirs.js"), "theirs", "their commit survives");
});

// ---------- 10: frontier and dependent tickets ----------

const T2 = (id, slug) => `.scratch/demo/issues/${id}-${slug}.md`;

function chain(extra = {}) {
  return repoFixture({
    [SPEC_PATH]: SPEC(),
    [T2("01", "base")]: TICKET("01", "Base"),
    [T2("02", "on-top")]: TICKET("02", "On top", { blockedBy: "01" }),
    ...extra,
  });
}

test("a dependent ticket starts only after its blocker merged, and reads the blocker's handoff", async () => {
  const fx = chain();
  let blockerClosedWhenBStarted = null;
  const harness = fakeHarness(
    happyRoles({
      implementer: (ctx) => {
        if (/^Ticket: .*02-on-top/m.test(ctx.prompt)) blockerClosedWhenBStarted = /\*\*Status:\*\* closed/.test(onTrunk(fx, T2("01", "base")));
        return implementer()(ctx);
      },
    }),
  );
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(blockerClosedWhenBStarted, true);
  const bPrompt = harness.calls.find((c) => c.role === "implementer" && /02-on-top/.test(c.prompt)).prompt;
  assert.match(bPrompt, new RegExp(`^Blocker handoff: ${T2("01", "base")}$`, "m"));
  assert.match(onTrunk(fx, "src/02.js"), /t02/);
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "merged"], ["02", "merged"]]);
});

test("a handoff conflict is followed and recorded, unless it touches the acceptance criteria", async () => {
  const minor = chain();
  const minorForge = fakeForge(minor);
  await run(minor, fakeHarness(happyRoles({ implementer: (ctx) => /02-on-top/.test(ctx.prompt) ? implementer({ output: { handoffConflict: { touchesAcceptance: false, note: "A named it totalCents" } } })(ctx) : implementer()(ctx) })), minorForge);
  assert.equal(minorForge.prs[1].state, "merged");
  assert.match(minorForge.prs[1].comments.join("\n"), /Handoff divergence: A named it totalCents/);

  const major = chain();
  const report = await run(major, fakeHarness(happyRoles({ implementer: (ctx) => /02-on-top/.test(ctx.prompt) ? implementer({ output: { handoffConflict: { touchesAcceptance: true, note: "A dropped the refund path B extends" } } })(ctx) : implementer()(ctx) })), fakeForge(major));
  const b = report.tickets.find((t) => t.id === "02");
  assert.equal(b.outcome, "ready-for-human");
  assert.match(b.reason, /A dropped the refund path/);
});

test("a ticket whose blocker went to the human stays blocked and is reported", async () => {
  const fx = chain();
  const harness = fakeHarness(happyRoles({ verifier: () => ({ verdict: "FAIL", evidence: "broken" }) }));
  const report = await run(fx, harness, fakeForge(fx), { maxFixRounds: 0 });
  assert.equal(harness.calls.filter((c) => c.role === "implementer").length, 1, "02 never started");
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "ready-for-human"], ["02", "blocked"]]);
  assert.match(report.tickets[1].reason, /01 \(ready-for-human\)/);
});

// ---------- 11: claim lock, parallel frontier, resume ----------

test("when another claimant's push lands first, the run backs off and leaves the ticket to them", async () => {
  const fx = oneTicket();
  const rival = anotherClone(fx, "rival");
  const file = path.join(rival, T("01"));
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("# 01: First thing\n", "# 01: First thing\n\nClaimed-by: rival@elsewhere\n"));
  sh(rival, "commit", "-qam", "rival claims 01");
  // The rival's claim reaches the remote just before ours does.
  const marker = path.join(fx.base, "rival-pushed");
  write(fx.clone, {
    ".git/hooks/pre-push": `#!/bin/sh\n[ -f "${marker}" ] && exit 0\ntouch "${marker}"\nenv -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "${rival}" push -q origin HEAD:main\n`,
  });
  fs.chmodSync(path.join(fx.clone, ".git/hooks/pre-push"), 0o755);

  const harness = fakeHarness(happyRoles());
  const report = await run(fx, harness, fakeForge(fx));
  assert.equal(harness.calls.length, 0, "no work on a ticket someone else holds");
  assert.deepEqual(report.tickets, []);
  assert.match(onTrunk(fx, T("01")), /Claimed-by: rival@elsewhere/);
  assert.doesNotMatch(onTrunk(fx, T("01")), /autopilot@test/);
});

test("independent tickets on the frontier run at the same time, up to the concurrency limit", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC(), [T2("01", "a")]: TICKET("01", "A"), [T2("02", "b")]: TICKET("02", "B"), [T2("03", "c")]: TICKET("03", "C") });
  let running = 0;
  let peak = 0;
  const harness = fakeHarness(
    happyRoles({
      implementer: async (ctx) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return implementer()(ctx);
      },
    }),
  );
  const report = await run(fx, harness, fakeForge(fx), { concurrency: 2 });
  assert.equal(peak, 2);
  assert.deepEqual(report.tickets.map((t) => t.outcome).sort(), ["merged", "merged", "merged"]);
});

test("a run on another machine picks up a ticket claimed under its name from the tracker and branch alone", async () => {
  const fx = oneTicket();
  // Machine A claimed the ticket and pushed a partial branch, then died.
  const a = anotherClone(fx, "machine-a");
  const file = path.join(a, T("01"));
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("# 01: First thing\n", "# 01: First thing\n\nClaimed-by: autopilot@test\nAutopilot: implementing\n"));
  sh(a, "commit", "-qam", "autopilot: claim 01");
  sh(a, "push", "-q", "origin", "HEAD:main");
  write(a, { "src/partial.js": "partial\n" });
  sh(a, "add", "-A");
  sh(a, "commit", "-qm", "partial work");
  sh(a, "push", "-q", "origin", "HEAD:refs/heads/autopilot/demo/01");

  const harness = fakeHarness(happyRoles());
  const forge = fakeForge(fx);
  const report = await run(fx, harness, forge);
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "merged"]]);
  assert.equal(onTrunk(fx, "src/partial.js"), "partial", "the earlier branch was continued, not discarded");
});

// ---------- 12: unattended ticket split ----------

function splitter(tickets, { touch } = {}) {
  return ({ cwd, prompt }) => {
    const dir = prompt.match(/^Issues dir: (.+)$/m)[1];
    for (const [file, text] of Object.entries(tickets)) write(cwd, { [path.posix.join(dir, file)]: text });
    if (touch) write(cwd, { [touch]: "x\n" });
    sh(cwd, "add", "-A");
    sh(cwd, "commit", "-qm", "split");
    return { ok: true, decisions: [{ decision: "split by user-visible behaviour", reason: "each slice demoable" }] };
  };
}

const twoWay = (id, title, opts = {}) => TICKET(id, title, { ...opts, extra: `\n**Door:** ${opts.door ?? "two-way"}\n` });

test("a small spec with no tickets is split unattended and then built", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC() });
  const harness = fakeHarness(happyRoles({ splitter: splitter({ "01-a.md": twoWay("01", "A"), "02-b.md": twoWay("02", "B", { blockedBy: "01" }) }) }));
  const report = await run(fx, harness, fakeForge(fx));
  const split = harness.calls.filter((c) => c.role === "splitter");
  assert.equal(split.length, 1);
  assert.match(split[0].prompt, /to-tickets\/SKILL\.md/);
  assert.match(split[0].prompt, /unattended/i);
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "merged"], ["02", "merged"]]);
  assert.match(onTrunk(fx, ".scratch/demo/trail/split.tsv"), /\tsplitter\tsplit by user-visible behaviour\teach slice demoable/);
});

test("a large spec stops for approval with its tickets in needs-triage, and resumes once approved", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC() });
  const tickets = { "01-a.md": twoWay("01", "A"), "02-b.md": twoWay("02", "Drop the legacy table", { door: "one-way", blockedBy: "01" }) };
  const harness = fakeHarness(happyRoles({ splitter: splitter(tickets) }));
  const first = await run(fx, harness, fakeForge(fx));
  assert.equal(first.status, "stopped");
  assert.match(first.reason, /approve/i);
  assert.match(first.reason, /one-way/);
  assert.equal(harness.calls.filter((c) => c.role === "implementer").length, 0);
  assert.match(onTrunk(fx, ".scratch/demo/issues/01-a.md"), /\*\*Status:\*\* needs-triage/);

  // The human approves only the first ticket.
  const human = anotherClone(fx, "human");
  const f = path.join(human, ".scratch/demo/issues/01-a.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("needs-triage", "ready-for-agent"));
  sh(human, "commit", "-qam", "approve 01");
  sh(human, "push", "-q", "origin", "HEAD:main");

  const second = await run(fx, harness, fakeForge(fx));
  assert.equal(harness.calls.filter((c) => c.role === "splitter").length, 1, "no re-split");
  assert.deepEqual(second.tickets.map((t) => [t.id, t.outcome]), [["01", "merged"], ["02", "needs-approval"]]);
});

test("more than five tickets, or one ticket blocking three others, also needs approval", async () => {
  const many = Object.fromEntries(["01", "02", "03", "04", "05", "06"].map((id) => [`${id}-t.md`, twoWay(id, `T${id}`)]));
  const fx = repoFixture({ [SPEC_PATH]: SPEC() });
  const report = await run(fx, fakeHarness(happyRoles({ splitter: splitter(many) })), fakeForge(fx));
  assert.match(report.reason, /6 tickets/);

  const hub = { "01-hub.md": twoWay("01", "Hub"), ...Object.fromEntries(["02", "03", "04"].map((id) => [`${id}-x.md`, twoWay(id, `X${id}`, { blockedBy: "01" })])) };
  const fx2 = repoFixture({ [SPEC_PATH]: SPEC() });
  const report2 = await run(fx2, fakeHarness(happyRoles({ splitter: splitter(hub) })), fakeForge(fx2));
  assert.match(report2.reason, /01 blocks 3/);
});

test("a split that touches anything outside the issues folder is refused", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC() });
  const report = await run(fx, fakeHarness(happyRoles({ splitter: splitter({ "01-a.md": twoWay("01", "A") }, { touch: "src/sneaky.js" }) })), fakeForge(fx));
  assert.equal(report.status, "stopped");
  assert.match(report.reason, /src\/sneaky\.js/);
  assert.throws(() => onTrunk(fx, ".scratch/demo/issues/01-a.md"));
});

// ---------- 13: decision trail and final report ----------

test("the decision trail is on the branch before CI checks the head that merges", async () => {
  const fx = oneTicket();
  const forge = fakeForge(fx);
  const heads = [];
  forge.ciStatus = async (n) => (heads.push(sh(fx.remote, "rev-parse", forge.prs[n - 1].branch)), "pass");
  const merge = forge.merge;
  let mergedHead = null;
  forge.merge = async (n) => ((mergedHead = sh(fx.remote, "rev-parse", forge.prs[n - 1].branch)), merge(n));
  await run(fx, fakeHarness(happyRoles()), forge);
  assert.equal(mergedHead, heads.at(-1), "no commit lands between the CI check and the merge");
  assert.match(sh(fx.remote, "show", `${mergedHead}:.scratch/demo/trail/01.tsv`), /\tautopilot\tmerge\t/);
});

test("each ticket's decision trail lands with it, and the report sorts every ticket by what it needs", async () => {
  const { renderReport } = await import("./lib/report.mjs");
  const fx = repoFixture({
    [SPEC_PATH]: SPEC(),
    [T2("01", "ok")]: TICKET("01", "Works"),
    [T2("02", "bad")]: TICKET("02", "Breaks"),
    [T2("03", "after-bad")]: TICKET("03", "After breaks", { blockedBy: "02" }),
    [T2("04", "unapproved")]: TICKET("04", "Not approved", { status: "needs-triage" }),
  });
  const harness = fakeHarness(happyRoles({ verifier: ({ prompt }) => (/02-bad/.test(prompt) ? { verdict: "FAIL", evidence: "crashes on save" } : PASS()) }));
  const forge = fakeForge(fx);
  const report = await run(fx, harness, forge, { maxFixRounds: 0 });

  const trail = onTrunk(fx, ".scratch/demo/trail/01.tsv").split("\n");
  assert.equal(trail[0], "time\tactor\tdecision\treason");
  assert.ok(trail.some((r) => /\timplementer\tbuilt 01\tticket asked for it$/.test(r)));
  assert.ok(trail.some((r) => /\tverifier\tPASS\t/.test(r)));
  assert.ok(trail.some((r) => /\tautopilot\tmerge\t/.test(r)));
  const badTrail = sh(fx.remote, "show", "autopilot/demo/02:.scratch/demo/trail/02.tsv");
  assert.match(badTrail, /\tverifier\tFAIL\tcrashes on save/);
  assert.match(badTrail, /\tautopilot\thand to human\t/);

  const text = renderReport(report);
  assert.match(text, /## Merged\n\n- 01 Works: https:\/\/example\.test\/pr\/1/);
  assert.match(text, /## Waiting for a human\n\n- 02 Breaks: verification FAIL: crashes on save \(https:\/\/example\.test\/pr\/2\)/);
  assert.match(text, /## Blocked\n\n- 03 After breaks: waiting on 02 \(ready-for-human\)/);
  assert.match(text, /## Needs approval\n\n- 04 Not approved/);
});

// ---------- review fixes ----------

test("an unexpected failure on one ticket hands it to the human and the run goes on", async () => {
  const fx = repoFixture({ [SPEC_PATH]: SPEC(), [T2("01", "a")]: TICKET("01", "A"), [T2("02", "b")]: TICKET("02", "B") });
  const forge = fakeForge(fx);
  const open = forge.openPr;
  forge.openPr = async (args) => {
    if (args.title.startsWith("01")) throw new Error("GitHub is down");
    return open(args);
  };
  const report = await run(fx, fakeHarness(happyRoles()), forge);
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["01", "ready-for-human"], ["02", "merged"]]);
  assert.match(report.tickets[0].reason, /GitHub is down/);
});

test("the merge policy is checked before waiting on CI", async () => {
  let ciAsked = 0;
  const fx = oneTicket({ verifyDoc: false });
  const forge = fakeForge(fx, { ci: () => (ciAsked++, "pass") });
  const report = await run(fx, fakeHarness(happyRoles()), forge);
  assert.equal(report.tickets[0].outcome, "ready-for-human");
  assert.equal(ciAsked, 0);
});
