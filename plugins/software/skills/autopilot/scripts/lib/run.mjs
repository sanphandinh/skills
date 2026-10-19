// The orchestrator: one run of a spec. It owns the ticket state machine,
// claiming, and pull requests; agents are reached only through the harness
// port and the forge only through the forge port.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, git, gitOk, listTree, patchId, show, worktree } from "./git.mjs";
import { POLICY_DOC, loadPolicy, refusals } from "./policy.mjs";
import { implementerPrompt, reviewPrompt, splitterPrompt, verifierPrompt } from "./prompts.mjs";
import { appendComment, getField, hasSection, parseTicket, removeField, setField, tickAll } from "./tracker.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";
const VERIFY_DOC = "docs/agents/verify.md";
// to-tickets ships in the same plugin; its unattended mode is read as a file
// because a user-invoked skill cannot be invoked by an agent.
const TO_TICKETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../to-tickets/SKILL.md");
const LARGE = { tickets: 5, fanOut: 3 };

export async function runAutopilot(opts) {
  const ctx = context(opts);
  fetch(ctx);
  const specText = show(ctx.repo, ctx.trunkRef, ctx.spec);
  if (specText === null) return { status: "refused", reason: `${ctx.spec} is not on ${ctx.trunkRef}`, tickets: [] };
  const specStatus = getField(specText, "Status");
  if (specStatus !== "ready-for-agent") {
    return { status: "refused", reason: `spec status is ${specStatus ?? "missing"}, not ready-for-agent`, tickets: [] };
  }

  if (!readTickets(ctx).length) {
    const split = await splitSpec(ctx);
    if (split) return split;
  }

  if (ctx.dryRun) {
    const ready = frontier(ctx, readTickets(ctx), new Map());
    return { status: "dry-run", tickets: ready.map((t) => ({ id: t.id, title: t.title, outcome: "ready" })) };
  }

  // Keep up to `concurrency` tickets in flight; after each finishes, re-read
  // trunk, because a merge may have unblocked more.
  const outcomes = new Map();
  const running = new Map();
  for (;;) {
    fetch(ctx);
    for (const ticket of frontier(ctx, readTickets(ctx), outcomes)) {
      if (running.size >= ctx.concurrency) break;
      if (running.has(ticket.id) || !claim(ctx, ticket)) continue;
      running.set(
        ticket.id,
        work(ctx, ticket).then((outcome) => {
          outcomes.set(ticket.id, outcome);
          running.delete(ticket.id);
        }),
      );
    }
    if (!running.size) break;
    await Promise.race(running.values());
  }
  return { status: "done", tickets: [...outcomes.values(), ...blocked(readTickets(ctx), outcomes)] };
}

