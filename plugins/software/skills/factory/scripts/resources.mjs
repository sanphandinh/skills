#!/usr/bin/env node
// The factory's shared state in its memory folder: claims, resources, dues, the
// dispatcher lock, the run status and quota blocks. Every write goes through one
// lock (`<memory>/state.lock`), so the dispatcher and the coordinators of many
// tickets can write at once. Output is JSON on stdout.
//
//   node resources.mjs <command> [args] [--root <project>] [--now <ISO time>]
//
//   claim <n> [--thread <id>]              claim ticket n (refused when already claimed)
//   unclaim <n> [--state <state>]          release the claim and every resource of n
//   ticket get <n> | ticket list           read records (`get` adds the ticket's holdings); `list` counts toward Max tickets
//   ticket set <n> --json '<patch>'        merge fields into n's record (`state` moves `due`)
//   acquire <n> <resource> [--count k]     take a resource or join its queue (FIFO, head first); no --count: the count it queued with, else 1
//   release <n> <resource> [--count k]     give it back (k of a slot holding), or leave its queue; prints who to notify
//   notified <n> <resource>                record that n, at the head of the queue, was told
//   renew <n>                              extend every holding of n by Wake timeout
//   reclaim <n>                            release everything n holds or queues for, drop its tasks
//   check-plan <n> --files <a,b> --open-prs '<[{number,files}]>'
//   unwait <n> <item>...                   remove finished items (pr:5, ticket:7, trunk) from waitingOn
//   wake <n>                               mark n running with a due, or notified when parked
//   ack <n> <id>...                        record comment ids as handled
//   status [get] | status set running|paused
//   lock acquire --launcher <who> [--reclaim] (prints a token) | lock thread <id> | lock release [--thread <id>] | lock show
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

// A ticket is its number, or on a tracker without numbers a key such as `checkout-02`.
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export function ticketId(n) {
  if (typeof n === "number" && !Number.isInteger(n)) throw new Refused(`"${n}" is not a ticket number or key`);
  const text = String(n ?? "");
  if (/^[1-9]\d*$/.test(text)) return Number(text);
  if (KEY.test(text) && !/^\d+$/.test(text)) return text;
  throw new Refused(`"${text}" is not a ticket number or key (letters, digits, ".", "_", "-")`);
}

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
// A time given on the command line: refused unless it parses.
function when(t, what) {
  if (t === undefined || t === null || t === true || Number.isNaN(Date.parse(t))) throw new Refused(`${what} needs a time such as 2026-11-27T10:00Z, not "${t ?? ""}"`);
  return iso(t);
}
function needed(v, what) {
  if (v === undefined || v === null || v === true || String(v).trim() === "") throw new Refused(`${what} is required`);
  return String(v);
}
const plus = (c, ms) => iso(c.now.getTime() + ms);
const minute = (d) => iso(d).slice(0, 16) + "Z";

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

// The lock is a directory; its owner.json names the process and a token. Only
// the token's owner removes it. A stale lock (its process is gone, or it is older
// than LOCK_STALE_MS) is broken under a second, short lock, after looking again,
// so two processes never both break it and both enter.
function lockOwner(dir) {
  const owner = readJson(path.join(dir, "owner.json"), null);
  let age = null;
  try {
    age = Date.now() - fs.statSync(dir).mtimeMs;
  } catch {
    return { gone: true };
  }
  return { owner, age };
}

const isStale = ({ owner, age }) => (owner && !alive(owner.pid)) || age > LOCK_STALE_MS || (!owner && age > 2000);

function breakStale(dir, seen) {
  const guard = `${dir}.break`;
  try {
    fs.mkdirSync(guard);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const g = lockOwner(guard);
    if (!g.gone && g.age > 5000) fs.rmSync(guard, { recursive: true, force: true });
    return;
  }
  try {
    const now = lockOwner(dir);
    if (!now.gone && isStale(now) && now.owner?.token === seen.owner?.token) fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    fs.rmSync(guard, { recursive: true, force: true });
  }
}

