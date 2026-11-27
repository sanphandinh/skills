#!/usr/bin/env node
// The factory's shared state in its memory folder: claims, resources, dues, the
// dispatcher lock, the run status and quota blocks. Every write goes through one
// lock (`<memory>/state.lock`), so the dispatcher and the coordinators of many
// tickets can write at once. Output is JSON on stdout.
//
//   node resources.mjs <command> [args] [--root <project>] [--now <ISO time>]
//
//   claim <n>                              claim ticket n (refused when already claimed)
//   unclaim <n> [--state <state>]          release the claim and every resource of n
//   ticket get <n> | ticket list           read records; `list` counts tickets toward Max tickets
//   ticket set <n> --json '<patch>'        merge fields into n's record (`state` moves `due`)
//   acquire <n> <resource> [--count k]     take a resource or join its queue (FIFO, head first)
//   release <n> <resource>                 give it back; prints who to notify
//   notified <n> <resource>                record that n, at the head of the queue, was told
//   renew <n>                              extend every holding of n by Wake timeout
//   reclaim <n>                            release everything n holds or queues for, drop its tasks
//   check-plan <n> --files <a,b> --open-prs '<[{number,files}]>'
//   unwait <n> <item>...                   remove finished items (pr:5, ticket:7, trunk) from waitingOn
//   wake <n>                               mark n running with a due, or notified when parked
//   ack <n> <id>...                        record comment ids as handled
//   status [get] | status set running|paused
//   lock acquire --launcher <who> [--reclaim] | lock thread <id> | lock release [--thread <id>] | lock show
//   dispatcher-due set <ISO> --reason <text> | dispatcher-due clear
//   quota block <candidate> --until <ISO> --ticket <n> --step <step> --words <text>
//   quota prune
//   due [--check]                          what is due now, and the next time something will be
//   lessons pending | lessons done <file>...
//
// The clock never reclaims anything: a holding past its time only makes the
// dispatcher due, and only `reclaim` releases a dead holder's resources.
// No dependencies: it runs from wherever the skill is installed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATES = ["running", "parked", "waiting", "held", "closed_unmerged"];
export const ACTIVE_STATES = ["running", "parked", "waiting"];
const NOTICE_MS = 5 * 60_000;
const LOCK_STALE_MS = 30_000;

export class Refused extends Error {}

// ---------- settings ----------

const expandHome = (p) => p.replace(/^~(?=$|\/)/, os.homedir());

function settingsFile(root) {
  return ["factory.md", "factory-v2.md"].map((f) => path.join(root, "docs", "agents", f)).find((f) => fs.existsSync(f));
}

function durationMs(text) {
  const m = String(text).match(/^(\d+)\s*(second|minute|hour|s|m|h|min)s?\b/i);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  const mult = unit.startsWith("h") ? 3_600_000 : unit.startsWith("s") && unit !== "min" ? 1000 : 60_000;
  return Number(m[1]) * mult;
}

export function loadConfig(root) {
  const file = settingsFile(root);
  if (!file) throw new Refused(`no docs/agents/factory.md under ${root}`);
  const text = fs.readFileSync(file, "utf8");
  const line = (key) => text.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"))?.[1];
  const memory = line("Memory");
  if (!memory) throw new Refused(`${file} has no Memory: line`);
  const maxWorkers = Number(line("Max workers") ?? 3);
  const maxTickets = Number(line("Max tickets") ?? maxWorkers);
  const scarce = {};
  const scarceText = line("Scarce resources") ?? "none";
  if (scarceText.toLowerCase() !== "none") {
    for (const m of scarceText.matchAll(/([a-z0-9][a-z0-9._-]*):\s*(\d+)/gi)) scarce[m[1]] = Number(m[2]);
  }
  const capacity = { slot: maxWorkers, ...Object.fromEntries(Object.keys(scarce).sort().map((k) => [k, scarce[k]])), merge: 1 };
  return {
    memory: expandHome(memory),
    maxWorkers,
    maxTickets,
    capacity,
    wakeTimeoutMs: durationMs(line("Wake timeout") ?? "15 minutes") ?? 15 * 60_000,
  };
}

