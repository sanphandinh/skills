import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createHarness } from "./lib/harness.mjs";
import { tmp } from "./test-helpers.mjs";

// A stand-in executable (plain sh, so it starts fast and reliably) that
// records its arguments and working directory, then prints `stdout`.
function fakeCli(stdout, { exit = 0 } = {}) {
  const dir = tmp("autopilot-cli-");
  const bin = path.join(dir, "cli");
  fs.writeFileSync(path.join(dir, "out.txt"), stdout);
  fs.writeFileSync(
    bin,
    `#!/bin/sh\npwd > "${dir}/cwd"\n: > "${dir}/args"\nfor a in "$@"; do printf '%s\\0' "$a" >> "${dir}/args"; done\ncat "${dir}/out.txt"\nexit ${exit}\n`,
  );
  fs.chmodSync(bin, 0o755);
  return {
    bin,
    dir,
    seen: () => ({
      args: fs.readFileSync(path.join(dir, "args"), "utf8").split("\0").slice(0, -1),
      cwd: fs.readFileSync(path.join(dir, "cwd"), "utf8").trim(),
    }),
  };
}

const ompEvents = (text, usage = { input: 1200, output: 300 }) =>
  [
    { type: "agent_start" },
    { type: "message_end", message: { role: "user", content: [{ type: "text", text: "prompt" }] } },
    { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "thinking aloud" }], usage: { input: 10, output: 5 } } },
    { type: "message_end", message: { role: "assistant", content: [{ type: "text", text }], usage } },
    { type: "agent_end", messages: [] },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n");

test("the omp adapter runs non-interactively in the role's checkout and returns the agent's final JSON", async () => {
  const cli = fakeCli(ompEvents('Done.\n```json\n{ "verdict": "PASS", "evidence": "ran it" }\n```\n'));
  const cwd = tmp("autopilot-cwd-");
  const result = await createHarness("omp", { command: cli.bin }).run({ role: "verifier", prompt: "Agent: verifier\nTicket: x", cwd });
  assert.deepEqual(result.output, { verdict: "PASS", evidence: "ran it" });
  assert.equal(result.ok, true);
  assert.equal(result.tokens, 1200 + 300 + 10 + 5);
  const { args, cwd: ranIn } = cli.seen();
  assert.equal(fs.realpathSync(ranIn), fs.realpathSync(cwd));
  assert.ok(args.includes("-p") && args.includes("--mode") && args.includes("json"));
  assert.match(args.at(-1), /`verifier` agent/);
  assert.match(args.at(-1), /Ticket: x/);
});

test("the omp adapter reports a run with no JSON result, or a failed process, as not ok", async () => {
  const noJson = await createHarness("omp", { command: fakeCli(ompEvents("I could not do it.")).bin }).run({ role: "implementer", prompt: "p", cwd: tmp() });
  assert.equal(noJson.ok, false);
  const crashed = await createHarness("omp", { command: fakeCli("", { exit: 2 }).bin }).run({ role: "implementer", prompt: "p", cwd: tmp() });
  assert.equal(crashed.ok, false);
  assert.match(crashed.output.error, /exited with 2/);
});

test("smoke: a real omp answers a trivial role", { skip: !process.env.AUTOPILOT_SMOKE_OMP }, async () => {
  const result = await createHarness("omp").run({
    role: "trivial",
    prompt: 'Reply with exactly this and nothing else:\n```json\n{ "ok": true }\n```',
    cwd: tmp(),
    delegate: false,
  });
  assert.deepEqual(result.output, { ok: true });
});

const claudeResult = (result, extra = {}) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, result, usage: { input_tokens: 900, output_tokens: 100, cache_read_input_tokens: 5000 }, ...extra });

