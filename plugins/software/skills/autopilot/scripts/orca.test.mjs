// Orca mode: runs in Orca worktrees, agents as Orca supervised workers.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { orcaHarness, orcaRepoId, orcaWorkspaces, relaunchInOrca } from "./lib/orca.mjs";
import { parseRecords } from "./lib/records.mjs";
import { tick } from "./lib/run.mjs";
import { PASS, SPEC, SPEC_OK, STANDARDS_OK, TICKET, fakeForge, fakeOrca, implementer, onTrunk, repoFixture, sh } from "./test-helpers.mjs";

const SPEC_PATH = ".scratch/demo/spec.md";
const T = ".scratch/demo/issues/01-thing.md";
const roles = (extra = {}) => ({ implementer: implementer(), verifier: PASS, "review-spec": SPEC_OK, "review-standards": STANDARDS_OK, ...extra });

function orcaMode(fx, handlers, { timeoutMs = 60_000 } = {}) {
  const { orca, state } = fakeOrca(fx, handlers);
  const forge = fakeForge(fx);
  const opts = async (extra = {}) => ({
    repoDir: fx.clone,
    forge,
    stateDir: fx.stateDir,
    who: "autopilot@test",
    harness: orcaHarness({ orca, agent: "omp", timeoutMs, pollMs: 50 }),
    workspaces: orcaWorkspaces({ orca, repoId: await orcaRepoId(orca, fx.clone), repoDir: fx.clone }),
    ...extra,
  });
  const ticks = async (max = 10) => {
    const runs = [];
    for (let i = 0; i < max; i++) {
      const t = await tick(await opts());
      runs.push(...t.runs);
      if (!t.runs.length) break;
    }
    return runs;
  };
  return { orca, state, forge, opts, ticks };
}

const oneTicket = (files = {}) => repoFixture({ [SPEC_PATH]: SPEC(), [T]: TICKET("01", "First thing"), ...files });

test("in Orca mode every agent runs as an Orca worker in an Orca worktree, and the pull request names its dispatches", async () => {
  const fx = oneTicket();
  const { state, forge, ticks } = orcaMode(fx, roles());
  await ticks();
  assert.equal(forge.prs[0].state, "merged");
  assert.match(onTrunk(fx, T), /\*\*Status:\*\* closed/);

  const workers = [...state.workers.values()];
  assert.deepEqual(workers.map((w) => w.role).sort(), ["implementer", "review-spec", "review-standards", "verifier"]);
  assert.ok(workers.every((w) => w.agent === "omp"));
  assert.match(workers.find((w) => w.role === "implementer").title, /^01 First thing · implementer$/);
  assert.match(workers.find((w) => w.role === "implementer").spec, /Delegate the whole task below to the `implementer` agent/);
  assert.ok(workers.every((w) => w.cwd.startsWith(path.join(fx.base, "orca"))), "agents work in Orca worktrees");
  assert.equal(state.calls.filter((c) => c[1] === "run-create").length, 2, "one Run per tick, even when the gates start three workers at once");
  assert.equal(new Set(workers.filter((w) => w.role !== "implementer").map((w) => w.run)).size, 1);

  const [impl, gates] = parseRecords(forge.prs[0].comments);
  assert.equal(impl.orca.length, 1);
  assert.equal(gates.orca.length, 3);
  assert.deepEqual(state.released.sort(), [...impl.orca, ...gates.orca].sort(), "succeeded workers are released");
  assert.ok([...state.worktrees.values()].every((w) => w.removed), "their worktrees are removed");
  assert.equal(sh(fx.clone, "status", "--porcelain"), "", "result files never reach git");
  assert.match(fs.readFileSync(path.join(fx.clone, ".git/info/exclude"), "utf8"), /^\/\.autopilot-out\/$/m);
});

test("a run whose worker failed keeps the worker and its worktree for debugging", async () => {
  const fx = oneTicket({ "docs/agents/autopilot.md": "Fix rounds per ticket: 0\n" });
  const { state, forge, ticks } = orcaMode(fx, roles({ implementer: () => ({ ok: false, note: "tests would not start" }) }));
  await ticks();
  assert.equal(forge.prs.length, 0);
  assert.match(onTrunk(fx, T), /\*\*Status:\*\* ready-for-human/);
  assert.match(onTrunk(fx, T), /tests would not start/);
  const [failed] = [...state.workers.keys()];
  assert.deepEqual(state.retained, [failed]);
  const [wt] = [...state.worktrees.values()];
  assert.equal(wt.removed, false);
  assert.match(wt.comment, /^kept for debugging: autopilot · 01 First thing · implement$/);
});

test("a worker's question gets the no-human answer, and the run goes on", async () => {
  const fx = oneTicket();
  const { state, forge, ticks } = orcaMode(
    fx,
    roles({
      implementer: async (ctx) => {
        ctx.ask("Should totals be in cents?");
        await new Promise((r) => setTimeout(r, 120));
        return implementer()(ctx);
      },
    }),
  );
  await ticks();
  assert.match(state.replies[0].body, /No human is available/);
  assert.equal(forge.prs[0].state, "merged");
});

test("a worker that never reports fails the attempt within the time budget and is stopped and retained", async () => {
  const fx = oneTicket({ "docs/agents/autopilot.md": "Fix rounds per ticket: 0\n" });
  const { state, ticks } = orcaMode(fx, roles({ implementer: () => ({ silent: true }) }), { timeoutMs: 200 });
  await ticks(2);
  const [stuck] = [...state.workers.keys()];
  assert.deepEqual(state.stopped, [stuck]);
  assert.deepEqual(state.retained, [stuck]);
  assert.match(onTrunk(fx, T), /did not report within/);
});

test("Orca mode refuses a repository that is not added to Orca", async () => {
  const fx = oneTicket();
  const { orca } = fakeOrca(fx, {}, { repoPath: "/somewhere/else" });
  await assert.rejects(orcaRepoId(orca, fx.clone), /is not added to Orca; run `orca repo add --path/);
});

test("without a coordinator terminal the command relaunches inside an Orca terminal, and its exit code and output come back", async () => {
  const fx = oneTicket();
  const { orca, state } = fakeOrca(fx, {});
  const r = await relaunchInOrca({ orca, repoDir: fx.clone, title: "autopilot tick", argv: ["sh", "-c", "echo \"it's me\"; exit 4"] });
  assert.equal(r.exitCode, 4, "the real exit code, not Orca's guess");
  assert.equal(r.output, "it's me\n");
  const create = state.calls.find((c) => c[0] === "terminal" && c[1] === "create");
  assert.equal(create[create.indexOf("--worktree") + 1], `path:${fx.clone}`);
  assert.match(state.terminalCommand, /^exec sh -c /, "exec ends the terminal with the command");
  assert.ok(state.calls.some((c) => c[0] === "terminal" && c[1] === "wait" && c.includes("exit")));
});