// slot, then the scarce resources by name, then merge.
function rank(cfg, resource) {
  const order = Object.keys(cfg.capacity);
  const i = order.indexOf(resource);
  if (i < 0) throw new Refused(`unknown resource "${resource}"; known: ${order.join(", ")}`);
  return i;
}

export function open(root, { now } = {}) {
  const cfg = loadConfig(root);
  return { root, cfg, memory: cfg.memory, now: now ? new Date(now) : new Date() };
}

const iso = (d) => new Date(d).toISOString();
const plus = (c, ms) => iso(c.now.getTime() + ms);

// ---------- files and the lock ----------

const p = (c, ...parts) => path.join(c.memory, ...parts);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function withLock(c, fn) {
  fs.mkdirSync(c.memory, { recursive: true });
  const dir = p(c, "state.lock");
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: iso(Date.now()) }));
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const owner = readJson(path.join(dir, "owner.json"), null);
      let age = 0;
      try {
        age = Date.now() - fs.statSync(dir).mtimeMs;
      } catch {
        continue;
      }
      if ((owner && !alive(owner.pid)) || age > LOCK_STALE_MS || (!owner && age > 2000)) {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`state lock ${dir} still held by pid ${owner?.pid}`);
      sleep(10 + Math.floor(Math.random() * 20));
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- tickets ----------

const ticketFile = (c, n) => p(c, "state", "tickets", `${n}.json`);

function blankTicket(n) {
  return {
    ticket: n,
    claimed: false,
    claimedAt: null,
    thread: null,
    worktree: null,
    branch: null,
    pr: null,
    tasks: [],
    reworkRounds: 0,
    conflictRounds: 0,
    files_to_change: [],
    planCleared: false,
    state: null,
    parkedOn: [],
    waitingOn: [],
    due: null,
    acked: [],
  };
}

const readTicket = (c, n) => ({ ...blankTicket(n), ...readJson(ticketFile(c, n), {}) });
const writeTicket = (c, rec) => writeJson(ticketFile(c, rec.ticket), rec);

function allTickets(c) {
  const dir = p(c, "state", "tickets");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => readTicket(c, Number(f.slice(0, -5))))
    .sort((a, b) => a.ticket - b.ticket);
}

// A state change moves the due: running waits at most Wake timeout; a ticket that
// waits on a person, another ticket or a resource makes no wake of its own.
function applyPatch(c, rec, patch) {
  const next = { ...rec, ...patch };
  if ("state" in patch) {
    if (patch.state !== null && !STATES.includes(patch.state)) throw new Refused(`unknown state "${patch.state}"`);
    if (patch.state === "running") {
      if (!("due" in patch)) next.due = plus(c, c.cfg.wakeTimeoutMs);
      if (!("parkedOn" in patch)) next.parkedOn = [];
      if (!("waitingOn" in patch) && rec.state === "waiting") next.waitingOn = [];
    } else if (patch.state !== null) {
      next.due = null;
    }
  }
  return next;
}

export function getTicket(c, n) {
  return readTicket(c, Number(n));
}

export function setTicket(c, n, patch) {
  return withLock(c, () => {
    const rec = applyPatch(c, readTicket(c, Number(n)), patch);
    writeTicket(c, rec);
    return rec;
  });
}

export function claim(c, n, { thread = null } = {}) {
  return withLock(c, () => {
    const rec = readTicket(c, Number(n));
    if (rec.claimed) return { claimed: false, record: rec };
    const fresh = applyPatch(c, { ...blankTicket(Number(n)), acked: [] }, { state: "running" });
    Object.assign(fresh, { claimed: true, claimedAt: iso(c.now), thread });
    writeTicket(c, fresh);
    return { claimed: true, record: fresh };
  });
}

export function unclaim(c, n, { state } = {}) {
  return withLock(c, () => {
    const notify = reclaimLocked(c, Number(n));
    let rec = readTicket(c, Number(n));
    rec = applyPatch(c, rec, state ? { state } : {});
    Object.assign(rec, { claimed: false, planCleared: false, due: null, tasks: [], parkedOn: [], waitingOn: [] });
    writeTicket(c, rec);
    return { record: rec, notify };
  });
}

export function tickets(c) {
  const list = allTickets(c);
  const active = list.filter((t) => t.claimed && ACTIVE_STATES.includes(t.state)).length;
  return { tickets: list, active, maxTickets: c.cfg.maxTickets };
}

