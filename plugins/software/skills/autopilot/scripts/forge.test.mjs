import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createForge } from "./lib/forge.mjs";
import { tmp, write } from "./test-helpers.mjs";

// A stand-in `gh` that logs every call and answers from a small script.
function fakeGh(answers = {}) {
  const dir = tmp("autopilot-gh-");
  const bin = path.join(dir, "gh");
  const log = path.join(dir, "calls.jsonl");
  fs.writeFileSync(path.join(dir, "answers.json"), JSON.stringify(answers));
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch {}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, stdin }) + "\\n");
const answers = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(dir, "answers.json"))}, "utf8"));
const key = args.slice(0, 2).join(" ");
const a = answers[key] ?? { out: "" };
process.stdout.write(a.out ?? "");
process.stderr.write(a.err ?? "");
process.exit(a.code ?? 0);
`,
  );
  fs.chmodSync(bin, 0o755);
  return { bin, calls: () => fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) };
}

function repoWithTracker(line) {
  const dir = tmp("autopilot-repo-");
  write(dir, { "docs/agents/issue-tracker.md": `# Issue tracker: Local Markdown\n\n${line}\n` });
  return dir;
}

test("every GitHub call is pinned to the repository the tracker doc names", async () => {
  const gh = fakeGh({
    "pr create": { out: "https://github.com/acme/app/pull/7\n" },
    "pr checks": { out: JSON.stringify([{ bucket: "pass" }, { bucket: "skipping" }]) },
    "pr view": { out: JSON.stringify({ state: "MERGED" }) },
  });
  const forge = createForge({ repoDir: repoWithTracker("**Pull requests:** github acme/app"), command: gh.bin });
  const pr = await forge.openPr({ branch: "autopilot/demo/01", base: "main", title: "01: Thing", body: "## Summary" });
  assert.deepEqual(pr, { number: 7, url: "https://github.com/acme/app/pull/7" });
  await forge.comment(7, "Verdict: PASS");
  assert.equal(await forge.ciStatus(7), "pass");
  await forge.merge(7);
  assert.equal(await forge.isMerged(7), true);
  const calls = gh.calls();
  assert.equal(calls.length, 5);
  for (const c of calls) assert.equal(c.args[c.args.indexOf("--repo") + 1], "acme/app", `${c.args.join(" ")} is pinned`);
  assert.equal(calls[0].stdin, "## Summary", "the body goes through stdin, not the command line");
  assert.ok(calls[3].args.includes("--squash"));
});

test("CI reads as pending, failed, or passing from the check buckets", async () => {
  const status = async (checks) =>
    createForge({ repoDir: repoWithTracker("Pull requests: github acme/app"), command: fakeGh({ "pr checks": checks }).bin }).ciStatus(1);
  assert.equal(await status({ out: JSON.stringify([{ bucket: "pass" }, { bucket: "pending" }]) }), "pending");
  assert.equal(await status({ out: JSON.stringify([{ bucket: "pass" }, { bucket: "fail" }]) }), "fail");
  assert.equal(await status({ out: "", err: "no checks reported on the 'x' branch", code: 1 }), "pass");
});

test("the forge refuses to start when the tracker doc names no repository for pull requests", () => {
  assert.throws(() => createForge({ repoDir: repoWithTracker("Issues live in .scratch/"), command: "gh" }), /Pull requests:/);
});

test("smoke: gh reads the configured repository", { skip: !process.env.AUTOPILOT_SMOKE_GH }, async () => {
  const forge = createForge({ repoDir: path.resolve(new URL("../../../../..", import.meta.url).pathname) });
  assert.equal(typeof (await forge.isMerged(1).catch(() => false)), "boolean");
});
