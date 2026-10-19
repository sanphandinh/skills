// The orchestrator: one run of a spec. It owns the ticket state machine,
// claiming, and pull requests; agents are reached only through the harness
// port and the forge only through the forge port.
import fs from "node:fs";
import path from "node:path";
import { git, gitOk, listTree, patchId, show, worktree } from "./git.mjs";
import { implementerPrompt, reviewPrompt, verifierPrompt } from "./prompts.mjs";
import { appendComment, getField, parseTicket, removeField, setField, tickAll } from "./tracker.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";
const VERIFY_DOC = "docs/agents/verify.md";

export async function runAutopilot(opts) {
  const ctx = context(opts);
  fetch(ctx);
  const specText = show(ctx.repo, ctx.trunkRef, ctx.spec);
  if (specText === null) return { status: "refused", reason: `${ctx.spec} is not on ${ctx.trunkRef}`, tickets: [] };
  const specStatus = getField(specText, "Status");
  if (specStatus !== "ready-for-agent") {
    return { status: "refused", reason: `spec status is ${specStatus ?? "missing"}, not ready-for-agent`, tickets: [] };
  }

  if (ctx.dryRun) {
    const ready = frontier(ctx, readTickets(ctx), new Map());
    return { status: "dry-run", tickets: ready.map((t) => ({ id: t.id, title: t.title, outcome: "ready" })) };
  }

  const outcomes = new Map();
  for (;;) {
    fetch(ctx);
    const next = frontier(ctx, readTickets(ctx), outcomes);
    if (!next.length) break;
    const ticket = next[0];
    if (!claim(ctx, ticket)) continue;
    outcomes.set(ticket.id, await work(ctx, ticket));
  }
  return { status: "done", tickets: [...outcomes.values()] };
}

function context({
  repoDir,
  spec,
  harness,
  forge,
  remote = "origin",
  trunk = "main",
  who = "autopilot",
  stateDir,
  dryRun = false,
  maxFixRounds = 2,
  ciTimeoutMs = 30 * 60_000,
  ciPollMs = 30_000,
}) {
  const slug = path.posix.basename(path.posix.dirname(spec));
  return {
    repo: repoDir,
    spec,
    slug,
    issuesDir: path.posix.join(path.posix.dirname(spec), "issues"),
    harness,
    forge,
    remote,
    trunk,
    trunkRef: `${remote}/${trunk}`,
    who,
    stateDir,
    dryRun,
    maxFixRounds,
    ciTimeoutMs,
    ciPollMs,
  };
}

function fetch(ctx) {
  git(ctx.repo, ["fetch", "-q", ctx.remote]);
}

function readTickets(ctx) {
  return listTree(ctx.repo, ctx.trunkRef, ctx.issuesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const rel = path.posix.join(ctx.issuesDir, f);
      return parseTicket(rel, show(ctx.repo, ctx.trunkRef, rel));
    });
}

function frontier(ctx, tickets, outcomes) {
  const closed = new Set(tickets.filter((t) => t.status === "closed").map((t) => t.id));
  return tickets.filter((t) => t.status === "ready-for-agent" && !t.claimedBy && !outcomes.has(t.id) && t.blockedBy.every((b) => closed.has(b)));
}

