// Per-machine bookkeeping, kept outside the repository and never needed by
// another machine: the tick lock, the daily token counter, trunk reruns
// already asked for, per-ticket counters, the tick log and run logs.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RUN_LOG_DAYS = 14;

export function defaultStateDir(repo) {
  const base = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state");
  const id = createHash("sha1").update(path.resolve(repo)).digest("hex").slice(0, 8);
  return path.join(base, "autopilot", `${path.basename(path.resolve(repo))}-${id}`);
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
};

export class Machine {
  constructor(dir, clock = Date.now) {
    this.dir = dir;
    this.clock = clock;
    this.file = path.join(dir, "machine.json");
    this.data = readJson(this.file, {});
    this.data.days ??= {};
    this.data.reruns ??= {};
    this.data.noted ??= {};
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(this.data, null, 2)}\n`);
  }

  // One tick at a time per repository on this machine. A lock left by a
  // process that is gone is stale and taken over.
  lock() {
    fs.mkdirSync(this.dir, { recursive: true });
    const file = path.join(this.dir, "tick.lock");
    for (let i = 0; i < 2; i++) {
      try {
        fs.writeFileSync(file, String(process.pid), { flag: "wx" });
        this.lockFile = file;
        return true;
      } catch {
        const pid = Number(fs.readFileSync(file, "utf8"));
        if (pid && alive(pid)) return false;
        fs.rmSync(file, { force: true });
      }
    }
    return false;
  }

  unlock() {
    if (this.lockFile) fs.rmSync(this.lockFile, { force: true });
    this.lockFile = null;
  }

  today() {
    return new Date(this.clock()).toISOString().slice(0, 10);
  }

  tokensToday() {
    return this.data.days[this.today()] ?? 0;
  }

  addTokens(n) {
    const day = this.today();
    this.data.days = { [day]: (this.data.days[day] ?? 0) + (n || 0) };
    this.save();
  }

  reran(sha) {
    return Boolean(this.data.reruns[sha]);
  }

  markRerun(sha) {
    this.data.reruns[sha] = this.clock();
    this.save();
  }

  noted(key) {
    return Boolean(this.data.noted[key]);
  }

  markNoted(key) {
    this.data.noted[key] = this.clock();
    this.save();
  }

  // Counters per ticket, for the operator's eyes only.
  countTicket(key, id, { attempts = 0, tokens = 0 }) {
    const file = path.join(this.dir, `${key}.json`);
    const data = readJson(file, { tickets: {} });
    const t = (data.tickets[id] ??= { rounds: 0, tokens: 0 });
    t.rounds += attempts;
    t.tokens += tokens;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }

  log(line) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(path.join(this.dir, "ticks.log"), `${new Date(this.clock()).toISOString()}\t${line}\n`);
  }

  logLines() {
    try {
      return fs.readFileSync(path.join(this.dir, "ticks.log"), "utf8").split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // Keep one agent call's output; returns the file path for the run record.
  saveRun(name, data) {
    const dir = path.join(this.dir, "runs");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${new Date(this.clock()).toISOString().replace(/[:.]/g, "-")}-${name.replace(/[^\w.-]+/g, "_")}.json`);
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    return file;
  }

  pruneRuns(now = Date.now()) {
    const dir = path.join(this.dir, "runs");
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const file = path.join(dir, f);
      if (now - fs.statSync(file).mtimeMs > RUN_LOG_DAYS * 24 * 60 * 60_000) fs.rmSync(file, { force: true });
    }
  }
}