export function ack(c, n, ids) {
  return withLock(c, () => {
    const rec = readTicket(c, Number(n));
    for (const id of ids) if (!rec.acked.includes(id)) rec.acked.push(id);
    writeTicket(c, rec);
    return rec;
  });
}

// ---------- resources ----------

const resourceFile = (c, name) => p(c, "resources", `${name}.json`);
const readResource = (c, name) => ({ holders: [], queue: [], ...readJson(resourceFile(c, name), {}) });
const used = (res) => res.holders.reduce((s, h) => s + h.count, 0);
const free = (c, name, res) => c.cfg.capacity[name] - used(res);

export function holdings(c, n) {
  return Object.keys(c.cfg.capacity).flatMap((name) =>
    readResource(c, name)
      .holders.filter((h) => h.ticket === Number(n))
      .map((h) => ({ resource: name, ...h })),
  );
}

export function acquire(c, n, resource, count = 1) {
  n = Number(n);
  count = Number(count);
  return withLock(c, () => {
    const r = rank(c.cfg, resource);
    if (count < 1 || count > c.cfg.capacity[resource]) throw new Refused(`${resource} has ${c.cfg.capacity[resource]} at most; asked for ${count}`);
    const held = holdings(c, n);
    if (held.some((h) => h.resource === resource)) return { granted: true, already: true, resource };
    const higher = held.filter((h) => rank(c.cfg, h.resource) > r);
    if (higher.length) throw new Refused(`order: ticket ${n} holds ${higher.map((h) => h.resource).join(", ")}, so it cannot ask for ${resource} now; the order is ${Object.keys(c.cfg.capacity).join(" → ")}`);
    const res = readResource(c, resource);
    const place = res.queue.findIndex((q) => q.ticket === n);
    const isHead = res.queue.length === 0 || place === 0;
    const rec = readTicket(c, n);
    if (isHead && free(c, resource, res) >= count) {
      if (place === 0) res.queue.shift();
      res.holders.push({ ticket: n, count, since: iso(c.now), expires: plus(c, c.cfg.wakeTimeoutMs) });
      writeJson(resourceFile(c, resource), res);
      const parkedOn = rec.parkedOn.filter((x) => x !== resource);
      const patch = rec.state === "parked" && parkedOn.length === 0 ? { state: "running", parkedOn } : { parkedOn };
      writeTicket(c, applyPatch(c, rec, patch));
      return { granted: true, resource, count };
    }
    if (place < 0) res.queue.push({ ticket: n, count, since: iso(c.now), notifiedAt: null });
    writeJson(resourceFile(c, resource), res);
    const parkedOn = [...new Set([...rec.parkedOn, resource])];
    writeTicket(c, applyPatch(c, rec, { state: "parked", parkedOn }));
    return { granted: false, resource, position: res.queue.findIndex((q) => q.ticket === n) };
  });
}

// The heads that can take what is free now and have not been told yet.
function grantableHeads(c) {
  const out = [];
  for (const name of Object.keys(c.cfg.capacity)) {
    const res = readResource(c, name);
    const head = res.queue[0];
    if (head && free(c, name, res) >= head.count) out.push({ ticket: head.ticket, resource: name, head });
  }
  return out;
}

function releaseLocked(c, n, resource) {
  const res = readResource(c, resource);
  const before = res.holders.length;
  res.holders = res.holders.filter((h) => h.ticket !== n);
  if (res.holders.length !== before) writeJson(resourceFile(c, resource), res);
}

export function release(c, n, resource) {
  return withLock(c, () => {
    rank(c.cfg, resource);
    releaseLocked(c, Number(n), resource);
    return { released: resource, notify: grantableHeads(c).map(({ ticket, resource }) => ({ ticket, resource })) };
  });
}

export function notified(c, n, resource) {
  return withLock(c, () => {
    const res = readResource(c, resource);
    const q = res.queue.find((x) => x.ticket === Number(n));
    if (!q) return { notified: false };
    q.notifiedAt = iso(c.now);
    writeJson(resourceFile(c, resource), res);
    return { notified: true };
  });
}

