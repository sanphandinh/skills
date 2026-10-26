// The orchestrator (ADR-0001). A tick reads the tracker and every ticket's
// pull request, picks the next runs, starts them, and exits; each run does one
// step for one ticket and leaves a run record on the pull request. Tickets are
// reached only through the tracker port, agents only through the harness
// port, and pull requests only through the forge port. `runAutopilot` keeps
// the manual mode: ticks over one spec until nothing is actionable.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brief } from "./brief.mjs";
import { CONFIG_DOC, loadConfig } from "./config.mjs";
import { changedFiles, conflicts, git, gitOk, isAncestor, patchId, show, worktree } from "./git.mjs";
import { releaseLease, takeLease } from "./lease.mjs";
import { Machine, defaultStateDir } from "./machine.mjs";
import { POLICY_DOC, isProtected, loadPolicy, refusals } from "./policy.mjs";
import { implementerPrompt, reviewPrompt, splitterPrompt, verifierPrompt } from "./prompts.mjs";
import { formatRecord, lastHandoff, parseRecords, sinceHuman, trailRows, usage } from "./records.mjs";
import { CHEAP, PRIORITY, TASK_OF, nextStep } from "./steps.mjs";
import { FIX_MARK, handoffBody, latestHumanNote, verifiable } from "./tracker.mjs";
import { scanTrackers } from "./trackers/index.mjs";
import { localTracker } from "./trackers/local.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";
const VERIFY_DOC = "docs/agents/verify.md";
// to-tickets ships in the same plugin; its unattended mode is read as a file
// because a user-invoked skill cannot be invoked by an agent.
const TO_TICKETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../to-tickets/SKILL.md");
const LARGE = { tickets: 5, fanOut: 3 };
const MAX_TICKS = 500;
const TRAIL_HEADER = "time\tactor\tdecision\treason\n";

class OverBudget extends Error {}

// ---------- entry points ----------

// One pass over the whole tracker (or over `opts.tracker` alone).
export async function tick(opts) {
  const ctx = context(opts);
  if (ctx.config.paused) {
    ctx.machine.log("paused");
    return { status: "paused", runs: [] };
  }
  if (!ctx.machine.lock()) return { status: "busy", runs: [] };
  try {
    const scanned = opts.tracker ? { trackers: [opts.tracker], standalone: opts.tracker } : await scanTrackers({ repoDir: ctx.repo, remote: ctx.remote, trunk: ctx.trunk, transport: opts.transport });
    return await tickOnce(ctx, scanned, { fileFixes: true });
  } finally {
    ctx.machine.unlock();
    ctx.machine.pruneRuns(Date.now());
  }
}

// The manual mode: tick over one spec until nothing is actionable, sleeping
// while only CI is pending, then report.
export async function runAutopilot(opts) {
  const ctx = context(opts);
  const tracker = ctx.tracker;
  fetch(ctx);
  const spec = await tracker.spec();
  if (!spec) return { status: "refused", reason: `${ctx.spec} was not found on the tracker`, tickets: [] };
  if (spec.status !== "ready-for-agent") {
    return { status: "refused", reason: `spec status is ${spec.status ?? "missing"}, not ready-for-agent`, tickets: [] };
  }

  if (ctx.dryRun) {
    if (!(await tracker.tickets()).length) return { status: "dry-run", tickets: [], reason: "the spec has no tickets yet; a real run would split it first" };
    const { items } = await survey(ctx, [tracker]);
    return { status: "dry-run", tickets: items.filter((i) => i.decision.step === "implement").map((i) => ({ id: i.ticket.id, title: i.ticket.title, outcome: "ready" })) };
  }

  const outcomes = new Map();
  const deadline = ctx.clock() + ctx.ciTimeoutMs;
  for (let n = 0; n < MAX_TICKS; n++) {
    const t = await tickOnce(ctx, { trackers: [tracker], standalone: null }, { fileFixes: false });
    for (const r of t.runs) if (r.id && REPORTED.has(r.outcome)) outcomes.set(r.id, r);
    const stop = t.runs.find((r) => r.outcome === "stopped");
    if (stop) return { status: "stopped", reason: stop.reason, tickets: stop.tickets ?? [] };
    if (!t.runs.length) break;
    if (t.runs.some((r) => PROGRESS.has(r.outcome))) continue;
    if (t.runs.some((r) => r.outcome === "wait-ci") && ctx.clock() < deadline) {
      await new Promise((r) => setTimeout(r, ctx.ciPollMs));
      continue;
    }
    break;
  }
  fetch(ctx);
  const tickets = await tracker.tickets();
  return { status: "done", tickets: [...outcomes.values(), ...blocked(tickets, outcomes)] };
}

