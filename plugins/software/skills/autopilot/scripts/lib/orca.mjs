// Orca mode: each run's checkout is an Orca-managed worktree and each agent
// call is an Orca supervised worker, so every run is visible in Orca while it
// works and afterwards. Orchestration commands need an Orca terminal as the
// coordinator (ORCA_TERMINAL_HANDLE); the CLI relaunches itself in one.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { delegated, lastJsonBlock } from "./harness.mjs";

export const OUT_DIR = ".autopilot-out";
const QUESTION_ANSWER = "No human is available for this unattended run. Decide yourself from the ticket and spec, or finish with outcome failed and say why.";

// `orca <args> --json` as a transport: resolves the parsed envelope's
// `result`, or throws with Orca's error code and message.
export function orcaTransport({ command = "orca", cwd } = {}) {
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, [...args, "--json"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", reject);
      child.on("close", () => {
        let envelope;
        try {
          envelope = JSON.parse(out);
        } catch {
          return reject(new Error(`orca ${args.slice(0, 2).join(" ")} printed no JSON: ${(err || out).trim().slice(0, 300)}`));
        }
        if (envelope.ok === false) return reject(new Error(`orca ${args.slice(0, 2).join(" ")} failed: ${envelope.error?.code ?? "error"}: ${envelope.error?.message ?? ""}`.trim()));
        resolve(envelope.result ?? {});
      });
    });
}

const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

// The Orca repository id for a checkout, matched by path.
export async function orcaRepoId(orca, repoDir) {
  const want = real(repoDir);
  const { repos = [] } = await orca(["repo", "list"]);
  const repo = repos.find((r) => real(r.path) === want);
  if (!repo) throw new Error(`${repoDir} is not added to Orca; run \`orca repo add --path ${repoDir}\` first`);
  return repo.id;
}

// Workspace port on Orca worktrees. A workspace one of whose workers was
// retained is kept for debugging.
export function orcaWorkspaces({ orca, repoId, repoDir }) {
  const common = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: repoDir, encoding: "utf8" }).stdout.trim();
  const exclude = path.resolve(repoDir, common, "info", "exclude");
  const line = `/${OUT_DIR}/`;
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, "utf8") : "";
  if (!current.split("\n").includes(line)) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    fs.appendFileSync(exclude, `${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`);
  }
  return {
    async open({ ref, name, comment }) {
      const { worktree } = await orca(["worktree", "create", "--repo", `id:${repoId}`, "--name", name, "--base-branch", ref, "--setup", "skip", "--no-parent", ...(comment ? ["--comment", comment] : [])]);
      const ws = {
        dir: worktree.path,
        id: worktree.id,
        keep: false,
        async cleanup() {
          if (ws.keep) {
            await orca(["worktree", "set", "--worktree", `id:${ws.id}`, "--comment", `kept for debugging: ${comment ?? name}`]).catch(() => null);
            return;
          }
          await orca(["worktree", "rm", "--worktree", `id:${ws.id}`, "--force"]).catch(() => null);
        },
      };
      return ws;
    },
  };
}

// One mailbox loop per tick: routes worker_done and escalation messages to
// the worker waiting for them, answers questions, acknowledges deliveries.
class Mailbox {
  constructor(orca, runId, pollMs) {
    this.orca = orca;
    this.runId = runId;
    this.pollMs = pollMs;
    this.waiters = new Map();
    this.arrived = new Map();
    this.byHandle = new Map();
    this.running = false;
    this.ack = null;
  }

  wait(dispatchId, timeoutMs) {
    if (this.arrived.has(dispatchId)) return Promise.resolve(this.take(dispatchId));
    return new Promise((resolve) => {
      const timer = setTimeout(() => (this.waiters.delete(dispatchId), resolve({ timedOut: true })), timeoutMs);
      this.waiters.set(dispatchId, (msg) => (clearTimeout(timer), resolve(msg)));
      this.loop();
    });
  }

  take(dispatchId) {
    const msg = this.arrived.get(dispatchId);
    this.arrived.delete(dispatchId);
    return msg;
  }

  async loop() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.waiters.size) {
        const args = ["orchestration", "check", "--run", this.runId, ...(this.ack ? ["--ack", this.ack] : []), "--wait", "--types", "worker_done,escalation,question", "--timeout-ms", String(this.pollMs)];
        this.ack = null;
        const r = await this.orca(args);
        for (const msg of r.messages ?? []) await this.route(msg);
        if (r.messages?.length && r.deliveryId) this.ack = r.deliveryId;
      }
      if (this.ack) {
        await this.orca(["orchestration", "check", "--run", this.runId, "--ack", this.ack]).catch(() => null);
        this.ack = null;
      }
    } finally {
      this.running = false;
      // A worker that started waiting while the loop wound down.
      if (this.waiters.size) this.loop();
    }
  }

  async route(msg) {
    let payload = {};
    try {
      payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : (msg.payload ?? {});
    } catch {
      payload = {};
    }
    const dispatchId = payload.dispatchId ?? this.byHandle.get(msg.from_handle);
    if (msg.type === "question") {
      await this.orca(["orchestration", "reply", "--id", msg.id, "--body", QUESTION_ANSWER]).catch(() => null);
      return;
    }
    if (!dispatchId) return;
    const done = { type: msg.type, body: msg.body ?? "", outcome: payload.outcome ?? (msg.type === "escalation" ? "failed" : null), reportPath: payload.reportPath ?? null };
    const waiter = this.waiters.get(dispatchId);
    if (waiter) {
      this.waiters.delete(dispatchId);
      waiter(done);
    } else this.arrived.set(dispatchId, done);
  }
}

