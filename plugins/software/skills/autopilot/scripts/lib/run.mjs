// The orchestrator: one run of a spec. It owns the ticket state machine and
// the git work on ticket branches; tickets are reached only through the
// tracker port, agents only through the harness port, and pull requests only
// through the forge port.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, git, gitOk, patchId, show, worktree } from "./git.mjs";
import { POLICY_DOC, loadPolicy, refusals } from "./policy.mjs";
import { implementerPrompt, reviewPrompt, splitterPrompt, verifierPrompt } from "./prompts.mjs";
import { localTracker } from "./trackers/local.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";
const VERIFY_DOC = "docs/agents/verify.md";
// to-tickets ships in the same plugin; its unattended mode is read as a file
// because a user-invoked skill cannot be invoked by an agent.
const TO_TICKETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../to-tickets/SKILL.md");
const LARGE = { tickets: 5, fanOut: 3 };

export async function runAutopilot(opts) {
  const ctx = context(opts);
  fetch(ctx);
  const spec = await ctx.tracker.spec();
  if (!spec) return { status: "refused", reason: `${ctx.spec} was not found on the tracker`, tickets: [] };
  if (spec.status !== "ready-for-agent") {
    return { status: "refused", reason: `spec status is ${spec.status ?? "missing"}, not ready-for-agent`, tickets: [] };
  }

  if (!(await ctx.tracker.tickets()).length) {
    const split = await splitSpec(ctx);
    if (split) return split;
  }

  if (ctx.dryRun) {
    const ready = frontier(ctx, await ctx.tracker.tickets(), new Map());
    return { status: "dry-run", tickets: ready.map((t) => ({ id: t.id, title: t.title, outcome: "ready" })) };
  }

  // Keep up to `concurrency` tickets in flight; after each finishes, re-read
  // the tracker, because a merge may have unblocked more.
  const outcomes = new Map();
  const running = new Map();
  for (;;) {
    fetch(ctx);
    const tickets = await ctx.tracker.tickets();
    for (const ticket of frontier(ctx, tickets, outcomes)) {
      if (running.size >= ctx.concurrency) break;
      if (running.has(ticket.id) || !(await ctx.tracker.claim(ticket, ctx.who))) continue;
      running.set(
        ticket.id,
        work(ctx, ticket, tickets).then((outcome) => {
          outcomes.set(ticket.id, outcome);
          running.delete(ticket.id);
        }),
      );
    }
    if (!running.size) break;
    await Promise.race(running.values());
  }
  return { status: "done", tickets: [...outcomes.values(), ...blocked(await ctx.tracker.tickets(), outcomes)] };
}

// Split a spec that has no tickets. A large or risky breakdown is written as
// needs-triage and the run stops for the human; returns a report to stop with,
// or null to go on building.
async function splitSpec(ctx) {
  if (ctx.dryRun) return { status: "dry-run", tickets: [], reason: "the spec has no tickets yet; a real run would split it first" };
  let why = [];
  const result = await ctx.tracker.split({
    runSplitter: (cwd) =>
      ctx.harness.run({
        role: "splitter",
        delegate: false,
        cwd,
        prompt: splitterPrompt({ spec: ctx.tracker.pointer({ ref: ctx.spec }), trackerDoc: TRACKER_DOC, ...ctx.tracker.splitPrompt, toTickets: TO_TICKETS }),
      }),
    statusFor: (tickets) => {
      why = largeReasons(tickets);
      return why.length ? "needs-triage" : "ready-for-agent";
    },
    trailRows: (result) => {
      const when = new Date(ctx.clock()).toISOString();
      const rows = (result.output?.decisions ?? []).map((d) => [when, "splitter", d.decision, d.reason]);
      rows.push([when, "autopilot", why.length ? "stop for approval" : "build unattended", why.join("; ") || "small breakdown"]);
      return `time\tactor\tdecision\treason\n${rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ")).join("\t")).join("\n")}\n`;
    },
  });
  if (result.stop) return { status: "stopped", reason: result.stop, tickets: [] };
  fetch(ctx);
  if (!why.length) return null;
  return {
    status: "stopped",
    reason: `the breakdown needs approval (${why.join("; ")}): review the tickets, set each one you approve to ready-for-agent, and run again`,
    tickets: result.tickets.map((t) => ({ id: t.id, title: t.title, outcome: "needs-triage" })),
  };
}

function largeReasons(tickets) {
  const why = [];
  if (tickets.length > LARGE.tickets) why.push(`${tickets.length} tickets`);
  for (const t of tickets) if (t.door === "one-way") why.push(`${t.id} is a one-way door`);
  for (const t of tickets) {
    const fan = tickets.filter((o) => o.blockedBy.includes(t.id)).length;
    if (fan >= LARGE.fanOut) why.push(`${t.id} blocks ${fan} tickets`);
  }
  return why;
}