// The board: what is in flight, what waits for the human, what is blocked,
// what merged in the last day, trunk, and today's tokens.
export async function status(opts) {
  const ctx = context(opts);
  fetch(ctx);
  const scanned = opts.tracker ? { trackers: [opts.tracker] } : await scanTrackers({ repoDir: ctx.repo, remote: ctx.remote, trunk: ctx.trunk, transport: opts.transport });
  const trunk = ctx.forge.trunkStatus ? await ctx.forge.trunkStatus(ctx.trunk) : { state: "none" };
  const { items } = await survey(ctx, scanned.trackers);
  const row = (i) => ({ id: i.ticket.id, title: i.ticket.title, group: i.tracker.key, pr: i.pr?.url ?? null, why: i.decision.why ?? null, step: i.decision.step });
  const since = ctx.clock() - 24 * 60 * 60_000;
  const merged = ctx.machine
    .logLines()
    .map((l) => l.split("\t"))
    .filter(([at, kind]) => kind === "merged" && Date.parse(at) >= since)
    .map(([, , id, pr]) => ({ id, pr }));
  return {
    paused: ctx.config.paused,
    trunk: trunk.state,
    inFlight: items.filter((i) => i.ticket.status === "ready-for-agent" && i.ticket.claimedBy).map(row),
    waiting: items.filter((i) => i.ticket.status === "ready-for-human").map(row),
    blocked: items.filter((i) => i.decision.step === "none" && /^waiting on/.test(i.decision.why ?? "")).map(row),
    needsTriage: items.filter((i) => i.ticket.status === "needs-triage").map(row),
    merged,
    tokensToday: ctx.machine.tokensToday(),
    tokensPerDay: ctx.config.tokensPerDay,
  };
}

// ---------- context ----------

function context(opts) {
  const {
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
    maxFixRounds,
    concurrency,
    ciTimeoutMs = 30 * 60_000,
    ciPollMs = 30_000,
    budget = {},
    clock = Date.now,
    workspaces,
  } = opts;
  const trunkRef = `${remote}/${trunk}`;
  git(repoDir, ["fetch", "-q", remote]);
  const config = loadConfig(show(repoDir, trunkRef, CONFIG_DOC));
  const machine = new Machine(stateDir ?? defaultStateDir(repoDir), clock);
  const limits = {
    fixRounds: maxFixRounds ?? config.fixRounds,
    tokens: budget.tokens ?? 3_000_000,
    timeMs: budget.timeMs ?? 2 * 60 * 60_000,
  };
  return {
    repo: repoDir,
    spec,
    remote,
    trunk,
    trunkRef,
    who,
    harness,
    forge,
    workspaces: workspaces ?? gitWorkspaces(repoDir),
    tracker: tracker ?? (spec ? localTracker({ repo: repoDir, remote, trunk, spec }) : null),
    config,
    limits,
    runsPerTick: Math.max(1, concurrency ?? (spec ? 1 : config.runsPerTick)),
    machine,
    clock,
    dryRun,
    ciTimeoutMs,
    ciPollMs,
    leaseTtlMs: limits.timeMs + 10 * 60_000,
    trunkRed: false,
  };
}

function fetch(ctx) {
  git(ctx.repo, ["fetch", "-q", "--prune", ctx.remote]);
}

// Workspace port: where an agent works. The default is a plain git worktree;
// Orca mode opens Orca-managed worktrees (see orca.mjs).
export function gitWorkspaces(repo) {
  return { open: async ({ ref, branch }) => worktree(repo, ref, branch ? { branch } : {}) };
}

const workspaceName = (item, step) => `ap-${item.tracker.key}-${item.ticket.id}-${step}-${Date.now().toString(36)}`.replace(/[^\w.-]+/g, "-");
const workspaceComment = (item, step) => `autopilot · ${item.ticket.id} ${item.ticket.title} · ${step}`;

// ---------- one tick ----------

const PROGRESS = new Set(["built", "gates-passed", "gates-failed", "updated", "merged", "ready-for-human", "needs-triage", "split", "spec-closed", "fix-filed", "rerun"]);
const REPORTED = new Set(["merged", "ready-for-human", "needs-triage", "wait-ci", "line-stopped"]);

async function tickOnce(ctx, { trackers, standalone }, { fileFixes }) {
  fetch(ctx);
  const runs = [];
  const trunk = await watchTrunk(ctx, standalone, { fileFixes });
  ctx.trunkRed = trunk.red;
  if (trunk.run) runs.push(trunk.run);

  const { groups, items } = await survey(ctx, trackers);
  const candidates = [];
  for (const group of groups) {
    if (group.spec.standalone || group.spec.status !== "ready-for-agent") continue;
    if (!group.tickets.length) candidates.push({ step: "decompose", group });
    else if (group.tickets.every((t) => t.status === "closed")) candidates.push({ step: "close-spec", group });
  }
  for (const item of items) if (item.decision.step !== "none") candidates.push({ step: item.decision.step, item });

  const inFlight = items.filter((i) => i.ticket.status === "ready-for-agent" && i.ticket.claimedBy).length;
  const waiting = items.filter((i) => i.ticket.status === "ready-for-human" && i.pr?.state === "open").length;
  const canStart = ctx.config.waitingForHuman == null || waiting < ctx.config.waitingForHuman;
  let slots = ctx.config.inFlight == null ? Infinity : Math.max(0, ctx.config.inFlight - inFlight);
  const tokensLeft = ctx.config.tokensPerDay == null || ctx.machine.tokensToday() < ctx.config.tokensPerDay;

  const chosen = [];
  candidates.forEach((c, order) => (c.order = order));
  for (const c of candidates.sort((a, b) => PRIORITY[a.step] - PRIORITY[b.step] || a.order - b.order)) {
    const task = TASK_OF[c.step];
    if (task && !ctx.config.tasks.includes(task)) continue;
    if (!tokensLeft && !CHEAP.has(c.step)) continue;
    if (c.step === "merge" && ctx.trunkRed) {
      runs.push(done(c.item, "line-stopped", { reason: "trunk is red; nothing merges until it is green" }));
      continue;
    }
    if (c.step === "decompose" && !canStart) continue;
    if (c.step === "implement" && c.item.ticket.claimedBy !== ctx.who) {
      if (!canStart || slots <= 0) continue;
      slots--;
    }
    chosen.push(c);
  }
  const cheap = chosen.filter((c) => CHEAP.has(c.step));
  const agents = chosen.filter((c) => !CHEAP.has(c.step)).slice(0, ctx.runsPerTick);
  for (const c of cheap) runs.push(await execute(ctx, c));
  runs.push(...(await Promise.all(agents.map((c) => execute(ctx, c)))));
  ctx.machine.log(`tick\t${runs.map((r) => `${r.id ?? r.group ?? "trunk"}:${r.outcome}`).join(" ") || "nothing to do"}`);
  return { status: "ticked", runs, trunk: trunk.state, waiting };
}

