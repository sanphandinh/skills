import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { upstreamAdd, upstreamPull, upstreamStatus, validate } from "./lib.mjs";

const CATALOG = `plugins:
  core:
    platform: shared
    prefix: ""
  mkt:
    platform: shared
    prefix: "mkt-"
  core-omp:
    platform: omp
  core-claude:
    platform: claude
`;

const ROLES = `---
roles:
  reviewer:
    omp: ["@reviewer", "@slow"]
    claude: opus
---
`;

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
}

function put(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
}

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" }).trim();
}

const skill = (name, extra = "", body = "Body.\n") => `---\nname: ${name}\ndescription: Use when testing the repository tooling end to end.\n${extra}---\n\n${body}`;
const agent = (name, extra = "") => `---\nname: ${name}\ndescription: Test agent.\n${extra}---\nBody.\n`;

function repo(files = {}) {
  const root = tmp();
  put(root, {
    "catalog.yaml": CATALOG,
    "ROLES.md": ROLES,
    "plugins/core/skills/alpha/SKILL.md": skill("alpha", "disable-model-invocation: true\n"),
    "plugins/core/skills/alpha/agents/openai.yaml": "policy:\n  allow_implicit_invocation: false\n",
    "plugins/mkt/skills/mkt-launch/SKILL.md": skill("mkt-launch"),
    "plugins/core-omp/.omp-plugin/plugin.json": "{}",
    "plugins/core-omp/agents/reviewer.md": agent("reviewer", 'model: ["@reviewer", "@slow"]\n'),
    "plugins/core-claude/agents/reviewer.md": agent("reviewer", "model: opus\n"),
    ...files,
  });
  return root;
}

const messages = (root) => validate(root).issues.map((i) => `${i.file}: ${i.msg}`).join("\n");

test("a clean repo validates, including portable invocation keys and per-platform agents", () => {
  assert.equal(messages(repo()), "");
});

test("validate flags non-portable skills", () => {
  const msgs = messages(
    repo({
      "plugins/core/skills/beta/SKILL.md": skill("beta", "context: fork\nmodel: opus\n", "Call the Skill tool, then run /alpha.\n"),
      "plugins/core/skills/beta/overlays/claude.yaml": "x: 1\n",
      "plugins/mkt/skills/launch/SKILL.md": skill("launch"),
    }),
  );
  assert.match(msgs, /platform-specific frontmatter in a shared skill.*context, model/);
  assert.match(msgs, /names a specific agent tool: Skill tool/);
  assert.match(msgs, /agent syntax "\/alpha"/);
  assert.match(msgs, /overlays\/ is not read by any agent/);
  assert.match(msgs, /prefix "mkt-"/);
});

test("platform skills may use their platform's frontmatter", () => {
  assert.equal(messages(repo({ "plugins/core-claude/skills/deep/SKILL.md": skill("deep", "context: fork\nagent: Explore\nmodel: opus\n") })), "");
});

test("validate checks OMP agents use roles and carry an OMP manifest", () => {
  const msgs = messages(
    repo({
      "plugins/core-omp/agents/concrete.md": agent("concrete", "model: anthropic/claude-opus-5-5\n"),
      "plugins/core-omp/agents/unknown-role.md": agent("unknown-role", 'model: "@ghost"\n'),
      "plugins/core-omp/agents/builtin.md": agent("builtin", 'model: "@smol"\n'),
    }),
  );
  assert.match(msgs, /concrete\.md: model "anthropic\/claude-opus-5-5" is a concrete model/);
  assert.match(msgs, /unknown-role\.md: role "@ghost" is not a built-in OMP role/);
  assert.doesNotMatch(msgs, /builtin\.md/);

  const root = repo();
  fs.rmSync(path.join(root, "plugins/core-omp/.omp-plugin"), { recursive: true });
  assert.match(messages(root), /OMP agents need \.omp-plugin\/plugin\.json/);
});

test("validate checks Claude agents use model aliases and agents stay out of shared plugins", () => {
  const msgs = messages(
    repo({
      "plugins/core-claude/agents/pinned.md": agent("pinned", "model: claude-opus-5-5\n"),
      "plugins/core/agents/stray.md": agent("stray"),
    }),
  );
  assert.match(msgs, /pinned\.md: model "claude-opus-5-5" should be one of opus, sonnet, haiku, inherit/);
  assert.match(msgs, /stray\.md: agents belong in a platform plugin/);
});