// Split a spec that has no tickets. A large or risky breakdown is written as
// needs-triage and the run stops for the human; returns a report to stop with,
// or null to go on building.
async function splitSpec(ctx) {
  if (ctx.dryRun) return { status: "dry-run", tickets: [], reason: "the spec has no tickets yet; a real run would split it first" };
  const wt = worktree(ctx.repo, ctx.trunkRef);
  try {
    const result = await ctx.harness.run({
      role: "splitter",
      delegate: false,
      cwd: wt.dir,
      prompt: splitterPrompt({ spec: ctx.spec, issuesDir: ctx.issuesDir, toTickets: TO_TICKETS }),
    });
    if (!result.ok) return { status: "stopped", reason: `splitting the spec failed: ${result.output?.error ?? result.output?.note ?? "no reason given"}`, tickets: [] };
    const outside = changedFiles(wt.dir, ctx.trunkRef, "HEAD").filter((f) => !f.startsWith(`${ctx.issuesDir}/`));
    if (outside.length) return { status: "stopped", reason: `the split touched files outside ${ctx.issuesDir}: ${outside.join(", ")}`, tickets: [] };

    const tickets = fs
      .readdirSync(path.join(wt.dir, ctx.issuesDir))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => parseTicket(path.posix.join(ctx.issuesDir, f), fs.readFileSync(path.join(wt.dir, ctx.issuesDir, f), "utf8")));
    if (!tickets.length) return { status: "stopped", reason: "the split wrote no tickets", tickets: [] };
    const why = largeReasons(tickets);
    for (const t of tickets) {
      const status = why.length ? "needs-triage" : "ready-for-agent";
      fs.writeFileSync(path.join(wt.dir, t.rel), setField(t.text, "Status", status));
    }
    git(wt.dir, ["add", "-A", ctx.issuesDir]);
    git(wt.dir, ["commit", "-qm", `autopilot: split ${ctx.slug} into ${tickets.length} tickets`, "--allow-empty"]);
    for (let attempt = 0; !gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:${ctx.trunk}`]); attempt++) {
      if (attempt >= 4) return { status: "stopped", reason: "could not push the tickets to trunk", tickets: [] };
      fetch(ctx);
      git(wt.dir, ["rebase", "-q", ctx.trunkRef]);
    }
    fetch(ctx);
    if (!why.length) return null;
    return {
      status: "stopped",
      reason: `the breakdown needs approval (${why.join("; ")}): review the tickets in ${ctx.issuesDir}, set each one you approve to ready-for-agent, and run again`,
      tickets: tickets.map((t) => ({ id: t.id, title: t.title, outcome: "needs-triage" })),
    };
  } finally {
    wt.cleanup();
  }
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

// Tickets still waiting on a blocker that did not close.
function blocked(tickets, outcomes) {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return tickets
    .filter((t) => t.status === "ready-for-agent" && !outcomes.has(t.id))
    .map((t) => {
      const waiting = t.blockedBy.filter((b) => byId.get(b)?.status !== "closed").map((b) => `${b} (${byId.get(b)?.status ?? "missing"})`);
      return waiting.length ? { id: t.id, title: t.title, outcome: "blocked", reason: `waiting on ${waiting.join(", ")}` } : null;
    })
    .filter(Boolean);
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
  concurrency = 1,
  ciTimeoutMs = 30 * 60_000,
  ciPollMs = 30_000,
  budget = {},
  clock = Date.now,
}) {
  const slug = path.posix.basename(path.posix.dirname(spec));
  return {
    budget: { tokens: 3_000_000, timeMs: 2 * 60 * 60_000, ...budget },
    clock,
    state: new State(stateDir ?? defaultStateDir(repoDir), slug),
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

function readTickets(ctx) {
  return listTree(ctx.repo, ctx.trunkRef, ctx.issuesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const rel = path.posix.join(ctx.issuesDir, f);
      return parseTicket(rel, show(ctx.repo, ctx.trunkRef, rel));
    });
}

// Open tickets whose blockers are all closed on trunk, unclaimed or claimed
// under this run's own name (a run that died is resumed by the next one).
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
      if (after === "resume") return true;
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
    (text) => {
      const holder = getField(text, "Claimed-by");
      if (holder === ctx.who) return "resume";
      return holder ? null : setField(setField(text, "Claimed-by", ctx.who), "Autopilot", "implementing");
    },
    `autopilot: claim ${ticket.id}`,
    { retry: false },
  );
}

// The blockers' ticket files, whose handoff sections are on trunk once merged.
function blockerRels(ctx, ticket) {
  const files = listTree(ctx.repo, ctx.trunkRef, ctx.issuesDir);
  return ticket.blockedBy.map((b) => files.find((f) => f.startsWith(`${b}-`))).filter(Boolean).map((f) => path.posix.join(ctx.issuesDir, f));
}

class OverBudget extends Error {}

// Per-machine bookkeeping, kept outside the repository.
class State {
  constructor(dir, slug) {
    this.file = path.join(dir, `${slug}.json`);
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

async function work(ctx, ticket) {
  const branch = `autopilot/${ctx.slug}/${ticket.id}`;
  const head = `${ctx.remote}/${branch}`;
  // Continue a branch an earlier run pushed; otherwise cut it from trunk.
  const resumed = gitOk(ctx.repo, ["rev-parse", "--verify", "-q", head]);
  const wt = worktree(ctx.repo, resumed ? head : ctx.trunkRef, { branch });
  const done = (outcome, extra = {}) => ({ id: ticket.id, title: ticket.title, outcome, ...extra });
  let pr = resumed && ctx.forge.findPr ? await ctx.forge.findPr(branch) : null;
  let prBody = "";
  let findings = [];
  let gate;
  let lastPushed = resumed ? git(ctx.repo, ["rev-parse", head]) : "";
  const agent = budgeted(ctx, ticket);
  const st = ctx.state.ticket(ticket.id);
  try {
    for (let round = 0; ; round++) {
      st.rounds = round + 1;
      ctx.state.save();
      const result = await agent({
        role: "implementer",
        cwd: wt.dir,
        prompt: implementerPrompt({ spec: ctx.spec, ticket: ticket.rel, branch, trackerDoc: TRACKER_DOC, blockers: blockerRels(ctx, ticket), findings }),
      });
      const out = result.output ?? {};
      const conflict = out.handoffConflict;
      if (conflict?.touchesAcceptance) return handToHuman(ctx, ticket, pr, `a blocker's handoff contradicts the acceptance criteria: ${conflict.note}`, done);
      const incomplete = incompleteAttempt(wt.dir, ticket, result);
      if (incomplete) {
        findings = [incomplete];
        if (round >= ctx.maxFixRounds) return handToHuman(ctx, ticket, pr, incomplete, done);
        continue;
      }
      if (getField(fs.readFileSync(path.join(wt.dir, ticket.rel), "utf8"), "Status") !== "closed") close(wt.dir, ticket);
      // Force only over what this run pushed last; anyone else's push wins.
      if (!gitOk(wt.dir, ["push", "-q", `--force-with-lease=refs/heads/${branch}:${lastPushed}`, ctx.remote, `HEAD:refs/heads/${branch}`])) {
        return handToHuman(ctx, ticket, pr, `someone else pushed to ${branch}; autopilot will not overwrite it`, done);
      }
      lastPushed = git(wt.dir, ["rev-parse", "HEAD"]);
      fetch(ctx);
      prBody = out.prBody ?? prBody;
      pr ??= await ctx.forge.openPr({ branch, base: ctx.trunk, title: `${ticket.id}: ${ticket.title}`, body: prBody });
      if (conflict?.note) await ctx.forge.comment(pr.number, `Handoff divergence: ${conflict.note}`);

      gate = await gates(ctx, agent, ticket, pr, head);
      if (!gate.blocking.length) break;
      findings = gate.blocking;
      if (round >= ctx.maxFixRounds) return handToHuman(ctx, ticket, pr, findings.join("; "), done);
    }

    // A verdict covers one patch: anything pushed after it needs a fresh one.
    fetch(ctx);
    if (patchId(ctx.repo, ctx.trunkRef, head) !== gate.patch) {
      gate = await gates(ctx, agent, ticket, pr, head);
      fetch(ctx);
      if (gate.blocking.length) return handToHuman(ctx, ticket, pr, gate.blocking.join("; "), done);
      if (patchId(ctx.repo, ctx.trunkRef, head) !== gate.patch) return handToHuman(ctx, ticket, pr, "the branch keeps changing after verification", done);
    }

    const ci = await waitForCi(ctx, pr);
    if (ci !== "pass") return handToHuman(ctx, ticket, pr, `CI is ${ci}`, done);
    const refused = refusals(loadPolicy(show(ctx.repo, ctx.trunkRef, POLICY_DOC)), {
      verifyDoc: show(ctx.repo, ctx.trunkRef, VERIFY_DOC) !== null,
      prBody,
      changedFiles: changedFiles(ctx.repo, ctx.trunkRef, head),
    });
    if (refused.length) return handToHuman(ctx, ticket, pr, refused.join("; "), done);
    await ctx.forge.merge(pr.number);
    if (!(await ctx.forge.isMerged(pr.number))) return handToHuman(ctx, ticket, pr, "the merge did not land", done);
    return done("merged", { pr: pr.url });
  } catch (err) {
    if (err instanceof OverBudget) return handToHuman(ctx, ticket, pr, err.message, done);
    throw err;
  } finally {
    wt.cleanup();
  }
}

