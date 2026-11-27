import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as r from "./resources.mjs";
import { readMemory, renderShow } from "./roles.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "resources.mjs");
const T0 = "2026-11-27T10:00:00.000Z";
const at = (min) => new Date(Date.parse(T0) + min * 60_000).toISOString();

function project({ maxWorkers = 3, maxTickets, scarce = "none", wake = "15 minutes" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-res-"));
  const memory = path.join(root, "memory");
  fs.mkdirSync(path.join(root, "docs", "agents"), { recursive: true });
  const lines = [
    "# Factory",
    "",
    "Manager: t3",
    "Trunk: main",
    `Max workers: ${maxWorkers}`,
    ...(maxTickets ? [`Max tickets: ${maxTickets}`] : []),
    `Scarce resources: ${scarce}`,
    "Fix rounds: 2",
    "Conflict rounds: 3",
    `Wake timeout: ${wake}`,
    `Memory: ${memory}`,
    "",
  ];
  fs.writeFileSync(path.join(root, "docs", "agents", "factory.md"), lines.join("\n"));
  return root;
}

const ctx = (root, min = 0) => r.open(root, { now: at(min) });

function cli(root, args, min = 0) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [SCRIPT, ...args, "--root", root, "--now", at(min)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err, json: out ? JSON.parse(out) : null }));
  });
}

// ---------- settings ----------

test("settings: Max tickets defaults to Max workers, scarce resources and wake timeout parse", () => {
  const c = ctx(project({ maxWorkers: 2, scarce: "port-4317: 1, held by reviewer; sim: 2, held by worker" }));
  assert.equal(c.cfg.maxWorkers, 2);
  assert.equal(c.cfg.maxTickets, 2);
  assert.deepEqual(c.cfg.capacity, { slot: 2, "port-4317": 1, sim: 2, merge: 1 });
  assert.equal(c.cfg.wakeTimeoutMs, 15 * 60_000);
  assert.equal(ctx(project({ maxWorkers: 2, maxTickets: 5 })).cfg.maxTickets, 5);
});

// ---------- claims ----------

test("claim: a second claim of the same ticket is refused, and overlapping claim processes give one winner", async () => {
  const root = project();
  assert.equal(r.claim(ctx(root), 12).claimed, true);
  const again = r.claim(ctx(root, 1), 12);
  assert.equal(again.claimed, false);
  assert.equal(again.record.claimedAt, at(0));

  const runs = await Promise.all(Array.from({ length: 6 }, () => cli(root, ["claim", "13"])));
  assert.deepEqual(runs.map((x) => x.code), [0, 0, 0, 0, 0, 0]);
  assert.equal(runs.filter((x) => x.json.claimed).length, 1);
  const rec = r.getTicket(ctx(root), 13);
  assert.equal(rec.claimed, true);
  assert.equal(rec.state, "running");
  assert.equal(rec.due, at(15));
});

test("unclaim releases resources, clears planCleared, and a later claim starts again", () => {
  const root = project();
  r.claim(ctx(root), 4);
  r.checkPlan(ctx(root), 4, { files: ["a.js"], openPrs: [] });
  r.acquire(ctx(root), 4, "slot");
  const out = r.unclaim(ctx(root), 4, { state: "closed_unmerged" });
  assert.equal(out.record.claimed, false);
  assert.equal(out.record.planCleared, false);
  assert.equal(out.record.state, "closed_unmerged");
  assert.equal(out.record.due, null);
  assert.deepEqual(r.holdings(ctx(root), 4), []);
  assert.equal(r.claim(ctx(root, 5), 4).claimed, true);
  assert.equal(r.getTicket(ctx(root, 5), 4).claimedAt, at(5));
});

// ---------- due follows state ----------

test("due is set while running and cleared on held, waiting and parked", () => {
  const root = project();
  r.claim(ctx(root), 1);
  assert.equal(r.getTicket(ctx(root), 1).due, at(15));
  for (const state of ["held", "waiting", "parked", "closed_unmerged"]) {
    r.setTicket(ctx(root, 1), 1, { state: "running" });
    assert.equal(r.getTicket(ctx(root, 1), 1).due, at(16));
    r.setTicket(ctx(root, 2), 1, { state });
    assert.equal(r.getTicket(ctx(root, 2), 1).due, null, state);
  }
  r.setTicket(ctx(root, 3), 1, { state: "running", due: at(90) });
  assert.equal(r.getTicket(ctx(root, 3), 1).due, at(90));
});