function withLock(c, fn) {
  fs.mkdirSync(c.memory, { recursive: true });
  const dir = p(c, "state.lock");
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, token, at: iso(Date.now()) }));
      break;
    } catch (e) {
      if (e.code === "ENOENT") continue; // broken while we wrote the owner: try again
      if (e.code !== "EEXIST") throw e;
      const seen = lockOwner(dir);
      if (seen.gone) continue;
      if (isStale(seen)) {
        breakStale(dir, seen);
        continue;
      }
      if (Date.now() > deadline) throw new Error(`state lock ${dir} still held by pid ${seen.owner?.pid}`);
      sleep(10 + Math.floor(Math.random() * 20));
    }
  }
  try {
    return fn();
  } finally {
    if (readJson(path.join(dir, "owner.json"), null)?.token === token) fs.rmSync(dir, { recursive: true, force: true });
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
    landing: false,
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
    .filter((f) => f.endsWith(".json") && KEY.test(f.slice(0, -5)))
    .map((f) => readTicket(c, ticketId(f.slice(0, -5))))
    .sort((a, b) => String(a.ticket).localeCompare(String(b.ticket), "en", { numeric: true }));
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
  return readTicket(c, ticketId(n));
}

export function setTicket(c, n, patch) {
  return withLock(c, () => {
    const rec = applyPatch(c, readTicket(c, ticketId(n)), patch);
    writeTicket(c, rec);
    return rec;
  });
}

export function claim(c, n, { thread = null } = {}) {
  return withLock(c, () => {
    const rec = readTicket(c, ticketId(n));
    if (rec.claimed) return { claimed: false, record: rec };
    const fresh = applyPatch(c, { ...blankTicket(ticketId(n)), acked: [] }, { state: "running" });
    Object.assign(fresh, { claimed: true, claimedAt: iso(c.now), thread });
    writeTicket(c, fresh);
    return { claimed: true, record: fresh };
  });
}