// Verifier and both reviewers, each in a fresh checkout of the pushed head.
// Returns the findings that block the merge.
async function gates(ctx, agent, ticket, pr, head) {
  const patch = patchId(ctx.repo, ctx.trunkRef, head);
  const check = worktree(ctx.repo, head);
  try {
    const verifyDoc = show(ctx.repo, ctx.trunkRef, VERIFY_DOC) === null ? null : VERIFY_DOC;
    const [verify, spec, standards] = await Promise.all([
      agent({ role: "verifier", cwd: check.dir, prompt: verifierPrompt({ spec: ctx.spec, ticket: ticket.rel, verifyDoc }) }),
      agent({ role: "review-spec", cwd: check.dir, prompt: reviewPrompt({ axis: "spec", spec: ctx.spec, ticket: ticket.rel, base: ctx.trunkRef }) }),
      agent({ role: "review-standards", cwd: check.dir, prompt: reviewPrompt({ axis: "standards", spec: ctx.spec, ticket: ticket.rel, base: ctx.trunkRef }) }),
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

// Why an implementer's attempt cannot go to review yet, or null.
function incompleteAttempt(dir, ticket, result) {
  if (!result.ok || result.output?.ok === false) {
    return `the implementer could not finish: ${result.output?.note ?? result.output?.error ?? "no reason given"}`;
  }
  if (!hasSection(fs.readFileSync(path.join(dir, ticket.rel), "utf8"), "Handoff")) return "the ticket has no ## Handoff section";
  return null;
}

// The close travels on the ticket branch so it lands with the code.
function close(dir, ticket) {
  const file = path.join(dir, ticket.rel);
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, tickAll(removeField(setField(text, "Status", "closed"), "Autopilot")));
  git(dir, ["add", ticket.rel]);
  git(dir, ["commit", "-qm", `autopilot: close ${ticket.id}`]);
}