// ---------- resources ----------

test("acquire out of order is refused: slot, then scarce resources by name, then merge", () => {
  const root = project({ scarce: "port: 1, held by reviewer; sim: 1, held by reviewer" });
  r.claim(ctx(root), 1);
  assert.equal(r.acquire(ctx(root), 1, "merge").granted, true);
  assert.throws(() => r.acquire(ctx(root), 1, "slot"), /order/);
  r.release(ctx(root), 1, "merge");
  assert.equal(r.acquire(ctx(root), 1, "sim").granted, true);
  assert.throws(() => r.acquire(ctx(root), 1, "port"), /order/);
  assert.throws(() => r.acquire(ctx(root), 1, "gpu"), /unknown resource/);
  assert.equal(r.acquire(ctx(root), 1, "merge").granted, true);
});

test("FIFO: a head asking for 2 slots is not overtaken by a later ticket asking for 1, and due source 5 waits for 2 free slots", () => {
  const root = project({ maxWorkers: 2 });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  assert.equal(r.acquire(ctx(root), 1, "slot").granted, true);
  const head = r.acquire(ctx(root, 1), 2, "slot", 2);
  assert.equal(head.granted, false);
  assert.equal(r.getTicket(ctx(root, 1), 2).state, "parked");
  assert.deepEqual(r.getTicket(ctx(root, 1), 2).parkedOn, ["slot"]);
  assert.equal(r.getTicket(ctx(root, 1), 2).due, null);
  // One slot is free, but ticket 3 queues behind the head.
  assert.equal(r.acquire(ctx(root, 2), 3, "slot").granted, false);
  // Only one slot free: the head cannot take it, so nothing is due for it.
  assert.equal(r.due(ctx(root, 3)).due.filter((d) => d.source === "queue").length, 0);
  const rel = r.release(ctx(root, 4), 1, "slot");
  assert.deepEqual(rel.notify, [{ ticket: 2, resource: "slot" }]);
  const granted = r.acquire(ctx(root, 5), 2, "slot", 2);
  assert.equal(granted.granted, true);
  assert.equal(r.getTicket(ctx(root, 5), 2).state, "running");
  assert.deepEqual(r.getTicket(ctx(root, 5), 2).parkedOn, []);
});

test("release without notifying anyone: the grantable head is due at once, and again 5 minutes after a notice it did not take", () => {
  const root = project({ maxWorkers: 1 });
  r.claim(ctx(root), 1);
  r.claim(ctx(root), 2);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 2, "slot");
  r.release(ctx(root, 1), 1, "slot"); // the releaser stops here, before it sends anything
  const due = r.due(ctx(root, 1)).due;
  assert.deepEqual(due.filter((d) => d.source === "queue"), [{ source: "queue", ticket: 2, resource: "slot", at: at(1) }]);
  r.notified(ctx(root, 1), 2, "slot");
  assert.equal(r.due(ctx(root, 3)).due.filter((d) => d.source === "queue").length, 0);
  assert.equal(r.due(ctx(root, 6)).due.filter((d) => d.source === "queue").length, 1);
});

test("renew extends every holding; a holding past its time only makes the dispatcher due, it is never reclaimed by the clock", () => {
  const root = project({ maxWorkers: 1 });
  r.claim(ctx(root), 1);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 1, "merge");
  r.renew(ctx(root, 10), 1);
  assert.equal(r.due(ctx(root, 20)).due.filter((d) => d.source === "holding").length, 0);
  const late = r.due(ctx(root, 40)).due.filter((d) => d.source === "holding");
  assert.deepEqual(late.map((d) => d.resource).sort(), ["merge", "slot"]);
  assert.equal(r.holdings(ctx(root, 40), 1).length, 2);
  r.claim(ctx(root), 2);
  assert.equal(r.acquire(ctx(root, 41), 2, "slot").granted, false);
});

