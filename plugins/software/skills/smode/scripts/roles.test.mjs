import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "roles.mjs");

function project(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "smode-roles-"));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

function run(root, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args, "--root", root], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const ROLES = `# Roles

Read by the \`smode\` skill. Each line is \`<role>: <candidate>, <candidate>\`.

\`\`\`
worker: example/not-a-role-line
\`\`\`

scout: anthropic/claude-haiku-5-5 effort=low, google/gemini-3.8-flash effort=low via=antigravity
worker: anthropic/claude-sonnet-5-5 effort=medium, cursor/composer-2.5
thinker: anthropic/claude-fable-5-2 effort=high
reviewer: google/gemini-4-hydrogen effort=high via=antigravity, xai/grok-4.7 effort=high via=cursor
`;

test("check accepts a valid file and counts its roles and candidates", () => {
  const r = run(project({ "docs/agents/roles.md": ROLES }), "check");
  assert.equal(r.code, 0);
  assert.equal(r.out, "4 role(s), 7 candidate(s), 0 error(s)\n");
});

test("check reports an unknown role, a malformed candidate, an unknown option and effort, and duplicates", () => {
  const r = run(
    project({
      "docs/agents/roles.md": [
        "architect: anthropic/claude-opus-5-5",
        "scout: haiku",
        "worker: anthropic/claude-sonnet-5-5 speed=fast",
        "thinker: anthropic/claude-opus-5-5 effort=extreme",
        "reviewer: openai/gpt-6, openai/gpt-6 effort=high",
        "scout: anthropic/claude-haiku-5-5",
        "coordinator:",
      ].join("\n"),
    }),
    "check",
  );
  assert.equal(r.code, 1);
  assert.match(r.out, /roles\.md:1: "architect" is not a role; the roles are scout, worker, thinker, reviewer, coordinator/);
  assert.match(r.out, /roles\.md:2: scout: "haiku" is not <provider>\/<model>/);
  assert.match(r.out, /roles\.md:3: worker: option "speed" is not one of effort, via/);
  assert.match(r.out, /roles\.md:4: thinker: effort "extreme" is not one of low, medium, high, xhigh, max/);
  assert.match(r.out, /roles\.md:5: reviewer: openai\/gpt-6 is listed twice/);
  assert.match(r.out, /roles\.md:6: role "scout" is given twice/);
  assert.match(r.out, /roles\.md:7: role "coordinator" has no candidate/);
});

test("check warns when every reviewer is the worker's model family, whatever the channel", () => {
  const r = run(
    project({ "docs/agents/roles.md": "worker: anthropic/claude-sonnet-5-5\nreviewer: anthropic/claude-opus-5-5 via=cursor\n" }),
    "check",
  );
  assert.equal(r.code, 0);
  assert.match(r.out, /warning: every reviewer candidate is from anthropic/);
});

test("without a roles file, check passes and show says workers run on the session's model", () => {
  const root = project();
  assert.deepEqual(run(root, "check"), { code: 0, out: "No docs/agents/roles.md: every worker runs on the session's model.\n", err: "" });
  assert.match(run(root, "show").out, /^No docs\/agents\/roles\.md: every worker runs on the session's model\. Run smode's setup playbook/);
});

test("show lists roles in order, marks a missing role, and says which candidates this harness runs", () => {
  const out = run(project({ "docs/agents/roles.md": ROLES }), "show", "--channels", "anthropic").out;
  const lines = out.split("\n");
  assert.match(lines[0], /^role\s+#\s+candidate\s+effort\s+here\s+provider check\s+quota\s+last used$/);
  assert.match(out, /^scout\s+1\s+anthropic\/claude-haiku-5-5\s+low\s+yes$/m);
  assert.match(out, /^\s+2\s+google\/gemini-3\.8-flash via=antigravity\s+low\s+no$/m);
  assert.match(out, /^\s+2\s+cursor\/composer-2\.5\s+no$/m);
  assert.match(out, /^coordinator\s+-\s+\(session model\)$/m);
  assert.match(out, /No factory-v2 memory for this project/);
  assert.match(run(project({ "docs/agents/roles.md": ROLES }), "show").out, /^scout\s+1\s+anthropic\/claude-haiku-5-5\s+low\s+\?$/m);
});

test("show reads provider checks, quota blocks and last use from the factory-v2 memory", () => {
  const memory = fs.mkdtempSync(path.join(os.tmpdir(), "smode-memory-"));
  const files = {
    "providers.md": [
      "# Providers",
      "",
      "anthropic/claude-haiku-5-5 | asks: yes | files: tool | result: PASS 2026-11-15",
      "cursor/composer-2.5 | asks: no | files: shell | result: FAIL 2026-11-15 (ran in the wrong checkout)",
      "cursor/composer-2.5 | asks: no | files: tool | result: PASS 2026-11-16 (rerun)",
      "xai/grok-4.7 via=cursor | not checked: usage limit | result: NOT CHECKED 2026-11-15",
    ].join("\n"),
    "quota.md": [
      "# Quota",
      "",
      "google/gemini-4-hydrogen via=antigravity | blocked until 2026-11-18T12:00Z | since 2026-11-18T10:00Z | 01 reviewer | usage limit",
      "anthropic/claude-fable-5-2 | blocked until 2026-11-17T08:00Z | since 2026-11-16T08:00Z | 02 planner | weekly usage",
    ].join("\n"),
    "results/01-implementer-1.json": JSON.stringify({ route: "anthropic/claude-sonnet-5-5" }),
    "results/01-planner-1.json": JSON.stringify({ role: "planner" }),
    "results/broken.json": "{",
  };
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(memory, rel)), { recursive: true });
    fs.writeFileSync(path.join(memory, rel), content);
  }
  fs.utimesSync(path.join(memory, "results/01-implementer-1.json"), new Date("2026-11-17T09:30:00Z"), new Date("2026-11-17T09:30:00Z"));
  const root = project({ "docs/agents/roles.md": ROLES, "docs/agents/factory-v2.md": `# Factory\n\nFactory: v2\nMemory: ${memory}\n` });
  const out = run(root, "show", "--now", "2026-11-18T11:00:00Z").out;
  assert.match(out, /anthropic\/claude-haiku-5-5\s+low\s+\?\s+PASS 2026-11-15/);
  assert.match(out, /cursor\/composer-2\.5\s+\?\s+PASS 2026-11-16/);
  assert.match(out, /xai\/grok-4\.7 via=cursor\s+high\s+\?\s+NOT CHECKED 2026-11-15/);
  assert.match(out, /google\/gemini-4-hydrogen via=antigravity\s+high\s+\?\s+not checked\s+blocked until 2026-11-18T12:00Z/);
  assert.match(out, /anthropic\/claude-fable-5-2\s+high\s+\?\s+not checked\s+expired 2026-11-17T08:00Z/);
  assert.match(out, /anthropic\/claude-sonnet-5-5\s+medium\s+\?\s+not checked\s+2026-11-17T09:30Z/);
  assert.doesNotMatch(out, /No factory-v2 memory/);
});

test("show and check refuse unknown commands and flags without values", () => {
  const root = project();
  assert.equal(run(root, "list").code, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, "show", "--root"], { encoding: "utf8" }).status, 2);
});