test("the claude adapter delegates to the plugin's agent and runs the session on a different alias from the reviewers", async () => {
  const cli = fakeCli(claudeResult('```json\n{ "verdict": "pass", "findings": [] }\n```'));
  const cwd = tmp("autopilot-cwd-");
  const result = await createHarness("claude", { command: cli.bin }).run({ role: "review-spec", prompt: "Agent: review-spec\nTicket: x", cwd });
  assert.deepEqual(result.output, { verdict: "pass", findings: [] });
  assert.equal(result.tokens, 1000);
  const { args, cwd: ranIn } = cli.seen();
  assert.equal(fs.realpathSync(ranIn), fs.realpathSync(cwd));
  assert.deepEqual(args.slice(0, 3), ["-p", "--output-format", "json"]);
  assert.equal(args[args.indexOf("--model") + 1], "sonnet", "an inherit-model implementer lands on sonnet, not the reviewers' opus");
  assert.match(args.at(-1), /`software-claude:review-spec` agent/);
});

test("the claude adapter reports an error result as not ok", async () => {
  const cli = fakeCli(claudeResult("Execution error", { is_error: true, subtype: "error_during_execution" }));
  const result = await createHarness("claude", { command: cli.bin }).run({ role: "implementer", prompt: "p", cwd: tmp() });
  assert.equal(result.ok, false);
  assert.match(result.output.error, /error_during_execution/);
});

test("smoke: a real claude answers a trivial role", { skip: !process.env.AUTOPILOT_SMOKE_CLAUDE }, async () => {
  const result = await createHarness("claude").run({ role: "trivial", prompt: 'Reply with exactly this and nothing else:\n```json\n{ "ok": true }\n```', cwd: tmp(), delegate: false });
  assert.deepEqual(result.output, { ok: true });
});

// ---------- harness detection ----------

import { detectHarness } from "./lib/harness.mjs";

const noProject = () => tmp("autopilot-proj-");
const detect = (o) =>
  detectHarness({ repoDir: o.repoDir ?? noProject(), ancestors: () => o.ancestors ?? [], onPath: (c) => (o.path ?? []).includes(c), explicit: o.explicit, env: o.env ?? {} });

test("an explicit harness always wins", () => {
  assert.deepEqual(detect({ explicit: "claude", ancestors: ["zsh", "omp"] }), { name: "claude", why: "--harness" });
});

test("the session autopilot runs inside picks the harness", () => {
  assert.deepEqual(detect({ ancestors: ["node", "bash", "omp", "zsh"], path: ["omp", "claude"] }), { name: "omp", why: "running inside omp" });
  assert.deepEqual(detect({ ancestors: ["node", "/opt/homebrew/bin/claude", "zsh"], path: ["omp", "claude"] }), { name: "claude", why: "running inside claude" });
  assert.deepEqual(detect({ ancestors: ["node", "zsh"], env: { CLAUDECODE: "1" }, path: ["omp", "claude"] }), { name: "claude", why: "running inside claude" });
});

test("from a plain terminal, the agent plugin installed in the project picks the harness", () => {
  const omp = noProject();
  fs.mkdirSync(path.join(omp, ".omp/plugins"), { recursive: true });
  fs.writeFileSync(path.join(omp, ".omp/plugins/installed_plugins.json"), JSON.stringify({ plugins: { "software-omp@sanphan-skills": [{}] } }));
  assert.deepEqual(detect({ repoDir: omp, ancestors: ["zsh"], path: ["omp", "claude"] }), { name: "omp", why: "software-omp is installed in the project" });

  const claude = noProject();
  fs.mkdirSync(path.join(claude, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(claude, ".claude/settings.json"), JSON.stringify({ enabledPlugins: { "software-claude@sanphan-skills": true } }));
  assert.deepEqual(detect({ repoDir: claude, ancestors: ["zsh"], path: ["omp", "claude"] }), { name: "claude", why: "software-claude is enabled in the project" });
});

test("with no other signal, the only agent CLI on PATH is used, and anything ambiguous asks for --harness", () => {
  assert.deepEqual(detect({ ancestors: ["zsh"], path: ["claude"] }), { name: "claude", why: "the only agent CLI on PATH" });
  assert.throws(() => detect({ ancestors: ["zsh"], path: ["omp", "claude"] }), /pass --harness omp or --harness claude/);
  assert.throws(() => detect({ ancestors: ["zsh"], path: [] }), /no agent CLI/);
});