// Facts for every ticket of every approved spec and of the standalone group.
async function survey(ctx, trackers) {
  const groups = [];
  const items = [];
  for (const tracker of trackers) {
    const spec = await tracker.spec();
    if (!spec) continue;
    const tickets = await tracker.tickets();
    const group = { tracker, spec, tickets };
    groups.push(group);
    if (!spec.standalone && spec.status !== "ready-for-agent") continue;
    for (const ticket of tickets) items.push(await facts(ctx, group, ticket));
  }
  return { groups, items };
}

async function facts(ctx, group, ticket) {
  const { tracker, tickets } = group;
  const branch = `autopilot/${tracker.key}/${ticket.id}`;
  const head = `${ctx.remote}/${branch}`;
  const item = { group, tracker, ticket, branch, head, pr: null, records: [], prComments: [], patch: null };
  const active = ticket.status === "ready-for-agent" || ticket.status === "ready-for-human";
  item.branchExists = gitOk(ctx.repo, ["rev-parse", "--verify", "-q", head]);
  if (active) {
    item.pr = await ctx.forge.findPr(branch);
    if (item.pr) {
      // Only the pull request's author (autopilot's identity) writes run
      // records: a record anyone else posted, such as a forged passing
      // verdict, is ignored.
      item.prComments = (ctx.forge.comments ? await ctx.forge.comments(item.pr.number) : []).map((c) => (typeof c === "string" ? { body: c, author: null, trusted: true } : c));
      item.records = parseRecords(item.prComments.filter((c) => !item.pr.author || !c.author || c.author === item.pr.author).map((c) => c.body));
    }
  }
  if (item.branchExists) item.patch = patchId(ctx.repo, ctx.trunkRef, head);
  const conflict = item.pr?.state === "open" && item.branchExists ? conflicts(ctx.repo, ctx.trunkRef, head) : null;
  const blockers = [];
  for (const id of ticket.blockedBy ?? []) {
    const known = tickets.find((t) => t.id === id);
    blockers.push({ id, status: known ? known.status : ((await tracker.statusOf?.(id)) ?? null) });
  }
  let humanNote = null;
  if (ticket.status === "ready-for-agent" && lastHandoff(item.records) === "brief") {
    // Only people trusted on the repository steer a rework.
    const after = item.prComments.slice(item.prComments.findLastIndex((c) => /autopilot:record/.test(c.body)) + 1).filter((c) => c.trusted);
    humanNote = latestHumanNote(after.map((c) => c.body)) ?? (await tracker.humanNote?.(ticket)) ?? null;
  }
  item.humanNote = humanNote;
  item.decision = nextStep({
    ticket,
    me: ctx.who,
    blockers,
    verifiable: verifiable(ticket.body ?? ticket.text),
    branchExists: item.branchExists,
    pr: item.pr,
    records: item.records,
    patch: item.patch,
    conflict,
    humanNote,
    limits: ctx.limits,
  });
  return item;
}

// ---------- running one step ----------

const STEPS = { implement, rework, gates, merge, finish, human: (ctx, c) => human(ctx, c.item, c.item.decision.why), triage, decompose, "close-spec": closeSpec };

async function execute(ctx, c) {
  const name = c.item ? `${c.item.tracker.key}/${c.item.ticket.id}` : `${c.group.tracker.key}/spec`;
  const lease = takeLease(ctx.repo, ctx.remote, name, { who: ctx.who, step: c.step, now: ctx.clock(), ttlMs: ctx.leaseTtlMs });
  if (!lease) return c.item ? done(c.item, "leased") : { group: c.group.tracker.key, outcome: "leased" };
  try {
    return await STEPS[c.step](ctx, c);
  } catch (err) {
    if (!c.item) return { group: c.group.tracker.key, outcome: "error", reason: err.message };
    try {
      return await human(ctx, c.item, err instanceof OverBudget ? err.message : `autopilot hit an error: ${err.message}`);
    } catch (again) {
      return done(c.item, "error", { reason: `${err.message}; handing to the human also failed: ${again.message}` });
    }
  } finally {
    releaseLease(ctx.repo, ctx.remote, lease);
  }
}