// ---------- upstream ----------

const UPSTREAM_MD = (src) => `---
repo: ${src}
remote: upstream
branch: main
rewrites:
  - pattern: "\`/([a-z][a-z0-9-]+)\`"
    replace: the \`$1\` skill
skills: {}
---
# Upstream
`;

const UPSTREAM_SKILL = `---\nname: foo\ndescription: "Use when testing upstream merges: three way."\ndisable-model-invocation: true\n---\n\nLine one.\nLine two, then run \`/bar\`.\nLine three.\n`;

function upstreamPair() {
  const up = tmp();
  put(up, {
    "skills/eng/foo/SKILL.md": UPSTREAM_SKILL,
    "skills/eng/foo/agents/openai.yaml": "interface:\n  display_name: Foo\n",
    "skills/eng/other/SKILL.md": skill("other"),
  });
  git(up, "init", "-q", "-b", "main");
  git(up, "add", ".");
  git(up, "commit", "-qm", "init");

  const local = repo({ "UPSTREAM.md": UPSTREAM_MD(up) });
  git(local, "init", "-q", "-b", "main");
  upstreamAdd(local, "skills/eng/foo", "core", { as: "foo-local" });
  git(local, "add", ".");
  git(local, "commit", "-qm", "import");
  return { up, local, dir: path.join(local, "plugins/core/skills/foo-local") };
}

function editUpstream(up, from, to, extra = {}) {
  put(up, { "skills/eng/foo/SKILL.md": fs.readFileSync(path.join(up, "skills/eng/foo/SKILL.md"), "utf8").replace(from, to), ...extra });
  git(up, "add", ".");
  git(up, "commit", "-qm", "change");
}

test("upstream add keeps the native layout and only renames and rewrites", () => {
  const { dir } = upstreamPair();
  const expected = UPSTREAM_SKILL.replace("name: foo", "name: foo-local").replace("run `/bar`", "run the `bar` skill");
  assert.equal(fs.readFileSync(path.join(dir, "SKILL.md"), "utf8"), expected, "frontmatter stays byte-identical apart from the name");
  assert.ok(fs.existsSync(path.join(dir, "agents/openai.yaml")));
});

test("upstream pull keeps local edits and brings in upstream changes", () => {
  const { up, local, dir } = upstreamPair();
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Line one.", "Line one, edited locally."));
  editUpstream(up, "Line three.", "Line three, improved upstream.", { "skills/eng/foo/EXTRA.md": "new reference\n" });

  const st = upstreamStatus(local);
  assert.equal(st.rows.find((r) => r.name === "foo-local").state, "changed");
  assert.deepEqual(st.candidates, ["skills/eng/other"]);

  const r = upstreamPull(local, "foo-local");
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.added, ["EXTRA.md"]);
  const md = fs.readFileSync(file, "utf8");
  assert.match(md, /Line one, edited locally\./);
  assert.match(md, /Line three, improved upstream\./);
  assert.match(md, /the `bar` skill/, "rewrite applied on both sides, so no conflict");
  assert.equal(upstreamStatus(local, { fetch: false }).rows.find((r) => r.name === "foo-local").state, "current");
});

test("upstream pull leaves conflict markers when both sides edit the same line", () => {
  const { up, local, dir } = upstreamPair();
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Line one.", "Line one, local."));
  editUpstream(up, "Line one.", "Line one, upstream.");

  const r = upstreamPull(local, "foo-local");
  assert.deepEqual(r.conflicts, ["SKILL.md"]);
  assert.match(fs.readFileSync(file, "utf8"), /<<<<<<< local\nLine one, local\.\n=======\nLine one, upstream\.\n>>>>>>> upstream/);
  assert.ok(validate(local).issues.some((i) => i.msg === "unresolved merge conflict marker"));
});

test("upstream copies with loose YAML frontmatter still import", () => {
  const { up, local, dir } = upstreamPair();
  editUpstream(up, '"Use when testing upstream merges: three way."', "Use when testing upstream merges: three way.");
  const r = upstreamPull(local, "foo-local");
  assert.deepEqual(r.conflicts, []);
  assert.match(fs.readFileSync(path.join(dir, "SKILL.md"), "utf8"), /^description: Use when testing upstream merges: three way\.$/m);
});