export function unclaim(c, n, { state } = {}) {
  return withLock(c, () => {
    const notify = reclaimLocked(c, ticketId(n));
    let rec = readTicket(c, ticketId(n));
    rec = applyPatch(c, rec, state ? { state } : {});
    Object.assign(rec, { claimed: false, planCleared: false, landing: false, due: null, tasks: [], parkedOn: [], waitingOn: [] });
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
    const rec = readTicket(c, ticketId(n));
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
      .holders.filter((h) => h.ticket === ticketId(n))
      .map((h) => ({ resource: name, ...h })),
  );
}

export function acquire(c, n, resource, count = null) {
  n = ticketId(n);
  return withLock(c, () => {
    if (getStatus(c).status === "paused") throw new Refused("factory is paused: start no worker and ask for no resource");
    const r = rank(c.cfg, resource);
    if (count === null) count = readResource(c, resource).queue.find((q) => q.ticket === n)?.count ?? 1;
    count = Number(count);
    if (!Number.isInteger(count) || count < 1 || count > c.cfg.capacity[resource]) {
      throw new Refused(`${resource} has ${c.cfg.capacity[resource]} at most; asked for ${count}`);
    }
    const held = holdings(c, n);
    const mine = held.find((h) => h.resource === resource);
    if (mine && mine.count >= count) return { granted: true, already: true, resource, count: mine.count };
    if (mine) throw new Refused(`ticket ${n} holds ${mine.count} ${resource} and asks for ${count}: release it first`);
    const queuedElsewhere = Object.keys(c.cfg.capacity).filter((name) => name !== resource && readResource(c, name).queue.some((q) => q.ticket === n));
    if (queuedElsewhere.length) throw new Refused(`ticket ${n} waits in the queue of ${queuedElsewhere.join(", ")}: take that first`);
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

// The heads that can take what is free now: of every resource for `due`, or of the
// resources a release changed, and then only those nobody told yet.
function grantableHeads(c, names = Object.keys(c.cfg.capacity)) {
  const out = [];
  for (const name of names) {
    const res = readResource(c, name);
    const head = res.queue[0];
    if (head && free(c, name, res) >= head.count) out.push({ ticket: head.ticket, resource: name, head });
  }
  return out;
}

const toNotify = (c, names) => grantableHeads(c, names).filter(({ head }) => !head.notifiedAt).map(({ ticket, resource }) => ({ ticket, resource }));

// Gives back a holding, or leaves the queue of a resource the ticket waits for.
export function release(c, n, resource, count = null) {
  if (count !== null && (!Number.isInteger(count) || count < 1)) throw new Refused(`release --count takes a whole number, not ${count}`);
  return withLock(c, () => {
    rank(c.cfg, resource);
    n = ticketId(n);
    const res = readResource(c, resource);
    const held = res.holders.length;
    const queued = res.queue.length;
    const mine = res.holders.find((h) => h.ticket === n);
    if (mine && count !== null && count < mine.count) {
      mine.count -= count;
      writeJson(resourceFile(c, resource), res);
      return { released: resource, count, left: false, notify: toNotify(c, [resource]) };
    }
    res.holders = res.holders.filter((h) => h.ticket !== n);
    res.queue = res.queue.filter((q) => q.ticket !== n);
    if (res.holders.length === held && res.queue.length === queued) return { released: null, notify: [] };
    writeJson(resourceFile(c, resource), res);
    const rec = readTicket(c, n);
    if (rec.parkedOn.includes(resource)) {
      const parkedOn = rec.parkedOn.filter((x) => x !== resource);
      writeTicket(c, applyPatch(c, rec, rec.state === "parked" && parkedOn.length === 0 ? { state: "running", parkedOn } : { parkedOn }));
    }
    return { released: resource, left: res.queue.length !== queued, notify: toNotify(c, [resource]) };
  });
}

export function notified(c, n, resource) {
  rank(c.cfg, resource);
  n = ticketId(n);
  return withLock(c, () => {
    const res = readResource(c, resource);
    const q = res.queue[0]?.ticket === n ? res.queue[0] : null;
    if (!q) return { notified: false };
    q.notifiedAt = iso(c.now);
    writeJson(resourceFile(c, resource), res);
    return { notified: true };
  });
}

export function renew(c, n) {
  n = ticketId(n);
  return withLock(c, () => {
    const out = [];
    for (const name of Object.keys(c.cfg.capacity)) {
      const res = readResource(c, name);
      let changed = false;
      for (const h of res.holders.filter((h) => h.ticket === ticketId(n))) {
        h.expires = plus(c, c.cfg.wakeTimeoutMs);
        changed = true;
        out.push(name);
      }
      if (changed) writeJson(resourceFile(c, name), res);
    }
    return { renewed: out, factoryStatus: getStatus(c).status };
  });
}

function reclaimLocked(c, n) {
  const changed = [];
  for (const name of Object.keys(c.cfg.capacity)) {
    const res = readResource(c, name);
    const h = res.holders.length;
    const q = res.queue.length;
    res.holders = res.holders.filter((x) => x.ticket !== n);
    res.queue = res.queue.filter((x) => x.ticket !== n);
    if (res.holders.length !== h || res.queue.length !== q) {
      writeJson(resourceFile(c, name), res);
      changed.push(name);
    }
  }
  const rec = readTicket(c, n);
  if (fs.existsSync(ticketFile(c, n))) writeTicket(c, { ...rec, tasks: [], parkedOn: [], landing: false });
  return toNotify(c, changed);
}

export function reclaim(c, n) {
  return withLock(c, () => ({ reclaimed: ticketId(n), notify: reclaimLocked(c, ticketId(n)) }));
}

// ---------- collisions ----------

export function checkPlan(c, n, { files, openPrs = [] }) {
  n = ticketId(n);
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
      if (t.pr !== null && waitingOn.includes(`pr:${t.pr}`)) continue; // already blocks through its pull request
      if (t.files_to_change.some((f) => mine.has(f))) waitingOn.push(`ticket:${t.ticket}`);
    }
    const cleared = waitingOn.length === 0;
    const next = cleared
      ? applyPatch(c, rec, { files_to_change: files, planCleared: true, waitingOn: [], ...(rec.state === "waiting" ? { state: "running" } : {}) })
      : applyPatch(c, rec, { files_to_change: files, planCleared: false, state: "waiting", waitingOn });
    writeTicket(c, next);
    return { ticket: n, cleared, waitingOn };
  });
}

export function unwait(c, n, items) {
  return withLock(c, () => {
    const rec = readTicket(c, ticketId(n));
    rec.waitingOn = rec.waitingOn.filter((x) => !items.includes(x));
    writeTicket(c, rec);
    return { ticket: ticketId(n), waitingOn: rec.waitingOn };
  });
}

// ---------- wakes ----------

export function wake(c, n) {
  n = ticketId(n);
  return withLock(c, () => {
    const rec = readTicket(c, n);
    if (!rec.claimed) throw new Refused(`ticket ${n} is not claimed`);
    if (rec.state === "parked") {
      let any = false;
      for (const name of rec.parkedOn) {
        const res = readResource(c, name);
        if (res.queue[0]?.ticket === n && free(c, name, res) >= res.queue[0].count) {
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
    // A lock that expired is not taken either: its dispatcher may still run. The
    // launcher reads the session in it and takes it over with --reclaim.
    const live = d.lock && Date.parse(d.lock.expires) > c.now.getTime();
    if (d.lock && !reclaim) return { acquired: false, lock: d.lock, expired: !live };
    const previous = d.lock;
    // The token goes into the dispatcher's first message: it may read the lock
    // before its launcher wrote the thread id, and the token tells it the lock is its.
    const token = `lock-${c.now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    d.lock = { launcher, token, thread: null, acquiredAt: iso(c.now), expires: plus(c, c.cfg.wakeTimeoutMs) };
    writeJson(dispatcherFile(c), d);
    return { acquired: true, lock: d.lock, previous };
  });
}

export function lockThread(c, thread) {
  thread = needed(thread, "lock thread <session id>");
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

export function setDispatcherDue(c, time, reason) {
  const at = time === null ? null : when(time, "dispatcher-due set");
  return withLock(c, () => {
    const d = readDispatcher(c);
    d.due = at ? { at, reason: reason ?? "" } : null;
    writeJson(dispatcherFile(c), d);
    return { due: d.due };
  });
}

// ---------- quota ----------

const quotaFile = (c) => p(c, "quota.md");
function quotaLines(c) {
  if (!fs.existsSync(quotaFile(c))) return [];
  const text = fs.readFileSync(quotaFile(c), "utf8").replace(/\r?\n$/, "");
  return text ? text.split(/\r?\n/) : [];
}
const lineId = (line) => line.split("|")[0].trim();
const lineUntil = (line) => line.match(/blocked until\s+(\S+)/)?.[1] ?? null;

function writeQuota(c, lines) {
  fs.mkdirSync(c.memory, { recursive: true });
  const tmp = `${quotaFile(c)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.length ? lines.join("\n") + "\n" : "");
  fs.renameSync(tmp, quotaFile(c));
}

export function quotaBlock(c, candidate, { until, ticket, step, words }) {
  candidate = needed(candidate, "quota block <candidate>");
  until = when(until, "quota block --until");
  return withLock(c, () => {
    // Minutes, the way every <time> in the memory folder is written.
    const line = `${candidate} | blocked until ${minute(until)} | since ${minute(c.now)} | ${ticket} ${step} | ${String(words ?? "").replace(/\s+/g, " ").trim()}`;
    const lines = quotaLines(c).filter((l) => !(lineUntil(l) && lineId(l) === candidate));
    lines.push(line);
    writeQuota(c, lines);
    return { blocked: candidate, until: minute(until) };
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

// Every option takes a value, except the flags named here.
export function parseArgs(argv, flags = ["check", "reclaim"]) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const key = a.slice(2);
    if (flags.includes(key)) {
      opts[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) throw new Refused(`--${key} needs a value`);
    opts[key] = argv[++i];
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
      if (a === "get") return { ...getTicket(c, b), holdings: holdings(c, ticketId(b)), factoryStatus: getStatus(c).status };
      if (a === "list") return tickets(c);
      if (a === "set") return setTicket(c, b, JSON.parse(opts.json ?? "{}"));
      break;
    case "acquire":
      return acquire(c, a, b, opts.count === undefined ? null : Number(opts.count));
    case "release":
      return release(c, a, b, opts.count === undefined ? null : Number(opts.count));
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
      if (a === "release") return lockRelease(c, { thread: opts.thread });
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