const done = (item, outcome, extra = {}) => ({ id: item.ticket.id, title: item.ticket.title, outcome, ...extra });
const row = (ctx, actor, decision, reason = "") => [new Date(ctx.clock()).toISOString(), actor, decision, reason].map((v) => String(v ?? "").replace(/[\t\n\r]+/g, " ").trim());
const handoffPath = (item) => path.posix.join(item.tracker.stateDir, "handoff", `${item.ticket.id}.md`);
const trailPath = (item) => path.posix.join(item.tracker.trailDir, `${item.ticket.id}.tsv`);

// Every agent call for a ticket goes through this, so its budget (summed over
// the ticket's earlier runs) is enforced in one place.
function budgeted(ctx, item, base, workspace) {
  const started = ctx.clock();
  const run = { tokens: 0, started, orca: [] };
  const call = async (args) => {
    const result = await ctx.harness.run({ title: `${item.ticket.id} ${item.ticket.title} · ${args.role}`, workspace, ...args });
    if (result.ref?.orca) run.orca.push(result.ref.orca);
    run.tokens += result.tokens ?? 0;
    ctx.machine.addTokens(result.tokens ?? 0);
    run.log = ctx.machine.saveRun(`${item.tracker.key}-${item.ticket.id}-${args.role}`, { role: args.role, result });
    const tokens = base.tokens + run.tokens;
    if (tokens > ctx.limits.tokens) throw new OverBudget(`over the token budget (${tokens} > ${ctx.limits.tokens})`);
    const ms = base.ms + (ctx.clock() - started);
    if (ms > ctx.limits.timeMs) throw new OverBudget(`over the time budget (${Math.round(ms / 60_000)} min)`);
    return result;
  };
  call.cost = () => ({ tokens: run.tokens, ms: ctx.clock() - started, log: run.log, ...(run.orca.length ? { orca: run.orca } : {}) });
  return call;
}

async function record(ctx, item, pr, rec) {
  await ctx.forge.comment(pr.number, formatRecord({ ...rec, ticket: item.ticket.id, who: ctx.who, at: new Date(ctx.clock()).toISOString() }));
}

async function ensureClaim(ctx, item) {
  if (item.ticket.claimedBy === ctx.who) return true;
  return Boolean(await item.tracker.claim(item.ticket, ctx.who));
}

async function implement(ctx, { item }) {
  if (!(await ensureClaim(ctx, item))) return done(item, "skip", { reason: "someone else claimed it first" });
  return build(ctx, item, { kind: "implement", findings: [], counted: true });
}

async function rework(ctx, { item }) {
  if (!(await ensureClaim(ctx, item))) return done(item, "skip", { reason: "someone else claimed it first" });
  const d = item.decision;
  let records = item.records;
  if (d.humanReturn) {
    const rec = { kind: "human-return", note: item.humanNote, rows: [row(ctx, "human", "handed back", item.humanNote ?? "")] };
    await record(ctx, item, item.pr, rec);
    records = [...records, rec];
  }
  return build(ctx, item, { kind: "rework", findings: d.findings, counted: d.counted !== false, conflict: d.conflict, records });
}

