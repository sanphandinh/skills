import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createForge } from "./lib/forge.mjs";
import { tmp, write } from "./test-helpers.mjs";

// A stand-in `gh` (plain sh) that logs every call and answers per subcommand
// pair ("pr create", "pr checks", ...).
function fakeGh(answers = {}) {
  const dir = tmp("autopilot-gh-");
  const bin = path.join(dir, "gh");
  for (const [key, a] of Object.entries(answers)) {
    const base = path.join(dir, key.replace(" ", "_").replace(/[^A-Za-z0-9_]/g, "_"));
    fs.writeFileSync(`${base}.out`, a.out ?? "");
    fs.writeFileSync(`${base}.err`, a.err ?? "");
    fs.writeFileSync(`${base}.code`, String(a.code ?? 0));
  }
  fs.writeFileSync(
    bin,
    `#!/bin/sh
n=$(ls "${dir}" | grep -c '^call-' )
call="${dir}/call-$(printf %03d "$n")"
for a in "$@"; do printf '%s\\0' "$a" >> "$call.args"; done
cat > "$call.stdin"
key="${dir}/$(printf '%s_%s' "$1" "$2" | tr -c 'A-Za-z0-9_' '_')"
[ -f "$key.out" ] && cat "$key.out"
[ -f "$key.err" ] && cat "$key.err" >&2
[ -f "$key.code" ] && exit $(cat "$key.code")
exit 0
`,
  );
  fs.chmodSync(bin, 0o755);
  return {
    bin,
    calls: () =>
      fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("call-") && f.endsWith(".args"))
        .sort()
        .map((f) => ({
          args: fs.readFileSync(path.join(dir, f), "utf8").split("\0").slice(0, -1),
          stdin: fs.readFileSync(path.join(dir, f.replace(".args", ".stdin")), "utf8"),
        })),
  };
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

test("the forge host comes from the Pull requests line, else from a GitHub or GitLab Tracker line", async () => {
  const { forgeConfig } = await import("./lib/forge.mjs");
  assert.deepEqual(forgeConfig(repoWithTracker("Pull requests: gitlab acme/sub/app")), { kind: "gitlab", repo: "acme/sub/app" });
  assert.deepEqual(forgeConfig(repoWithTracker("Tracker: github acme/app")), { kind: "github", repo: "acme/app" });
  assert.deepEqual(forgeConfig(repoWithTracker("Tracker: jira https://acme.atlassian.net APP\nPull requests: github acme/app")), { kind: "github", repo: "acme/app" });
  assert.throws(() => forgeConfig(repoWithTracker("Tracker: jira https://acme.atlassian.net APP")), /Pull requests:/);
});

test("GitHub: drafts, comments, ready, trunk checks, reruns and the pull request behind a commit, every call pinned", async () => {
  const gh = fakeGh({
    "pr create": { out: "https://github.com/acme/app/pull/7\n" },
    "pr list": { out: JSON.stringify([{ number: 7, url: "https://github.com/acme/app/pull/7", state: "OPEN", isDraft: true, body: "b" }]) },
    "pr view": { out: JSON.stringify({ author: { login: "bot" }, comments: [{ body: "one", author: { login: "bot" } }, { body: "two", author: { login: "stranger" }, authorAssociation: "NONE" }] }) },
    "api repos/acme/app/commits/main/check-runs?per_page=100": { out: JSON.stringify({ check_runs: [{ head_sha: "abc", status: "completed", conclusion: "failure", html_url: "https://github.com/acme/app/runs/1" }] }) },
    "api repos/acme/app/commits/main/status": { out: JSON.stringify({ sha: "abc", state: "failure", statuses: [{ state: "failure", target_url: "https://github.com/acme/app/status/1" }] }) },
    "api repos/acme/app/commits/abc/check-runs?per_page=100": { out: JSON.stringify({ check_runs: [] }) },
    "api repos/acme/app/commits/abc/status": { out: JSON.stringify({ sha: "abc", state: "failure", statuses: [{ state: "failure", target_url: "https://github.com/acme/app/status/1" }] }) },
    "run list": { out: JSON.stringify([{ databaseId: 11, conclusion: "failure" }, { databaseId: 12, conclusion: "success" }]) },
  });
  const forge = createForge({ repoDir: repoWithTracker("Pull requests: github acme/app"), command: gh.bin });
  await forge.openPr({ branch: "autopilot/gh/3", base: "main", title: "3: x", body: "b", draft: true });
  assert.deepEqual(await forge.findPr("autopilot/gh/3"), { number: 7, url: "https://github.com/acme/app/pull/7", state: "open", draft: true, body: "b", author: null });
  assert.deepEqual(await forge.comments(7), [{ body: "one", author: "bot", trusted: true }, { body: "two", author: "stranger", trusted: false }]);
  await forge.markReady(7);
  await forge.updatePr(7, { body: "## New body" });
  assert.deepEqual(await forge.trunkStatus("main"), { sha: "abc", state: "fail", url: "https://github.com/acme/app/runs/1" });
  assert.deepEqual(await forge.statusFor("abc"), { state: "fail", url: "https://github.com/acme/app/status/1" });
  assert.equal(await forge.rerunFailed("abc"), true);
  const calls = gh.calls();
  assert.ok(calls[0].args.includes("--draft"));
  assert.ok(calls.some((c) => c.args.join(" ").startsWith("pr ready 7")));
  assert.equal(calls.find((c) => c.args.join(" ").startsWith("pr edit 7")).stdin, "## New body", "the new body goes through stdin");
  assert.ok(calls.some((c) => c.args.join(" ").startsWith("run rerun 11 --failed")));
  assert.ok(!calls.some((c) => c.args.join(" ").startsWith("run rerun 12")));
  for (const c of calls) {
    if (c.args[0] === "api") assert.match(c.args[1], /^repos\/acme\/app\//, "api calls name the repository in the path");
    else assert.equal(c.args[c.args.indexOf("--repo") + 1], "acme/app", `${c.args.join(" ")} is pinned`);
  }
});