// Tickets still waiting on a blocker that did not close, and tickets waiting
// for the human to approve them.
function blocked(tickets, outcomes) {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const approval = tickets.filter((t) => t.status === "needs-triage").map((t) => ({ id: t.id, title: t.title, outcome: "needs-approval" }));
  return tickets
    .filter((t) => t.status === "ready-for-agent" && !outcomes.has(t.id))
    .map((t) => {
      const waiting = t.blockedBy.filter((b) => byId.get(b)?.status !== "closed").map((b) => `${b} (${byId.get(b)?.status ?? "missing"})`);
      return waiting.length ? { id: t.id, title: t.title, outcome: "blocked", reason: `waiting on ${waiting.join(", ")}` } : null;
    })
    .filter(Boolean)
    .concat(approval);
}

function context({
  repoDir,
  spec,
  harness,
  forge,
  tracker,
  remote = "origin",
  trunk = "main",
  who = "autopilot",
  stateDir,
  dryRun = false,
  maxFixRounds = 2,
  concurrency = 1,
  ciTimeoutMs = 30 * 60_000,
  ciPollMs = 30_000,
  budget = {},
  clock = Date.now,
}) {
  const t = tracker ?? localTracker({ repo: repoDir, remote, trunk, spec });
  return {
    budget: { tokens: 3_000_000, timeMs: 2 * 60 * 60_000, ...budget },
    clock,
    state: new State(stateDir ?? defaultStateDir(repoDir), t.key),
    repo: repoDir,
    spec,
    tracker: t,
    harness,
    forge,
    remote,
    trunk,
    trunkRef: `${remote}/${trunk}`,
    who,
    dryRun,
    maxFixRounds,
    concurrency: Math.max(1, concurrency),
    ciTimeoutMs,
    ciPollMs,
  };
}

function fetch(ctx) {
  git(ctx.repo, ["fetch", "-q", ctx.remote]);
}

// Open tickets whose blockers are all closed, unclaimed or claimed under this
// run's own name (a run that died is resumed by the next one).
function frontier(ctx, tickets, outcomes) {
  const closed = new Set(tickets.filter((t) => t.status === "closed").map((t) => t.id));
  return tickets.filter(
    (t) =>
      t.status === "ready-for-agent" &&
      (!t.claimedBy || t.claimedBy === ctx.who) &&
      !outcomes.has(t.id) &&
      t.blockedBy.every((b) => closed.has(b)),
  );
}

// The ticket's decision trail, a TSV committed with the code. It lands once,
// in a tracker-only commit rebased onto the branch head and pushed without
// force, so it never overwrites anyone's push.
class Trail {
  constructor(ctx, ticket) {
    this.ctx = ctx;
    this.rel = path.posix.join(ctx.tracker.trailDir, `${ticket.id}.tsv`);
    this.rows = [];
  }
  add(actor, decision, reason = "") {
    const cell = (v) => String(v ?? "").replace(/[\t\n\r]+/g, " ").trim();
    this.rows.push([new Date(this.ctx.clock()).toISOString(), actor, cell(decision), cell(reason)].join("\t"));
  }
  gate(g) {
    this.add("verifier", g.verify.verdict ?? "no verdict", g.verify.evidence);
    this.add("review-spec", g.spec.verdict ?? "no verdict", (g.spec.findings ?? []).map((f) => f.requirement ?? f.detail).join("; "));
    this.add("review-standards", g.standards.verdict ?? "no verdict", (g.standards.findings ?? []).map((f) => `${f.severity}: ${f.rule}`).join("; "));
  }
  land(dir, branch, lastPushed) {
    const { ctx } = this;
    fetch(ctx);
    const remoteHead = `${ctx.remote}/${branch}`;
    if (!gitOk(dir, ["merge-base", "--is-ancestor", lastPushed, remoteHead])) return false;
    git(dir, ["reset", "-q", "--hard", remoteHead]);
    const file = path.join(dir, this.rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "time\tactor\tdecision\treason\n";
    fs.writeFileSync(file, `${existing}${this.rows.map((r) => `${r}\n`).join("")}`);
    this.rows = [];
    git(dir, ["add", this.rel]);
    git(dir, ["commit", "-qm", `autopilot: decision trail for ${path.posix.basename(this.rel, ".tsv")}`]);
    const ok = gitOk(dir, ["push", "-q", ctx.remote, `HEAD:refs/heads/${branch}`]);
    fetch(ctx);
    return ok;
  }
}

class OverBudget extends Error {}

// Per-machine bookkeeping, kept outside the repository.
class State {
  constructor(dir, key) {
    this.file = path.join(dir, `${key}.json`);
    this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, "utf8")) : { tickets: {} };
  }
  ticket(id) {
    return (this.data.tickets[id] ??= { rounds: 0, tokens: 0 });
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}

