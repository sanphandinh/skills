import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createHarness } from "./lib/harness.mjs";
import { tmp } from "./test-helpers.mjs";

// A stand-in executable that records its arguments and prints `stdout`.
function fakeCli(stdout, { exit = 0 } = {}) {
  const dir = tmp("autopilot-cli-");
  const bin = path.join(dir, "cli");
  const log = path.join(dir, "args.json");
  fs.writeFileSync(path.join(dir, "out.txt"), stdout);
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nfs.writeFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(path.join(dir, "out.txt"))}, "utf8"));\nprocess.exit(${exit});\n`,
  );
  fs.chmodSync(bin, 0o755);
  return { bin, dir, seen: () => JSON.parse(fs.readFileSync(log, "utf8")) };
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