// Implement or rework: one implementer run on the ticket branch, retried
// while the attempt is incomplete and fix rounds remain, then pushed.
async function build(ctx, item, { kind, findings, counted, conflict, records = item.records }) {
  const { tracker, ticket, branch, head } = item;
  const resumed = gitOk(ctx.repo, ["rev-parse", "--verify", "-q", head]);
  const wt = await ctx.workspaces.open({ ref: resumed ? head : ctx.trunkRef, branch, name: workspaceName(item, kind), comment: workspaceComment(item, kind) });
  const before = usage(records);
  // Fix rounds are implementer attempts after the first, since the human last
  // handed the ticket back; conflict reworks do not count.
  const priorAttempts = counted ? sinceHuman(records).filter((r) => r.counted !== false).reduce((n, r) => n + (Number(r.attempts) || 0), 0) : 0;
  const agent = budgeted(ctx, item, before, wt);
  const rows = [];
  const blockers = ticket.blockedBy.map((b) => item.group.tickets.find((t) => t.id === b) ?? { id: b, ref: b }).map(tracker.pointer);
  let pending = [...findings];
  let attempts = 0;
  let out = {};
  try {
    if (conflict) gitOk(wt.dir, ["merge", "--no-edit", ctx.trunkRef]);
    for (;;) {
      attempts++;
      const result = await agent({
        role: "implementer",
        cwd: wt.dir,
        prompt: implementerPrompt({ spec: specPointer(item), ticket: tracker.pointer(ticket), branch, trackerDoc: TRACKER_DOC, blockers, findings: pending }),
      });
      out = result.output ?? {};
      for (const d of out.decisions ?? []) rows.push(row(ctx, "implementer", d.decision, d.reason));
      const specProblem = out.specConflict?.note ?? (out.handoffConflict?.touchesAcceptance ? `a blocker's handoff contradicts the acceptance criteria: ${out.handoffConflict.note}` : null);
      if (specProblem) return await specConflict(ctx, item, specProblem, rows);
      const incomplete = incompleteAttempt(result) ?? (git(wt.dir, ["ls-files", "-u"]) ? "conflicts were left unresolved" : null);
      if (!incomplete) break;
      const allowed = counted ? priorAttempts + attempts <= ctx.limits.fixRounds : attempts <= ctx.limits.fixRounds;
      if (!allowed) return await human(ctx, item, incomplete);
      pending = [incomplete];
    }

    const handoff = handoffBody(out.handoff);
    const file = path.join(wt.dir, handoffPath(item));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${handoff}\n`);
    git(wt.dir, ["add", handoffPath(item)]);
    if (!gitOk(wt.dir, ["diff", "--cached", "--quiet"])) git(wt.dir, ["commit", "-qm", `autopilot: handoff for ${ticket.id}`]);
    // Build on what is there and never force: a rejected push means someone
    // else pushed while this run worked.
    if (!gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:refs/heads/${branch}`])) {
      return await human(ctx, item, `someone else pushed to ${branch}; autopilot will not overwrite it`);
    }
    fetch(ctx);
    let pr = item.pr?.state === "open" ? item.pr : null;
    // A fix round's body replaces the old one, so a corrected Merge Danger
    // section reaches the merge policy.
    if (pr && out.prBody && ctx.forge.updatePr) {
      const link = tracker.prLink(ticket);
      const body = link ? `${out.prBody}\n\n${link}\n` : out.prBody;
      if (body !== pr.body) {
        await ctx.forge.updatePr(pr.number, { body });
        pr = { ...pr, body };
        item.pr = pr;
      }
    }
    if (!pr) {
      const link = tracker.prLink(ticket);
      const body = out.prBody ?? "";
      const opened = await ctx.forge.openPr({ branch, base: ctx.trunk, title: `${ticket.id}: ${ticket.title}`, body: link ? `${body}\n\n${link}\n` : body, draft: true });
      pr = { ...opened, state: "open", draft: true };
      item.pr = pr;
    }
    if (out.handoffConflict?.note) {
      rows.push(row(ctx, "implementer", "followed a blocker's handoff over the ticket", out.handoffConflict.note));
      await ctx.forge.comment(pr.number, `Handoff divergence: ${out.handoffConflict.note}`);
    }
    const cost = agent.cost();
    await record(ctx, item, pr, { kind, patch: patchId(ctx.repo, ctx.trunkRef, head), attempts, counted, ...cost, rows, head: git(ctx.repo, ["rev-parse", head]) });
    ctx.machine.countTicket(tracker.key, ticket.id, { attempts, tokens: cost.tokens });
    return done(item, "built", { pr: pr.url });
  } finally {
    await wt.cleanup();
  }
}

// Verifier and both reviewers, each in a fresh checkout of the pushed head,
// on one patch; the verdict covers that patch only.
async function gates(ctx, { item }) {
  const { tracker, ticket, head, pr } = item;
  const patch = patchId(ctx.repo, ctx.trunkRef, head);
  const check = await ctx.workspaces.open({ ref: head, name: workspaceName(item, "gates"), comment: workspaceComment(item, "gates") });
  const ref = tracker.pointer(ticket);
  const spec = specPointer(item);
  const agent = budgeted(ctx, item, usage(item.records), check);
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
    const rows = [
      row(ctx, "verifier", v.verdict ?? "no verdict", v.evidence),
      row(ctx, "review-spec", sp.verdict ?? "no verdict", (sp.findings ?? []).map((f) => f.requirement ?? f.detail).join("; ")),
      row(ctx, "review-standards", st.verdict ?? "no verdict", (st.findings ?? []).map((f) => `${f.severity}: ${f.rule}`).join("; ")),
    ];
    const specProblem = sp.specConflict?.note ?? st.specConflict?.note;
    if (specProblem) return await specConflict(ctx, item, specProblem, rows);

    const blocking = [];
    if (!["PASS", "PASS+NOTES"].includes(v.verdict)) blocking.push(`verification ${v.verdict ?? "missing"}: ${v.evidence ?? "no evidence"}`);
    if (sp.verdict !== "pass") blocking.push(...(sp.findings?.length ? sp.findings.map((f) => `spec ${f.kind}: ${f.requirement ?? f.detail}`) : ["spec review failed"]));
    for (const f of st.findings ?? []) if (f.severity === "hard") blocking.push(`standards: ${f.rule}: ${f.detail ?? ""}`);
    if (!blocking.length) rows.push(row(ctx, "autopilot", "merge", `every gate passed on patch ${patch}`));
    const cost = agent.cost();
    const rec = { kind: "gates", patch, verdict: v.verdict ?? null, blocking, ...cost, rows };
    await record(ctx, item, pr, rec);
    ctx.machine.countTicket(tracker.key, ticket.id, { tokens: cost.tokens });
    if (!blocking.length) {
      // The trail lands now, so CI checks the very head that merges.
      if (!landTrail(ctx, item, trailRows([...item.records, rec]))) return human(ctx, item, "could not record the decision trail on the branch");
      if (pr.draft && ctx.forge.markReady) await ctx.forge.markReady(pr.number);
    }
    return done(item, blocking.length ? "gates-failed" : "gates-passed", { pr: pr.url });
  } finally {
    await check.cleanup();
  }
}