export function renew(c, n) {
  return withLock(c, () => {
    const out = [];
    for (const name of Object.keys(c.cfg.capacity)) {
      const res = readResource(c, name);
      let changed = false;
      for (const h of res.holders.filter((h) => h.ticket === Number(n))) {
        h.expires = plus(c, c.cfg.wakeTimeoutMs);
        changed = true;
        out.push(name);
      }
      if (changed) writeJson(resourceFile(c, name), res);
    }
    return { renewed: out };
  });
}

function reclaimLocked(c, n) {
  for (const name of Object.keys(c.cfg.capacity)) {
    const res = readResource(c, name);
    const h = res.holders.length;
    const q = res.queue.length;
    res.holders = res.holders.filter((x) => x.ticket !== n);
    res.queue = res.queue.filter((x) => x.ticket !== n);
    if (res.holders.length !== h || res.queue.length !== q) writeJson(resourceFile(c, name), res);
  }
  const rec = readTicket(c, n);
  if (fs.existsSync(ticketFile(c, n))) writeTicket(c, { ...rec, tasks: [], parkedOn: [] });
  return grantableHeads(c).map(({ ticket, resource }) => ({ ticket, resource }));
}

export function reclaim(c, n) {
  return withLock(c, () => ({ reclaimed: Number(n), notify: reclaimLocked(c, Number(n)) }));
}

// ---------- collisions ----------

export function checkPlan(c, n, { files, openPrs = [] }) {
  n = Number(n);
  return withLock(c, () => {
    const rec = readTicket(c, n);
    const mine = new Set(files);
    const waitingOn = [];
    for (const pr of openPrs) {
      if (rec.pr !== null && Number(pr.number) === Number(rec.pr)) continue;
      if ((pr.files ?? []).some((f) => mine.has(f))) waitingOn.push(`pr:${pr.number}`);
    }
    for (const t of allTickets(c)) {
      if (t.ticket === n || !t.claimed || !t.planCleared) continue;
      if (t.pr !== null && openPrs.some((pr) => Number(pr.number) === Number(t.pr))) continue; // counted as its pull request
      if (t.files_to_change.some((f) => mine.has(f))) waitingOn.push(`ticket:${t.ticket}`);
    }
    const cleared = waitingOn.length === 0;
    const next = cleared
      ? applyPatch(c, rec, { files_to_change: files, planCleared: true })
      : applyPatch(c, rec, { files_to_change: files, planCleared: false, state: "waiting", waitingOn });
    writeTicket(c, next);
    return { ticket: n, cleared, waitingOn };
  });
}

export function unwait(c, n, items) {
  return withLock(c, () => {
    const rec = readTicket(c, Number(n));
    rec.waitingOn = rec.waitingOn.filter((x) => !items.includes(x));
    writeTicket(c, rec);
    return { ticket: Number(n), waitingOn: rec.waitingOn };
  });
}

// ---------- wakes ----------

export function wake(c, n) {
  n = Number(n);
  return withLock(c, () => {
    const rec = readTicket(c, n);
    if (rec.state === "parked") {
      let any = false;
      for (const name of rec.parkedOn) {
        const res = readResource(c, name);
        if (res.queue[0]?.ticket === n) {
          res.queue[0].notifiedAt = iso(c.now);
          writeJson(resourceFile(c, name), res);
          any = true;
        }
      }
      return { ticket: n, action: any ? "notified" : "still-parked" };
    }
    if (rec.state === "waiting" && rec.waitingOn.length) return { ticket: n, action: "still-waiting", waitingOn: rec.waitingOn };
    writeTicket(c, applyPatch(c, rec, { state: "running", waitingOn: [] }));
    return { ticket: n, action: "running" };
  });
}

// ---------- run status ----------

const statusFile = (c) => p(c, "state", "status.json");

export function getStatus(c) {
  return readJson(statusFile(c), { status: "running", since: null });
}

export function setStatus(c, status) {
  if (!["running", "paused"].includes(status)) throw new Refused(`status is running or paused, not "${status}"`);
  return withLock(c, () => {
    const before = getStatus(c);
    writeJson(statusFile(c), { status, since: iso(c.now) });
    const touched = [];
    if (status === "running") {
      for (const t of allTickets(c)) {
        if (t.claimed && t.state === "running" && t.due === null && t.tasks.length === 0) {
          writeTicket(c, { ...t, due: iso(c.now) });
          touched.push(t.ticket);
        }
      }
      for (const name of Object.keys(c.cfg.capacity)) {
        const res = readResource(c, name);
        if (res.queue[0]?.notifiedAt) {
          res.queue[0].notifiedAt = null;
          writeJson(resourceFile(c, name), res);
        }
      }
    }
    return { status, previous: before.status, dueNow: touched };
  });
}