function defaultStateDir(repo) {
  const base = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state");
  const id = createHash("sha1").update(path.resolve(repo)).digest("hex").slice(0, 8);
  return path.join(base, "autopilot", `${path.basename(path.resolve(repo))}-${id}`);
}

// Every agent call for a ticket goes through this, so the ticket's token and
// time budget is enforced in one place.
function budgeted(ctx, ticket) {
  const st = ctx.state.ticket(ticket.id);
  const started = ctx.clock();
  return async (call) => {
    const result = await ctx.harness.run(call);
    st.tokens += result.tokens ?? 0;
    st.updatedAt = new Date().toISOString();
    ctx.state.save();
    if (st.tokens > ctx.budget.tokens) throw new OverBudget(`over the token budget (${st.tokens} > ${ctx.budget.tokens})`);
    if (ctx.clock() - started > ctx.budget.timeMs) throw new OverBudget(`over the time budget (${Math.round((ctx.clock() - started) / 60_000)} min)`);
    return result;
  };
}

async function work(ctx, ticket, tickets) {
  const { tracker } = ctx;
  const branch = `autopilot/${tracker.key}/${ticket.id}`;
  const head = `${ctx.remote}/${branch}`;
  // Continue a branch an earlier run pushed; otherwise cut it from trunk.
  const resumed = gitOk(ctx.repo, ["rev-parse", "--verify", "-q", head]);
  const wt = worktree(ctx.repo, resumed ? head : ctx.trunkRef, { branch });
  const done = (outcome, extra = {}) => ({ id: ticket.id, title: ticket.title, outcome, ...extra });
  let pr = null;
  let prBody = "";
  let handoff = "";
  let findings = [];
  let gate;
  let lastPushed = resumed ? git(ctx.repo, ["rev-parse", head]) : "";
  const agent = budgeted(ctx, ticket);
  const st = ctx.state.ticket(ticket.id);
  const trail = new Trail(ctx, ticket);
  const blockers = ticket.blockedBy.map((b) => tickets.find((t) => t.id === b)).filter(Boolean).map(tracker.pointer);
  // Every exit records why, then lands the trail on the branch.
  const human = async (reason) => {
    trail.add("autopilot", "hand to human", reason);
    if (lastPushed) trail.land(wt.dir, branch, lastPushed);
    await tracker.handToHuman(ticket, reason);
    if (pr) await ctx.forge.comment(pr.number, `Needs a human: ${reason}`);
    return done("ready-for-human", { pr: pr?.url, reason });
  };
  try {
    if (resumed && ctx.forge.findPr) pr = await ctx.forge.findPr(branch);
    for (let round = 0; ; round++) {
      st.rounds = round + 1;
      ctx.state.save();
      const result = await agent({
        role: "implementer",
        cwd: wt.dir,
        prompt: implementerPrompt({ spec: tracker.pointer({ ref: ctx.spec }), ticket: tracker.pointer(ticket), branch, trackerDoc: TRACKER_DOC, blockers, findings }),
      });
      const out = result.output ?? {};
      for (const d of out.decisions ?? []) trail.add("implementer", d.decision, d.reason);
      const conflict = out.handoffConflict;
      if (conflict?.touchesAcceptance) return human(`a blocker's handoff contradicts the acceptance criteria: ${conflict.note}`);
      const incomplete = incompleteAttempt(result);
      if (incomplete) {
        findings = [incomplete];
        if (round >= ctx.maxFixRounds) return human(incomplete);
        continue;
      }
      handoff = out.handoff;
      tracker.onBranch(wt.dir, ticket, { handoff });
      // Force only over what this run pushed last; anyone else's push wins.
      if (!gitOk(wt.dir, ["push", "-q", `--force-with-lease=refs/heads/${branch}:${lastPushed}`, ctx.remote, `HEAD:refs/heads/${branch}`])) {
        return human(`someone else pushed to ${branch}; autopilot will not overwrite it`);
      }
      lastPushed = git(wt.dir, ["rev-parse", "HEAD"]);
      fetch(ctx);
      prBody = out.prBody ?? prBody;
      const link = tracker.prLink(ticket);
      pr ??= await ctx.forge.openPr({ branch, base: ctx.trunk, title: `${ticket.id}: ${ticket.title}`, body: link ? `${prBody}\n\n${link}\n` : prBody });
      if (conflict?.note) {
        trail.add("implementer", "followed a blocker's handoff over the ticket", conflict.note);
        await ctx.forge.comment(pr.number, `Handoff divergence: ${conflict.note}`);
      }

      gate = await gates(ctx, agent, ticket, pr, head);
      trail.gate(gate);
      if (!gate.blocking.length) break;
      findings = gate.blocking;
      if (round >= ctx.maxFixRounds) return human(findings.join("; "));
    }

    // A verdict covers one patch: anything pushed after it needs a fresh one.
    fetch(ctx);
    if (patchId(ctx.repo, ctx.trunkRef, head) !== gate.patch) {
      gate = await gates(ctx, agent, ticket, pr, head);
      trail.gate(gate);
      fetch(ctx);
      if (gate.blocking.length) return human(gate.blocking.join("; "));
      if (patchId(ctx.repo, ctx.trunkRef, head) !== gate.patch) return human("the branch keeps changing after verification");
    }

    const refused = refusals(loadPolicy(show(ctx.repo, ctx.trunkRef, POLICY_DOC)), {
      verifyDoc: show(ctx.repo, ctx.trunkRef, VERIFY_DOC) !== null,
      prBody,
      changedFiles: changedFiles(ctx.repo, ctx.trunkRef, head),
    });
    if (refused.length) return human(refused.join("; "));
    const ci = await waitForCi(ctx, pr);
    if (ci !== "pass") return human(`CI is ${ci}`);
    trail.add("autopilot", "merge", `every gate passed on patch ${gate.patch}`);
    if (!trail.land(wt.dir, branch, lastPushed)) return human("could not record the decision trail on the branch");
    await ctx.forge.merge(pr.number);
    if (!(await ctx.forge.isMerged(pr.number))) return human("the merge did not land");
    await tracker.afterMerge(ticket, { handoff, pr });
    return done("merged", { pr: pr.url });
  } catch (err) {
    // One ticket's failure must not strand the rest of an unattended run.
    return human(err instanceof OverBudget ? err.message : `autopilot hit an error: ${err.message}`);
  } finally {
    wt.cleanup();
  }
}