const listFindings = (findings = []) => findings.map((f) => `- ${Object.values(f).join(" | ")}`).join("\n");

// Trunk, merge policy, branch currency, CI, then merge. CI still running
// ends the run; a later tick looks again.
async function merge(ctx, { item }) {
  const { tracker, ticket, branch, head, pr } = item;
  const gate = item.decision.gate;
  if (ctx.trunkRed) return done(item, "line-stopped", { reason: "trunk is red; nothing merges until it is green" });
  const refused = refusals(loadPolicy(show(ctx.repo, ctx.trunkRef, POLICY_DOC)), {
    verifyDoc: show(ctx.repo, ctx.trunkRef, VERIFY_DOC) !== null,
    prBody: pr.body ?? "",
    changedFiles: changedFiles(ctx.repo, ctx.trunkRef, head),
  });
  if (FIX_MARK.test(ticket.body ?? "")) refused.push("fix pull requests always need a human");
  if (refused.length) return human(ctx, item, refused.join("; "), "policy");

  if (!isAncestor(ctx.repo, ctx.trunkRef, head)) {
    const wt = worktree(ctx.repo, head, { branch });
    try {
      if (!gitOk(wt.dir, ["merge", "-q", "--no-edit", ctx.trunkRef])) return done(item, "conflict", { reason: "trunk moved and now conflicts" });
      if (!gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:refs/heads/${branch}`])) return done(item, "skip", { reason: "the branch moved while updating it" });
    } finally {
      wt.cleanup();
    }
    fetch(ctx);
    const patch = patchId(ctx.repo, ctx.trunkRef, head);
    await record(ctx, item, pr, { kind: "update", patch, head: git(ctx.repo, ["rev-parse", head]) });
    if (patch !== gate.patch) return done(item, "updated", { pr: pr.url });
  }

  const ci = await ctx.forge.ciStatus(pr.number);
  if (ci === "pending") return done(item, "wait-ci", { pr: pr.url });
  if (ci !== "pass") return human(ctx, item, `CI is ${ci}`);

  // Normally already on the branch since the gates passed.
  if (!landTrail(ctx, item, trailRows(item.records))) return human(ctx, item, "could not record the decision trail on the branch");
  await ctx.forge.merge(pr.number);
  if (!(await ctx.forge.isMerged(pr.number))) return human(ctx, item, "the merge did not land");
  fetch(ctx);
  await record(ctx, item, pr, { kind: "merge", patch: gate.patch });
  await tracker.afterMerge(ticket, { handoff: readHandoff(ctx, item), pr });
  ctx.machine.log(`merged\t${ticket.id}\t${pr.url}`);
  return done(item, "merged", { pr: pr.url });
}

// A human merged the pull request: close the ticket and publish its handoff.
async function finish(ctx, { item }) {
  fetch(ctx);
  await item.tracker.afterMerge(item.ticket, { handoff: readHandoff(ctx, item), pr: item.pr });
  ctx.machine.log(`merged\t${item.ticket.id}\t${item.pr.url}`);
  return done(item, "merged", { pr: item.pr.url });
}

function readHandoff(ctx, item) {
  return handoffBody(show(ctx.repo, ctx.trunkRef, handoffPath(item)) ?? (item.branchExists ? show(ctx.repo, item.head, handoffPath(item)) : null) ?? "");
}

// The decision trail, a TSV committed on the ticket branch from the run
// records, so it lands with the code.
function landTrail(ctx, item, rows) {
  if (!gitOk(ctx.repo, ["rev-parse", "--verify", "-q", item.head])) return true;
  // Detached: the run that hands off may still hold the branch in its own
  // worktree.
  const wt = worktree(ctx.repo, item.head);
  try {
    const file = path.join(wt.dir, trailPath(item));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${TRAIL_HEADER}${rows.map((r) => `${r.join("\t")}\n`).join("")}`);
    git(wt.dir, ["add", trailPath(item)]);
    if (gitOk(wt.dir, ["diff", "--cached", "--quiet"])) return true;
    git(wt.dir, ["commit", "-qm", `autopilot: decision trail for ${item.ticket.id}`]);
    const ok = gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:refs/heads/${item.branch}`]);
    fetch(ctx);
    return ok;
  } finally {
    wt.cleanup();
  }
}

// Hand the ticket to the human with a brief: on the pull request when there
// is one, else on the ticket.
async function human(ctx, item, why, situation = "stuck") {
  const { tracker, ticket } = item;
  const pr = item.pr?.state === "open" ? item.pr : null;
  landTrail(ctx, item, [...trailRows(item.records), row(ctx, "autopilot", "hand to human", why)]);
  await tracker.handToHuman(ticket, why);
  const text = brief(situation, { why, links: [pr?.url, item.branchExists ? `branch ${item.branch}` : null] });
  if (pr) await ctx.forge.comment(pr.number, formatRecord({ kind: "brief", why, ticket: ticket.id, who: ctx.who, at: new Date(ctx.clock()).toISOString() }, text));
  else await tracker.comment?.(ticket, text);
  return done(item, "ready-for-human", { pr: pr?.url, reason: why });
}

// The ticket or its spec is wrong: send it to the human, say so on the spec,
// and spend no fix round.
async function specConflict(ctx, item, note, rows = []) {
  const why = note.startsWith("a blocker's handoff") ? note : `spec conflict: ${note}`;
  const pr = item.pr?.state === "open" ? item.pr : null;
  if (pr) await record(ctx, item, pr, { kind: "spec-conflict", note, rows });
  const where = item.group.spec.standalone ? item.ticket : null;
  await item.tracker.comment?.(where, `Autopilot found a spec conflict on ${item.tracker.pointer(item.ticket)}: ${note}`);
  return human(ctx, { ...item, records: [...item.records, { rows }] }, why, "spec");
}

async function triage(ctx, { item }) {
  const why = item.decision.why;
  await item.tracker.setStatus(item.ticket, "needs-triage", brief("triage", { why }));
  return done(item, "needs-triage", { reason: why });
}

function specPointer(item) {
  return item.group.spec.standalone ? item.tracker.pointer(item.ticket) : item.tracker.pointer({ ref: item.group.spec.ref });
}

function incompleteAttempt(result) {
  if (!result.ok || result.output?.ok === false) {
    return `the implementer could not finish: ${result.output?.note ?? result.output?.error ?? "no reason given"}`;
  }
  if (!String(result.output?.handoff ?? "").trim()) return "the implementer returned no handoff";
  return null;
}

// ---------- specs ----------

// Split a spec that has no tickets. A large or risky breakdown is written as
// needs-triage and stops for the human.
async function decompose(ctx, { group }) {
  const { tracker } = group;
  let why = [];
  const result = await tracker.split({
    open: ({ ref }) => ctx.workspaces.open({ ref, name: `ap-${tracker.key}-split-${Date.now().toString(36)}`, comment: `autopilot · split ${tracker.key}` }),
    runSplitter: (cwd, workspace) =>
      ctx.harness.run({
        role: "splitter",
        delegate: false,
        cwd,
        workspace,
        title: `split ${tracker.key}`,
        prompt: splitterPrompt({ spec: tracker.pointer({ ref: group.spec.ref }), trackerDoc: TRACKER_DOC, ...tracker.splitPrompt, toTickets: TO_TICKETS }),
      }),
    statusFor: (tickets) => {
      why = largeReasons(tickets);
      return why.length ? "needs-triage" : "ready-for-agent";
    },
    trailRows: (result) => {
      const rows = (result.output?.decisions ?? []).map((d) => row(ctx, "splitter", d.decision, d.reason));
      rows.push(row(ctx, "autopilot", why.length ? "stop for approval" : "build unattended", why.join("; ") || "small breakdown"));
      return `${TRAIL_HEADER}${rows.map((r) => r.join("\t")).join("\n")}\n`;
    },
  });
  if (result.stop) return { group: tracker.key, outcome: "stopped", reason: result.stop, tickets: [] };
  fetch(ctx);
  if (!why.length) return { group: tracker.key, outcome: "split" };
  const reason = `the breakdown needs approval (${why.join("; ")}): review the tickets, set each one you approve to ready-for-agent, and run again`;
  await tracker.comment?.(null, brief("approval", { why: reason }));
  return { group: tracker.key, outcome: "stopped", reason, tickets: result.tickets.map((t) => ({ id: t.id, title: t.title, outcome: "needs-triage" })) };
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

async function closeSpec(ctx, { group }) {
  const lines = [];
  for (const t of group.tickets) {
    const pr = await ctx.forge.findPr(`autopilot/${group.tracker.key}/${t.id}`);
    lines.push(`- ${t.id} ${t.title}${pr ? `: ${pr.url}` : ""}`);
  }
  await group.tracker.closeSpec(`## Autopilot finished this spec\n\nEvery ticket merged:\n\n${lines.join("\n")}\n`);
  return { group: group.tracker.key, outcome: "spec-closed" };
}

// ---------- stop the line ----------

// Trunk's CI: red blocks merges. A first red result is rerun once; a red that
// survives the rerun files one fix ticket (later reds comment on it) and,
// when it is safe, a revert pull request that never auto-merges.
async function watchTrunk(ctx, standalone, { fileFixes }) {
  if (!ctx.forge.trunkStatus) return { red: false, state: "none" };
  const s = await ctx.forge.trunkStatus(ctx.trunk);
  const red = s.state === "fail" || (s.state === "pending" && ctx.machine.reran(blame(ctx, s.sha)));
  if (!red || !fileFixes || !standalone || !ctx.config.tasks.includes("fix") || s.state !== "fail") return { red, state: s.state };
  // Tracker-only commits (claims, comments) cannot break CI: the red belongs
  // to the newest commit that changed anything else.
  const sha = blame(ctx, s.sha);
  const lease = takeLease(ctx.repo, ctx.remote, "trunk", { who: ctx.who, step: "fix", now: ctx.clock(), ttlMs: ctx.leaseTtlMs });
  if (!lease) return { red, state: s.state };
  try {
    const open = (await standalone.tickets()).find((t) => t.status !== "closed" && FIX_MARK.test(t.body ?? ""));
    if (open) {
      if (!ctx.machine.noted(`red-${sha}`)) {
        await standalone.comment(open, `Autopilot: trunk is still red at ${sha}.`);
        ctx.machine.markNoted(`red-${sha}`);
      }
      return { red, state: s.state };
    }
    if (!ctx.machine.reran(sha)) {
      await ctx.forge.rerunFailed(s.sha);
      ctx.machine.markRerun(sha);
      ctx.machine.log(`trunk\trerun\t${sha}`);
      return { red, state: s.state, run: { group: "trunk", outcome: "rerun", sha } };
    }
    const revert = await openRevert(ctx, sha);
    const body = [
      `<!-- autopilot:fix first-red=${sha} -->`,
      `Trunk CI failed at ${sha} and stayed red after a rerun. Nothing merges until it is green.`,
      ...(s.url ? ["", `CI log: ${s.url}`] : []),
      "",
      "## What to build",
      "",
      "Find why trunk CI fails and make it pass again without dropping the behaviour that broke it.",
      "",
      "- [ ] Trunk CI passes",
      "  Verify: the CI checks on trunk pass once the fix merges",
      "",
      "**Door:** two-way",
      ...(revert ? ["", `A revert is ready if you would rather undo the change: ${revert.url}`] : []),
    ].join("\n");
    const ticket = await standalone.createTicket({ title: `Fix trunk: CI is red at ${sha.slice(0, 7)}`, body });
    ctx.machine.markNoted(`red-${sha}`);
    ctx.machine.log(`trunk\tfix-filed\t${sha}`);
    return { red, state: s.state, run: { group: "trunk", outcome: "fix-filed", id: ticket?.id, title: ticket?.title, revert: revert?.url ?? null } };
  } finally {
    releaseLease(ctx.repo, ctx.remote, lease);
  }
}

const trackerOnly = (f) => f.startsWith(".scratch/") || f.startsWith(".autopilot/");

function blame(ctx, sha) {
  if (!sha) return sha;
  let shas;
  try {
    shas = git(ctx.repo, ["rev-list", "--first-parent", "-n", "50", sha]).split("\n").filter(Boolean);
  } catch {
    return sha;
  }
  for (const c of shas) {
    if (!gitOk(ctx.repo, ["rev-parse", "--verify", "-q", `${c}^`])) return c;
    if (changedFiles(ctx.repo, `${c}^`, c).some((f) => !trackerOnly(f))) return c;
  }
  return sha;
}

// A revert pull request for a red autopilot merge, only when it applies
// cleanly and the reverted change touched no protected path.
async function openRevert(ctx, sha) {
  const pr = ctx.forge.prForCommit ? await ctx.forge.prForCommit(sha) : null;
  if (!pr || !pr.branch.startsWith("autopilot/") || pr.branch.startsWith("autopilot/revert/")) return null;
  const policy = loadPolicy(show(ctx.repo, ctx.trunkRef, POLICY_DOC));
  if (changedFiles(ctx.repo, `${sha}^`, sha).some((f) => !trackerOnly(f) && isProtected(f, policy.protectedPaths))) return null;
  const branch = `autopilot/revert/${sha.slice(0, 12)}`;
  const wt = worktree(ctx.repo, ctx.trunkRef, { branch });
  try {
    if (!gitOk(wt.dir, ["revert", "--no-edit", sha])) return null;
    if (!gitOk(wt.dir, ["push", "-q", ctx.remote, `HEAD:refs/heads/${branch}`])) return null;
  } finally {
    wt.cleanup();
  }
  const why = `trunk CI failed at ${sha.slice(0, 12)}, the merge of pull request #${pr.number}, and stayed red after a rerun`;
  return ctx.forge.openPr({ branch, base: ctx.trunk, title: `Revert ${sha.slice(0, 7)}: trunk CI is red`, body: brief("fix", { why }), draft: false });
}

// ---------- report ----------

// Tickets still waiting on a blocker that did not close, and tickets waiting
// for the human to approve them.
function blocked(tickets, outcomes) {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const approval = tickets.filter((t) => t.status === "needs-triage" && !outcomes.has(t.id)).map((t) => ({ id: t.id, title: t.title, outcome: "needs-approval" }));
  return tickets
    .filter((t) => t.status === "ready-for-agent" && !outcomes.has(t.id))
    .map((t) => {
      const waiting = t.blockedBy.filter((b) => byId.get(b)?.status !== "closed").map((b) => `${b} (${byId.get(b)?.status ?? "missing"})`);
      return waiting.length ? { id: t.id, title: t.title, outcome: "blocked", reason: `waiting on ${waiting.join(", ")}` } : null;
    })
    .filter(Boolean)
    .concat(approval);
}