// ---------- dispatcher lock and due ----------

const dispatcherFile = (c) => p(c, "state", "dispatcher.json");
const readDispatcher = (c) => ({ lock: null, due: null, ...readJson(dispatcherFile(c), {}) });

export function lockAcquire(c, launcher, { reclaim = false } = {}) {
  return withLock(c, () => {
    const d = readDispatcher(c);
    const live = d.lock && Date.parse(d.lock.expires) > c.now.getTime();
    if (live && !reclaim) return { acquired: false, lock: d.lock };
    const previous = d.lock;
    d.lock = { launcher, thread: null, acquiredAt: iso(c.now), expires: plus(c, c.cfg.wakeTimeoutMs) };
    writeJson(dispatcherFile(c), d);
    return { acquired: true, lock: d.lock, previous };
  });
}

export function lockThread(c, thread) {
  return withLock(c, () => {
    const d = readDispatcher(c);
    if (!d.lock) throw new Refused("no dispatcher lock to name a thread in");
    d.lock.thread = thread;
    writeJson(dispatcherFile(c), d);
    return { lock: d.lock };
  });
}

export function lockRelease(c, { thread } = {}) {
  return withLock(c, () => {
    const d = readDispatcher(c);
    if (d.lock && (!thread || d.lock.thread === thread)) {
      d.lock = null;
      writeJson(dispatcherFile(c), d);
      return { released: true };
    }
    return { released: false, lock: d.lock };
  });
}

export function lockShow(c) {
  const d = readDispatcher(c);
  return { lock: d.lock, live: !!d.lock && Date.parse(d.lock.expires) > c.now.getTime() };
}

export function setDispatcherDue(c, when, reason) {
  return withLock(c, () => {
    const d = readDispatcher(c);
    d.due = when ? { at: iso(when), reason: reason ?? "" } : null;
    writeJson(dispatcherFile(c), d);
    return { due: d.due };
  });
}

// ---------- quota ----------

const quotaFile = (c) => p(c, "quota.md");
const quotaLines = (c) => (fs.existsSync(quotaFile(c)) ? fs.readFileSync(quotaFile(c), "utf8").split("\n") : []);
const lineId = (line) => line.split("|")[0].trim();
const lineUntil = (line) => line.match(/blocked until\s+(\S+)/)?.[1] ?? null;