test("reclaim releases every resource of the ticket, drops its queue places and its task, and names who to wake", () => {
  const root = project({ maxWorkers: 1, scarce: "port: 1, held by reviewer" });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 1, "port");
  r.setTicket(ctx(root), 1, { tasks: [{ taskId: "t1", childThreadId: "c1", step: "verify" }] });
  r.acquire(ctx(root), 2, "slot");
  r.acquire(ctx(root), 3, "port");
  const out = r.reclaim(ctx(root, 1), 1);
  assert.deepEqual(r.holdings(ctx(root, 1), 1), []);
  assert.deepEqual(r.getTicket(ctx(root, 1), 1).tasks, []);
  assert.deepEqual(out.notify.sort((a, b) => a.ticket - b.ticket), [
    { ticket: 2, resource: "slot" },
    { ticket: 3, resource: "port" },
  ]);
  // A parked ticket that is reclaimed leaves its queue, so the one behind it is next.
  r.claim(ctx(root), 4);
  r.acquire(ctx(root, 1), 4, "slot");
  r.reclaim(ctx(root, 2), 2);
  assert.equal(r.acquire(ctx(root, 2), 4, "slot").granted, true);
});

test("release names only the heads of the resource it released, and only those nobody told yet", () => {
  const root = project({ maxWorkers: 1 });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 1, "merge");
  r.release(ctx(root), 1, "merge");
  r.acquire(ctx(root), 2, "merge");
  r.acquire(ctx(root), 3, "slot");
  r.release(ctx(root), 2, "merge"); // merge is free; nobody queues for it
  // Ticket 4 queues on merge behind nobody; make it a head that was already told.
  r.claim(ctx(root), 4);
  r.acquire(ctx(root), 1, "merge");
  r.acquire(ctx(root), 4, "merge");
  r.release(ctx(root, 1), 1, "merge");
  r.notified(ctx(root, 1), 4, "merge");
  const out = r.release(ctx(root, 2), 1, "slot");
  assert.deepEqual(out.notify, [{ ticket: 3, resource: "slot" }]);
  assert.deepEqual(r.release(ctx(root, 2), 1, "slot"), { released: null, notify: [] });
});

test("acquire refuses a bigger count than held, a count that is not a whole number, and a second queue", () => {
  const root = project({ maxWorkers: 2 });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot");
  assert.equal(r.acquire(ctx(root), 1, "slot").already, true);
  assert.throws(() => r.acquire(ctx(root), 1, "slot", 2), /release it first/);
  assert.throws(() => r.acquire(ctx(root), 2, "slot", Number("abc")), /at most/);
  assert.throws(() => r.acquire(ctx(root), 2, "slot", 1.5), /at most/);
  r.acquire(ctx(root), 2, "slot");
  r.acquire(ctx(root), 3, "slot"); // parked on slot
  assert.throws(() => r.acquire(ctx(root), 3, "merge"), /waits in the queue of slot/);
});

test("release also takes a parked ticket out of its queue, so the one behind it moves up and is named", () => {
  const root = project({ maxWorkers: 1 });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 2, "slot"); // head of the queue, parked
  r.acquire(ctx(root), 3, "slot");
  const left = r.release(ctx(root, 1), 2, "slot"); // ticket 2 goes on hold instead
  assert.equal(left.left, true);
  assert.deepEqual(left.notify, []); // nothing free yet
  assert.deepEqual(r.getTicket(ctx(root, 1), 2).parkedOn, []);
  assert.equal(r.getTicket(ctx(root, 1), 2).state, "running");
  assert.doesNotThrow(() => r.acquire(ctx(root, 1), 2, "merge"));
  assert.deepEqual(r.release(ctx(root, 2), 1, "slot").notify, [{ ticket: 3, resource: "slot" }]);
});

