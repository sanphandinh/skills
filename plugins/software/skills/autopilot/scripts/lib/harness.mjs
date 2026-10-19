// Harness port: `run({ role, prompt, cwd })` resolves to
// `{ ok, output, tokens }`, where `output` is the JSON object the agent ended
// its reply with. One adapter per agent harness; each runs one fresh,
// non-interactive session per call and lets the harness's own agent
// definitions pick the model for the role.
import { spawn } from "node:child_process";

const adapters = {
  omp: (opts) => cliHarness({ ...opts, command: opts.command ?? "omp", args: ompArgs, parse: parseOmp }),
  claude: (opts) =>
    cliHarness({
      ...opts,
      command: opts.command ?? "claude",
      args: claudeArgs(opts),
      parse: parseClaude,
      agentName: (role) => `software-claude:${role}`,
    }),
};

export function createHarness(name, options = {}) {
  const make = adapters[name];
  if (!make) throw new Error(`unknown harness "${name}"; available: ${Object.keys(adapters).join(", ")}`);
  return make(options);
}

export function registerHarness(name, make) {
  adapters[name] = make;
}

// The last fenced ```json block in an agent's reply.
export function lastJsonBlock(text) {
  const blocks = [...String(text).matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (!blocks.length) return null;
  try {
    return JSON.parse(blocks.at(-1)[1]);
  } catch {
    return null;
  }
}

// The session hands the whole task to the named agent, so the agent's own
// definition (tools, role-based model, output schema) applies.
export const delegated = (role, prompt) =>
  `Delegate the whole task below to the \`${role}\` agent, wait for it to finish, and reply with its final JSON result unchanged in one fenced json block.\n\n${prompt}`;

function cliHarness({ command, args, parse, agentName = (role) => role, timeoutMs = 2 * 60 * 60_000, env }) {
  return {
    async run({ role, prompt, cwd, delegate = true }) {
      const text = delegate ? delegated(agentName(role), prompt) : prompt;
      const proc = await exec(command, args(text), { cwd, timeoutMs, env });
      if (proc.code !== 0) return { ok: false, output: { ok: false, error: `${command} exited with ${proc.code}: ${proc.stderr.slice(-500)}` }, tokens: 0 };
      const { reply, tokens, error } = parse(proc.stdout);
      if (error) return { ok: false, output: { ok: false, error }, tokens };
      const output = lastJsonBlock(reply);
      if (!output) return { ok: false, output: { ok: false, error: "the agent ended without a JSON result" }, tokens };
      return { ok: output.ok !== false, output, tokens };
    },
  };
}

function exec(command, argv, { cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, argv, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", (err) => (clearTimeout(timer), resolve({ code: -1, stdout, stderr: String(err) })));
    child.on("close", (code, signal) => (clearTimeout(timer), resolve({ code: code ?? -1, stdout, stderr: signal ? `${stderr}killed by ${signal}` : stderr })));
  });
}

// ---------- Oh My Pi ----------

const ompArgs = (prompt) => ["-p", "--mode", "json", "--auto-approve", "--no-title", prompt];

// `--mode json` prints one event per line; the reply is the last assistant
// message, and every assistant message reports its usage.
function parseOmp(stdout) {
  let reply = "";
  let tokens = 0;
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "message_end" || event.message?.role !== "assistant") continue;
    const u = event.message.usage ?? {};
    tokens += (u.input ?? u.inputTokens ?? 0) + (u.output ?? u.outputTokens ?? 0);
    reply = (event.message.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  }
  return { reply, tokens };
}

// ---------- Claude Code ----------

// The parent session runs on `sessionModel`, so an agent with `model: inherit`
// (the implementer) never shares the reviewers' alias. Unattended runs cannot
// answer permission prompts, so the session skips them; it only ever runs in a
// disposable worktree.
const claudeArgs =
  ({ sessionModel = "sonnet", permissionMode = "bypassPermissions" } = {}) =>
  (prompt) => ["-p", "--output-format", "json", "--model", sessionModel, "--permission-mode", permissionMode, prompt];

function parseClaude(stdout) {
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    return { reply: "", tokens: 0, error: "claude printed no JSON result" };
  }
  const u = result.usage ?? {};
  const tokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0);
  if (result.is_error) return { reply: "", tokens, error: `claude reported ${result.subtype ?? "an error"}: ${String(result.result ?? "").slice(0, 300)}` };
  return { reply: result.result ?? "", tokens };
}
