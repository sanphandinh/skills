// The orchestrator: one run of a spec. It owns the ticket state machine,
// claiming, and pull requests; agents are reached only through the harness
// port and the forge only through the forge port.
import fs from "node:fs";
import path from "node:path";
import { git, gitOk, listTree, show, worktree } from "./git.mjs";
import { implementerPrompt } from "./prompts.mjs";
import { getField, parseTicket, removeField, setField, tickAll } from "./tracker.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";

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

function context({ repoDir, spec, harness, forge, remote = "origin", trunk = "main", who = "autopilot", stateDir, dryRun = false }) {
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
  const wt = worktree(ctx.repo, ctx.trunkRef, { branch });
  try {
    const result = await ctx.harness.run({
      role: "implementer",
      cwd: wt.dir,
      prompt: implementerPrompt({ spec: ctx.spec, ticket: ticket.rel, trackerDoc: TRACKER_DOC, blockers: [], findings: [] }),
    });
    const out = result.output ?? {};
    close(wt.dir, ticket);
    git(wt.dir, ["push", "-q", "--force-with-lease", ctx.remote, `HEAD:${branch}`]);
    const pr = await ctx.forge.openPr({ branch, base: ctx.trunk, title: `${ticket.id}: ${ticket.title}`, body: out.prBody ?? "" });
    return { id: ticket.id, title: ticket.title, outcome: "pr-open", pr: pr.url };
  } finally {
    wt.cleanup();
  }
}

// The close travels on the ticket branch so it lands with the code.
function close(dir, ticket) {
  const file = path.join(dir, ticket.rel);
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, tickAll(removeField(setField(text, "Status", "closed"), "Autopilot")));
  git(dir, ["add", ticket.rel]);
  git(dir, ["commit", "-qm", `autopilot: close ${ticket.id}`]);
}