test("release --count gives back part of a slot holding, as each of two workers reports", () => {
  const root = project({ maxWorkers: 2 });
  for (const n of [1, 2]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot", 2);
  r.acquire(ctx(root), 2, "slot");
  const first = r.release(ctx(root, 1), 1, "slot", 1);
  assert.deepEqual(first.notify, [{ ticket: 2, resource: "slot" }]);
  assert.equal(r.holdings(ctx(root, 1), 1)[0].count, 1);
  r.notified(ctx(root, 1), 2, "slot");
  assert.equal(r.acquire(ctx(root, 2), 2, "slot").granted, true);
  r.release(ctx(root, 3), 1, "slot", 1);
  assert.deepEqual(r.holdings(ctx(root, 3), 1), []);
  assert.throws(() => r.release(ctx(root), 1, "slot", 0), /whole number/);
});

test("unclaim clears landing", () => {
  const root = project();
  r.claim(ctx(root), 1);
  r.setTicket(ctx(root), 1, { landing: true });
  assert.equal(r.unclaim(ctx(root), 1).record.landing, false);
});

test("commands refuse missing or bad arguments instead of doing nothing", async () => {
  const root = project();
  r.claim(ctx(root), 1);
  assert.throws(() => r.notified(ctx(root), 1, "bogus"), /unknown resource/);
  assert.throws(() => r.notified(ctx(root), "#1", "slot"), /not a ticket/);
  assert.throws(() => r.renew(ctx(root), "#1"), /not a ticket/);
  assert.throws(() => r.lockThread(ctx(root), undefined), /required/);
  assert.throws(() => r.setDispatcherDue(ctx(root), undefined, "x"), /needs a time/);
  assert.throws(() => r.quotaBlock(ctx(root), undefined, { until: at(5) }), /required/);
  assert.throws(() => r.quotaBlock(ctx(root), "openai/gpt-5.5", { until: "soon" }), /needs a time/);
  assert.throws(() => r.claim(ctx(root), NaN), /not a ticket/);
  assert.equal((await cli(root, ["dispatcher-due", "set"])).code, 2);
  // Only the head of a queue is marked notified.
  const q = project({ maxWorkers: 1 });
  for (const n of [1, 2, 3]) r.claim(ctx(q), n);
  r.acquire(ctx(q), 1, "slot");
  r.acquire(ctx(q), 2, "slot");
  r.acquire(ctx(q), 3, "slot");
  assert.equal(r.notified(ctx(q), 3, "slot").notified, false);
});

test("ticket ids: numbers and tracker keys are taken, anything else is refused", async () => {
  const root = project();
  assert.equal(r.claim(ctx(root), "checkout-02").claimed, true);
  assert.equal(r.claim(ctx(root), "7").record.ticket, 7);
  assert.throws(() => r.claim(ctx(root), "#12"), /not a ticket/);
  assert.throws(() => r.claim(ctx(root), undefined), /not a ticket/);
  assert.deepEqual(r.tickets(ctx(root)).tickets.map((t) => t.ticket), [7, "checkout-02"]);
  const bad = await cli(root, ["claim", "--thread", "--now"]);
  assert.equal(bad.code, 2);
});

test("wake refuses an unclaimed ticket, and leaves a parked head alone while it cannot take what is free", () => {
  const root = project({ maxWorkers: 2 });
  assert.throws(() => r.wake(ctx(root), 9), /not claimed/);
  for (const n of [1, 2]) r.claim(ctx(root), n);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 2, "slot", 2);
  assert.equal(r.wake(ctx(root, 1), 2).action, "still-parked");
  assert.ok(r.due(ctx(root, 1)).due.every((d) => d.source !== "queue"));
  r.release(ctx(root, 2), 1, "slot");
  assert.equal(r.wake(ctx(root, 2), 2).action, "notified");
});

test("a ticket with an open pull request still blocks through its plan's files that the pull request does not touch yet", () => {
  const root = project();
  for (const n of [1, 2]) r.claim(ctx(root), n);
  r.setTicket(ctx(root), 1, { pr: 10 });
  const open = [{ number: 10, files: ["src/a.js"] }];
  assert.equal(r.checkPlan(ctx(root), 1, { files: ["src/a.js", "src/b.js"], openPrs: open }).cleared, true);
  const second = r.checkPlan(ctx(root), 2, { files: ["src/b.js"], openPrs: open });
  assert.equal(second.cleared, false);
  assert.deepEqual(second.waitingOn, ["ticket:1"]);
  const third = r.checkPlan(ctx(root), 2, { files: ["src/a.js", "src/b.js"], openPrs: open });
  assert.deepEqual(third.waitingOn, ["pr:10"]);
});

test("a stale lock is broken once when many processes find it at the same time", async () => {
  const root = project();
  const memory = r.open(root).memory;
  fs.mkdirSync(path.join(memory, "state.lock"), { recursive: true });
  fs.writeFileSync(path.join(memory, "state.lock", "owner.json"), JSON.stringify({ pid: 999999, token: "dead", at: T0 }));
  const runs = await Promise.all(Array.from({ length: 8 }, () => cli(root, ["claim", "21"])));
  assert.deepEqual(runs.map((x) => x.code), Array(8).fill(0));
  assert.equal(runs.filter((x) => x.json.claimed).length, 1);
  assert.equal(fs.existsSync(path.join(memory, "state.lock")), false);
});