// Verifier and both reviewers, each in a fresh checkout of the pushed head.
// Returns the findings that block the merge.
async function gates(ctx, agent, ticket, pr, head) {
  const patch = patchId(ctx.repo, ctx.trunkRef, head);
  const check = worktree(ctx.repo, head);
  const ref = ctx.tracker.pointer(ticket);
  const spec = ctx.tracker.pointer({ ref: ctx.spec });
  try {
    const verifyDoc = show(ctx.repo, ctx.trunkRef, VERIFY_DOC) === null ? null : VERIFY_DOC;
    const [verify, specReview, standards] = await Promise.all([
      agent({ role: "verifier", cwd: check.dir, prompt: verifierPrompt({ spec, ticket: ref, verifyDoc }) }),
      agent({ role: "review-spec", cwd: check.dir, prompt: reviewPrompt({ axis: "spec", spec, ticket: ref, base: ctx.trunkRef }) }),
      agent({ role: "review-standards", cwd: check.dir, prompt: reviewPrompt({ axis: "standards", spec, ticket: ref, base: ctx.trunkRef }) }),
    ]);
    const v = verify.output ?? {};
    const sp = specReview.output ?? {};
    const st = standards.output ?? {};
    await ctx.forge.comment(pr.number, `Verdict: ${v.verdict ?? "none"}\nPatch: ${patch}\nEvidence: ${v.evidence ?? ""}`);
    await ctx.forge.comment(pr.number, `review-spec: ${sp.verdict ?? "none"}\n${listFindings(sp.findings)}`);
    await ctx.forge.comment(pr.number, `review-standards: ${st.verdict ?? "none"}\n${listFindings(st.findings)}`);

    const blocking = [];
    if (!["PASS", "PASS+NOTES"].includes(v.verdict)) blocking.push(`verification ${v.verdict ?? "missing"}: ${v.evidence ?? "no evidence"}`);
    if (sp.verdict !== "pass") blocking.push(...(sp.findings?.length ? sp.findings.map((f) => `spec ${f.kind}: ${f.requirement ?? f.detail}`) : ["spec review failed"]));
    for (const f of st.findings ?? []) if (f.severity === "hard") blocking.push(`standards: ${f.rule}: ${f.detail ?? ""}`);
    return { blocking, patch, verify: v, spec: sp, standards: st };
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

// Why an implementer's attempt cannot go to review yet, or null.
function incompleteAttempt(result) {
  if (!result.ok || result.output?.ok === false) {
    return `the implementer could not finish: ${result.output?.note ?? result.output?.error ?? "no reason given"}`;
  }
  if (!String(result.output?.handoff ?? "").trim()) return "the implementer returned no handoff";
  return null;
}