function writeQuota(c, lines) {
  fs.mkdirSync(c.memory, { recursive: true });
  const tmp = `${quotaFile(c)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n").replace(/\n*$/, "\n"));
  fs.renameSync(tmp, quotaFile(c));
}

export function quotaBlock(c, candidate, { until, ticket, step, words }) {
  return withLock(c, () => {
    const line = `${candidate} | blocked until ${iso(until)} | since ${iso(c.now)} | ${ticket} ${step} | ${String(words ?? "").replace(/\s+/g, " ").trim()}`;
    const lines = quotaLines(c).filter((l) => !(lineUntil(l) && lineId(l) === candidate));
    lines.push(line);
    writeQuota(c, lines);
    return { blocked: candidate, until: iso(until) };
  });
}

export function quotaPrune(c) {
  return withLock(c, () => {
    const lines = quotaLines(c);
    const keep = lines.filter((l) => !(lineUntil(l) && Date.parse(lineUntil(l)) <= c.now.getTime()));
    writeQuota(c, keep);
    return { removed: lines.length - keep.length };
  });
}

// ---------- due ----------

export function due(c) {
  const now = c.now.getTime();
  const items = [];
  const future = [];
  const consider = (t, item) => {
    if (t === null || Number.isNaN(t)) return;
    if (t <= now) items.push({ ...item, at: iso(t) });
    else future.push(t);
  };
  for (const t of allTickets(c)) {
    if (t.claimed && t.state === "running" && t.due) consider(Date.parse(t.due), { source: "ticket", ticket: t.ticket });
  }
  for (const line of quotaLines(c)) {
    const u = lineUntil(line);
    if (u) consider(Date.parse(u), { source: "quota", candidate: lineId(line) });
  }
  const d = readDispatcher(c);
  if (d.due) consider(Date.parse(d.due.at), { source: "dispatcher", reason: d.due.reason });
  for (const name of Object.keys(c.cfg.capacity)) {
    for (const h of readResource(c, name).holders) consider(Date.parse(h.expires), { source: "holding", ticket: h.ticket, resource: name });
  }
  for (const { ticket, resource, head } of grantableHeads(c)) {
    const t = head.notifiedAt ? Date.parse(head.notifiedAt) + NOTICE_MS : now;
    consider(t, { source: "queue", ticket, resource });
  }
  return { due: items, next: future.length ? iso(Math.min(...future)) : null };
}

// ---------- lessons ----------

const lessonsFile = (c) => p(c, "state", "lessons.json");

export function lessonsPending(c) {
  const done = new Set(readJson(lessonsFile(c), { ingested: [] }).ingested);
  const dir = p(c, "results");
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  return { pending: all.filter((f) => !done.has(f)) };
}

export function lessonsDone(c, files) {
  return withLock(c, () => {
    const d = readJson(lessonsFile(c), { ingested: [] });
    for (const f of files) if (!d.ingested.includes(f)) d.ingested.push(f);
    writeJson(lessonsFile(c), d);
    return { ingested: d.ingested.length };
  });
}

// ---------- CLI ----------

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = true;
      else opts[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, opts };
}

const list = (s) => (typeof s === "string" && s.length ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

export function run(argv) {
  const { pos, opts } = parseArgs(argv);
  const c = open(opts.root ?? process.cwd(), { now: opts.now });
  const [cmd, a, b, ...rest] = pos;
  switch (cmd) {
    case "claim":
      return claim(c, a, { thread: opts.thread ?? null });
    case "unclaim":
      return unclaim(c, a, { state: opts.state });
    case "ticket":
      if (a === "get") return getTicket(c, b);
      if (a === "list") return tickets(c);
      if (a === "set") return setTicket(c, b, JSON.parse(opts.json ?? "{}"));
      break;
    case "acquire":
      return acquire(c, a, b, opts.count ?? 1);
    case "release":
      return release(c, a, b);
    case "notified":
      return notified(c, a, b);
    case "renew":
      return renew(c, a);
    case "reclaim":
      return reclaim(c, a);
    case "check-plan":
      return checkPlan(c, a, { files: list(opts.files), openPrs: JSON.parse(opts["open-prs"] ?? "[]") });
    case "unwait":
      return unwait(c, a, [b, ...rest].filter(Boolean));
    case "wake":
      return wake(c, a);
    case "ack":
      return ack(c, a, [b, ...rest].filter(Boolean));
    case "status":
      if (!a || a === "get") return getStatus(c);
      if (a === "set") return setStatus(c, b);
      break;
    case "lock":
      if (a === "acquire") return lockAcquire(c, opts.launcher ?? "unknown", { reclaim: !!opts.reclaim });
      if (a === "thread") return lockThread(c, b);
      if (a === "release") return lockRelease(c, { thread: typeof opts.thread === "string" ? opts.thread : undefined });
      if (a === "show") return lockShow(c);
      break;
    case "dispatcher-due":
      if (a === "set") return setDispatcherDue(c, b, opts.reason);
      if (a === "clear") return setDispatcherDue(c, null);
      break;
    case "quota":
      if (a === "block") return quotaBlock(c, b, { until: opts.until, ticket: opts.ticket ?? "-", step: opts.step ?? "-", words: opts.words });
      if (a === "prune") return quotaPrune(c);
      break;
    case "due": {
      const d = due(c);
      if (opts.check) d.exitCode = d.due.length ? 0 : 1;
      return d;
    }
    case "lessons":
      if (a === "pending") return lessonsPending(c);
      if (a === "done") return lessonsDone(c, [b, ...rest].filter(Boolean));
      break;
  }
  throw new Refused(`unknown command: ${pos.join(" ") || "(none)"}; see the header of resources.mjs`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const out = run(process.argv.slice(2));
    const code = out?.exitCode ?? 0;
    if (out && "exitCode" in out) delete out.exitCode;
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    process.exitCode = code;
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = e instanceof Refused ? 2 : 1;
  }
}