// ---------- quota ----------

test("quota: blocks written by parallel processes all land, in the format roles.mjs reads, and prune drops expired ones", async () => {
  const root = project();
  const ids = ["google/gemini-4-carbon via=cursor", "anthropic/claude-opus-5-5", "openai/gpt-5.5", "xai/grok-4.7 via=cursor"];
  const runs = await Promise.all(
    ids.map((id, i) => cli(root, ["quota", "block", id, "--until", at(30 + i), "--ticket", "7", "--step", "build", "--words", "weekly usage"])),
  );
  assert.deepEqual(runs.map((x) => x.code), [0, 0, 0, 0]);
  const memory = r.open(root).memory;
  const { blocks } = readMemory(memory);
  const min = (t) => t.slice(0, 16) + "Z";
  for (const [i, id] of ids.entries()) assert.equal(blocks.get(id), min(at(30 + i)));
  const line = fs.readFileSync(path.join(memory, "quota.md"), "utf8").split("\n").find((l) => l.startsWith("openai/gpt-5.5"));
  assert.equal(line, `openai/gpt-5.5 | blocked until ${min(at(32))} | since ${min(at(0))} | 7 build | weekly usage`);
  assert.doesNotMatch(fs.readFileSync(path.join(memory, "quota.md"), "utf8"), /\n\n/);
  fs.writeFileSync(path.join(root, "docs", "agents", "roles.md"), "# Roles\n\nworker: openai/gpt-5.5 effort=high\n");
  assert.match(renderShow(root, { now: new Date(at(1)) }), new RegExp(`blocked until ${min(at(32))}`));
  assert.deepEqual(r.due(ctx(root, 31)).due.filter((d) => d.source === "quota").map((d) => d.candidate).sort(), [ids[1], ids[0]].sort());
  r.quotaPrune(ctx(root, 32));
  assert.deepEqual([...readMemory(memory).blocks.keys()], [ids[3]]);
});

// ---------- check-plan ----------

test("check-plan: two tickets checking at once with the same file, one clears and one waits on it; a parked ticket still counts", async () => {
  const root = project();
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  const runs = await Promise.all([
    cli(root, ["check-plan", "1", "--files", "src/a.js,src/b.js", "--open-prs", "[]"]),
    cli(root, ["check-plan", "2", "--files", "src/b.js", "--open-prs", "[]"]),
  ]);
  const cleared = runs.filter((x) => x.json.cleared);
  assert.equal(cleared.length, 1);
  const waiter = runs.find((x) => !x.json.cleared).json;
  const winner = cleared[0].json.ticket;
  assert.deepEqual(waiter.waitingOn, [`ticket:${winner}`]);
  assert.equal(r.getTicket(ctx(root), waiter.ticket).state, "waiting");
  assert.equal(r.getTicket(ctx(root), waiter.ticket).due, null);
  // The winner parks on a slot; its plan still blocks ticket 3.
  r.setTicket(ctx(root), winner, { state: "parked" });
  const third = r.checkPlan(ctx(root), 3, { files: ["src/b.js"], openPrs: [] });
  assert.equal(third.cleared, false);
  assert.deepEqual(third.waitingOn, [`ticket:${winner}`]);
});

test("check-plan: an open pull request blocks, the ticket's own pull request does not", () => {
  const root = project();
  r.claim(ctx(root), 5);
  r.setTicket(ctx(root), 5, { pr: 40 });
  const open = [
    { number: 40, files: ["src/a.js"] },
    { number: 41, files: ["src/c.js"] },
  ];
  // A rework round with a design finding revises the plan of a ticket that already has pull request 40.
  assert.equal(r.checkPlan(ctx(root), 5, { files: ["src/a.js"], openPrs: open }).cleared, true);
  const blocked = r.checkPlan(ctx(root), 5, { files: ["src/a.js", "src/c.js"], openPrs: open });
  assert.equal(blocked.cleared, false);
  assert.deepEqual(blocked.waitingOn, ["pr:41"]);
});