// Harness port on Orca workers. `agent` is the Orca agent id (omp, claude,
// codex); role agents are named the way that agent's plugin names them.
export function orcaHarness({ orca, agent = "omp", timeoutMs = 2 * 60 * 60_000, pollMs = 30_000, objective = "autopilot tick" }) {
  const agentName = { claude: (r) => `software-claude:${r}`, omp: (r) => r }[agent];
  let mailbox = null;
  let calls = 0;
  // One Run per tick, even when the gates start three workers at once.
  const ensureRun = () =>
    (mailbox ??= orca(["orchestration", "run-create", "--objective", objective]).then(({ run }) => new Mailbox(orca, run.id, pollMs)));

  return {
    name: "orca",
    async run({ role, prompt, cwd, delegate = true, title, workspace }) {
      const box = await ensureRun();
      const reportPath = path.join(cwd, OUT_DIR, `${role}-${++calls}.json`);
      const body = delegate && agentName ? delegated(agentName(role), prompt) : prompt;
      const spec = [
        body,
        "",
        `When you finish, write your final JSON result object as plain JSON (no code fence) to the file ${reportPath}, creating its folder if needed, and also end your reply with it in one fenced json block.`,
        `Then send worker_done with --report-path ${reportPath}: outcome succeeded when you produced the result, outcome failed when you could not.`,
      ].join("\n");
      const worktreeId = workspace?.id ?? (await orca(["worktree", "show", "--worktree", `path:${cwd}`])).worktree?.id;
      let start;
      try {
        start = await orca(["orchestration", "worker-start", "--spec", spec, "--worktree", `id:${worktreeId}`, "--agent", agent, "--task-title", title ?? role, "--run", box.runId]);
      } catch (err) {
        return { ok: false, output: { ok: false, error: err.message }, tokens: 0 };
      }
      const dispatchId = start.dispatchId;
      const handle = (start.effects ?? []).find((e) => e.kind === "terminal" && e.role === "agent")?.id;
      if (handle) box.byHandle.set(handle, dispatchId);
      const done = await box.wait(dispatchId, timeoutMs);
      const ref = { orca: dispatchId };

      let output = null;
      if (done.reportPath && fs.existsSync(done.reportPath)) {
        try {
          output = JSON.parse(fs.readFileSync(done.reportPath, "utf8"));
        } catch {
          output = null;
        }
      }
      output ??= lastJsonBlock(done.body ?? "");
      const ok = !done.timedOut && done.outcome === "succeeded" && output && output.ok !== false;
      if (done.timedOut) await orca(["orchestration", "worker-stop", "--dispatch", dispatchId]).catch(() => null);
      // Release archives a succeeded worker's output; anything else stays
      // for debugging, and so does its workspace.
      if (ok) await orca(["orchestration", "worker-release", "--dispatch", dispatchId]).catch(() => null);
      else {
        await orca(["orchestration", "worker-retain", "--dispatch", dispatchId]).catch(() => null);
        if (workspace) workspace.keep = true;
      }
      if (ok) return { ok: true, output, tokens: 0, ref };
      const error = done.timedOut ? `the Orca worker did not report within ${Math.round(timeoutMs / 60_000)} min` : output ? null : `the Orca worker ended (${done.type ?? "no report"}) without a JSON result`;
      return { ok: false, output: output ?? { ok: false, error }, tokens: 0, ref };
    },
  };
}

export const shellQuote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;

// Orchestration needs an Orca terminal as the coordinator. Relaunch `argv`
// inside one, wait for it, and return its exit code and output. Orca types the
// command into the terminal's shell, so `exec` makes the terminal end with
// it, and the exit code and output go through files because Orca cannot
// always see a process's exit status.
export async function relaunchInOrca({ orca, repoDir, title, argv, timeoutMs = 24 * 60 * 60_000 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autopilot-orca-"));
  const code = path.join(dir, "exit");
  const log = path.join(dir, "output");
  const inner = `{ ${argv.map(shellQuote).join(" ")}; echo $? > ${shellQuote(code)}; } 2>&1 | tee ${shellQuote(log)}`;
  try {
    const { terminal } = await orca(["terminal", "create", "--worktree", `path:${repoDir}`, "--title", title, "--command", `exec sh -c ${shellQuote(inner)}`]);
    await orca(["terminal", "wait", "--terminal", terminal.handle, "--for", "exit", "--timeout-ms", String(timeoutMs)]);
    const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
    const exit = read(code);
    return { handle: terminal.handle, exitCode: exit === null ? null : Number(exit.trim()), output: read(log) ?? "" };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