// Commit a tracker-only edit straight to trunk. A rejected push means trunk
// moved; with `retry` the edit is re-applied on the new trunk.
function editTrunk(ctx, rel, edit, message, { retry = true } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wt = worktree(ctx.repo, ctx.trunkRef);
    try {
      const file = path.join(wt.dir, rel);
      const before = fs.readFileSync(file, "utf8");
      const after = edit(before);
      if (after === null) return false;
      fs.writeFileSync(file, after);
      git(wt.dir, ["add", rel]);
      git(wt.dir, ["commit", "-qm", message]);
      if (gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:${ctx.trunk}`])) return true;
    } finally {
      wt.cleanup();
    }
    fetch(ctx);
    if (!retry) return false;
  }
  return false;
}

// The rejected push is the lock: whoever pushes the claim first owns the ticket.
function claim(ctx, ticket) {
  return editTrunk(
    ctx,
    ticket.rel,
    (text) => (getField(text, "Claimed-by") ? null : setField(setField(text, "Claimed-by", ctx.who), "Autopilot", "implementing")),
    `autopilot: claim ${ticket.id}`,
    { retry: false },
  );
}

async function work(ctx, ticket) {
  const branch = `autopilot/${ctx.slug}/${ticket.id}`;
  const head = `${ctx.remote}/${branch}`;
  const wt = worktree(ctx.repo, ctx.trunkRef, { branch });
  const done = (outcome, extra = {}) => ({ id: ticket.id, title: ticket.title, outcome, ...extra });
  let pr = null;
  let findings = [];
  try {
    for (let round = 0; ; round++) {
      const result = await ctx.harness.run({
        role: "implementer",
        cwd: wt.dir,
        prompt: implementerPrompt({ spec: ctx.spec, ticket: ticket.rel, trackerDoc: TRACKER_DOC, blockers: [], findings }),
      });
      const out = result.output ?? {};
      if (round === 0) close(wt.dir, ticket);
      git(wt.dir, ["push", "-q", "--force-with-lease", ctx.remote, `HEAD:${branch}`]);
      fetch(ctx);
      pr ??= await ctx.forge.openPr({ branch, base: ctx.trunk, title: `${ticket.id}: ${ticket.title}`, body: out.prBody ?? "" });

      const gate = await gates(ctx, ticket, pr, head);
      if (!gate.blocking.length) break;
      findings = gate.blocking;
      if (round >= ctx.maxFixRounds) return handToHuman(ctx, ticket, pr, findings.join("; "), done);
    }

    const ci = await waitForCi(ctx, pr);
    if (ci !== "pass") return handToHuman(ctx, ticket, pr, `CI is ${ci}`, done);
    await ctx.forge.merge(pr.number);
    if (!(await ctx.forge.isMerged(pr.number))) return handToHuman(ctx, ticket, pr, "the merge did not land", done);
    return done("merged", { pr: pr.url });
  } finally {
    wt.cleanup();
  }
}

// Verifier and both reviewers, each in a fresh checkout of the pushed head.
// Returns the findings that block the merge.
async function gates(ctx, ticket, pr, head) {
  const patch = patchId(ctx.repo, ctx.trunkRef, head);
  const check = worktree(ctx.repo, head);
  try {
    const verifyDoc = show(ctx.repo, ctx.trunkRef, VERIFY_DOC) === null ? null : VERIFY_DOC;
    const [verify, spec, standards] = await Promise.all([
      ctx.harness.run({ role: "verifier", cwd: check.dir, prompt: verifierPrompt({ spec: ctx.spec, ticket: ticket.rel, verifyDoc }) }),
      ctx.harness.run({ role: "review-spec", cwd: check.dir, prompt: reviewPrompt({ axis: "spec", spec: ctx.spec, ticket: ticket.rel, base: ctx.trunkRef }) }),
      ctx.harness.run({ role: "review-standards", cwd: check.dir, prompt: reviewPrompt({ axis: "standards", spec: ctx.spec, ticket: ticket.rel, base: ctx.trunkRef }) }),
    ]);
    const v = verify.output ?? {};
    const sp = spec.output ?? {};
    const st = standards.output ?? {};
    await ctx.forge.comment(pr.number, `Verdict: ${v.verdict ?? "none"}\nPatch: ${patch}\nEvidence: ${v.evidence ?? ""}`);
    await ctx.forge.comment(pr.number, `review-spec: ${sp.verdict ?? "none"}\n${listFindings(sp.findings)}`);
    await ctx.forge.comment(pr.number, `review-standards: ${st.verdict ?? "none"}\n${listFindings(st.findings)}`);

    const blocking = [];
    if (!["PASS", "PASS+NOTES"].includes(v.verdict)) blocking.push(`verification ${v.verdict ?? "missing"}: ${v.evidence ?? "no evidence"}`);
    if (sp.verdict !== "pass") blocking.push(...(sp.findings?.length ? sp.findings.map((f) => `spec ${f.kind}: ${f.requirement ?? f.detail}`) : ["spec review failed"]));
    for (const f of st.findings ?? []) if (f.severity === "hard") blocking.push(`standards: ${f.rule}: ${f.detail ?? ""}`);
    return { blocking, verdict: v.verdict, patch };
  } finally {
    check.cleanup();
  }
}

const listFindings = (findings = []) => findings.map((f) => `- ${Object.values(f).join(" | ")}`).join("\n");

async function waitForCi(ctx, pr) {
  const deadline = Date.now() + ctx.ciTimeoutMs;
  for (;;) {
    const status = await ctx.forge.ciStatus(pr.number);
    if (status !== "pending") return status;
    if (Date.now() > deadline) return "timed out";
    await new Promise((r) => setTimeout(r, ctx.ciPollMs));
  }
}

// Record on trunk that the ticket waits for the human, and say why on the PR.
async function handToHuman(ctx, ticket, pr, reason, done) {
  editTrunk(
    ctx,
    ticket.rel,
    (text) => appendComment(removeField(setField(text, "Status", "ready-for-human"), "Autopilot"), `Autopilot handed this to a human: ${reason}`),
    `autopilot: ${ticket.id} needs a human`,
  );
  if (pr) await ctx.forge.comment(pr.number, `Needs a human: ${reason}`);
  return done("ready-for-human", { pr: pr?.url, reason });
}

// The close travels on the ticket branch so it lands with the code.
function close(dir, ticket) {
  const file = path.join(dir, ticket.rel);
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, tickAll(removeField(setField(text, "Status", "closed"), "Autopilot")));
  git(dir, ["add", ticket.rel]);
  git(dir, ["commit", "-qm", `autopilot: close ${ticket.id}`]);
}