test("two tickets waiting on the same pull request: after it merges, rerunning check-plan lets only one go on", () => {
  const root = project();
  for (const n of [1, 2]) r.claim(ctx(root), n);
  const pr = [{ number: 9, files: ["src/x.js"] }];
  assert.equal(r.checkPlan(ctx(root), 1, { files: ["src/x.js"], openPrs: pr }).cleared, false);
  assert.equal(r.checkPlan(ctx(root), 2, { files: ["src/x.js"], openPrs: pr }).cleared, false);
  for (const n of [1, 2]) {
    const left = r.unwait(ctx(root, 5), n, ["pr:9"]);
    assert.deepEqual(left.waitingOn, []);
    assert.equal(r.wake(ctx(root, 5), n).action, "running");
  }
  const first = r.checkPlan(ctx(root, 6), 1, { files: ["src/x.js"], openPrs: [] });
  const second = r.checkPlan(ctx(root, 6), 2, { files: ["src/x.js"], openPrs: [] });
  assert.equal(first.cleared, true);
  assert.equal(second.cleared, false);
  assert.deepEqual(second.waitingOn, ["ticket:1"]);
});

// ---------- wake, status, lock ----------

test("wake: held and emptied waiting tickets run with a due; a parked queue head is only marked notified", () => {
  const root = project({ maxWorkers: 1 });
  for (const n of [1, 2, 3]) r.claim(ctx(root), n);
  r.setTicket(ctx(root), 1, { state: "held" });
  assert.equal(r.wake(ctx(root, 2), 1).action, "running");
  assert.equal(r.getTicket(ctx(root, 2), 1).due, at(17));
  r.setTicket(ctx(root), 2, { state: "waiting", waitingOn: ["trunk"] });
  assert.equal(r.wake(ctx(root, 2), 2).action, "still-waiting");
  r.unwait(ctx(root, 2), 2, ["trunk"]);
  assert.equal(r.wake(ctx(root, 3), 2).action, "running");
  assert.deepEqual(r.getTicket(ctx(root, 3), 2).waitingOn, []);
  r.acquire(ctx(root), 1, "slot");
  r.acquire(ctx(root), 3, "slot");
  r.release(ctx(root, 4), 1, "slot");
  assert.equal(r.wake(ctx(root, 4), 3).action, "notified");
  assert.equal(r.getTicket(ctx(root, 4), 3).state, "parked");
  assert.equal(r.due(ctx(root, 5)).due.filter((d) => d.source === "queue").length, 0);
});

test("status: going from paused to running makes stopped tickets due now and clears queue notices; quota-dated dues stay", () => {
  const root = project({ maxWorkers: 1 });
  for (const n of [1, 2, 3, 4, 5]) r.claim(ctx(root), n);
  r.setStatus(ctx(root), "paused");
  assert.equal(r.getStatus(ctx(root)).status, "paused");
  r.setTicket(ctx(root), 1, { state: "running", due: null }); // stopped while paused
  r.setTicket(ctx(root), 2, { state: "running", due: at(120) }); // waits for a quota block
  r.setTicket(ctx(root), 3, { state: "running", due: null, tasks: [{ taskId: "t", childThreadId: "c", step: "build" }] });
  r.acquire(ctx(root), 4, "slot");
  r.acquire(ctx(root), 5, "slot");
  r.release(ctx(root), 4, "slot");
  r.notified(ctx(root), 5, "slot");
  r.setStatus(ctx(root, 10), "running");
  assert.equal(r.getTicket(ctx(root, 10), 1).due, at(10));
  assert.equal(r.getTicket(ctx(root, 10), 2).due, at(120));
  assert.equal(r.getTicket(ctx(root, 10), 3).state, "running");
  assert.equal(r.getTicket(ctx(root, 10), 3).due, null); // a live worker will wake it
  assert.equal(r.due(ctx(root, 10)).due.filter((d) => d.source === "queue").length, 1);
});

test("dispatcher lock: held by the launcher, refused while live, taken over when expired or on reclaim", () => {
  const root = project();
  const a = r.lockAcquire(ctx(root), "watcher");
  assert.equal(a.acquired, true);
  r.lockThread(ctx(root), "thread-1");
  const b = r.lockAcquire(ctx(root, 5), "once");
  assert.equal(b.acquired, false);
  assert.equal(b.lock.thread, "thread-1");
  const c = r.lockAcquire(ctx(root, 6), "watcher", { reclaim: true });
  assert.equal(c.acquired, true);
  assert.equal(c.previous.thread, "thread-1");
  const d = r.lockAcquire(ctx(root, 30), "watcher");
  assert.equal(d.acquired, true);
  assert.equal(d.previous.launcher, "watcher");
  r.lockRelease(ctx(root, 31), { thread: "someone-else" });
  assert.notEqual(r.lockShow(ctx(root, 31)).lock, null);
  r.lockThread(ctx(root, 31), "thread-2");
  r.lockRelease(ctx(root, 31), { thread: "thread-2" });
  assert.equal(r.lockShow(ctx(root, 31)).lock, null);
});

test("due lists all five sources, and due --check exits 1 when nothing is due", async () => {
  const root = project({ maxWorkers: 1 });
  const quiet = await cli(root, ["due", "--check"]);
  assert.equal(quiet.code, 1);
  r.claim(ctx(root), 1); // due at 15
  r.claim(ctx(root), 2);
  r.acquire(ctx(root), 1, "slot"); // expires at 15
  r.acquire(ctx(root), 2, "slot");
  r.setTicket(ctx(root), 2, { state: "parked" });
  r.quotaBlock(ctx(root), "openai/gpt-5.5", { until: at(10), ticket: 1, step: "plan", words: "429" });
  r.setDispatcherDue(ctx(root), at(12), "trunk CI running");
  const sources = r.due(ctx(root, 16)).due.map((d) => d.source).sort();
  assert.deepEqual(sources, ["dispatcher", "holding", "quota", "ticket"]);
  r.release(ctx(root, 16), 1, "slot");
  assert.ok(r.due(ctx(root, 16)).due.some((d) => d.source === "queue"));
  const loud = await cli(root, ["due", "--check"], 16);
  assert.equal(loud.code, 0);
  assert.equal(r.due(ctx(root, 0)).next, at(10));
});

test("ack and lessons: acknowledged ids accumulate, and ingested results are not listed again", () => {
  const root = project();
  r.claim(ctx(root), 3);
  r.ack(ctx(root), 3, ["issue:1", "review:2"]);
  r.ack(ctx(root), 3, ["issue:1", "inline:5"]);
  assert.deepEqual(r.getTicket(ctx(root), 3).acked, ["issue:1", "review:2", "inline:5"]);
  const results = path.join(r.open(root).memory, "results");
  fs.mkdirSync(results, { recursive: true });
  fs.writeFileSync(path.join(results, "3-plan-1.json"), "{}");
  fs.writeFileSync(path.join(results, "3-build-1.json"), "{}");
  assert.deepEqual(r.lessonsPending(ctx(root)).pending, ["3-build-1.json", "3-plan-1.json"]);
  r.lessonsDone(ctx(root), ["3-plan-1.json"]);
  assert.deepEqual(r.lessonsPending(ctx(root)).pending, ["3-build-1.json"]);
});

test("tickets counts only running, parked and waiting claims toward Max tickets", () => {
  const root = project({ maxWorkers: 2 });
  for (const n of [1, 2, 3, 4, 5]) r.claim(ctx(root), n);
  r.setTicket(ctx(root), 2, { state: "held" });
  r.setTicket(ctx(root), 3, { state: "waiting", waitingOn: ["trunk"] });
  r.setTicket(ctx(root), 4, { state: "parked" });
  r.unclaim(ctx(root), 5, { state: "closed_unmerged" });
  const t = r.tickets(ctx(root));
  assert.equal(t.active, 3);
  assert.equal(t.maxTickets, 2);
  assert.equal(t.tickets.length, 5);
});

test("a lock left by a dead process is broken", () => {
  const root = project();
  const memory = r.open(root).memory;
  fs.mkdirSync(path.join(memory, "state.lock"), { recursive: true });
  fs.writeFileSync(path.join(memory, "state.lock", "owner.json"), JSON.stringify({ pid: 999999, at: T0 }));
  assert.equal(r.claim(ctx(root), 1).claimed, true);
});

test("the CLI prints JSON and exits 2 with a message on a refused order", async () => {
  const root = project();
  await cli(root, ["claim", "1"]);
  await cli(root, ["acquire", "1", "merge"]);
  const bad = await cli(root, ["acquire", "1", "slot"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /order/);
  const ok = await cli(root, ["ticket", "get", "1"]);
  assert.equal(ok.json.ticket, 1);
});
