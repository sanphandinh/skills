import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadUpstream, renderList, renderSkillsIndex, saveUpstream, upstreamAdd, upstreamPull, upstreamStatus, validate, writeSkillsIndexes } from "./lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CATALOG = `plugins:
  core:
    platform: shared
    prefix: ""
  mkt:
    platform: shared
    prefix: "mkt-"
  core-claude:
    platform: claude
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
    "plugins/core/skills/alpha/SKILL.md": skill("alpha", "disable-model-invocation: true\n"),
    "plugins/mkt/skills/mkt-launch/SKILL.md": skill("mkt-launch"),
    "plugins/core-claude/.claude-plugin/plugin.json": "{}",
    ...files,
  });
  return root;
}

const messages = (root) => validate(root).issues.map((i) => `${i.file}: ${i.msg}`).join("\n");

test("a clean repo validates, including portable invocation keys", () => {
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

test("a URL path that starts with a skill name is not a skill invocation", () => {
  assert.equal(messages(repo({ "plugins/core/skills/beta/SKILL.md": skill("beta", "", "Mount it under `/alpha/<name>`.\n") })), "");
});

test("Codex metadata is not kept: Codex is not a supported harness (ADR-0006)", () => {
  const msgs = messages(repo({ "plugins/core/skills/alpha/agents/openai.yaml": "policy:\n  allow_implicit_invocation: false\n" }));
  assert.match(msgs, /alpha\/agents\/openai\.yaml: Codex metadata; Codex is not a supported harness/);
});

test("platform skills may use their platform's frontmatter", () => {
  assert.equal(messages(repo({ "plugins/core-claude/skills/deep/SKILL.md": skill("deep", "context: fork\nagent: Explore\nmodel: opus\n") })), "");
});

test("no plugin carries agents: delegation picks the model from the project's roles (ADR-0005)", () => {
  const msgs = messages(
    repo({
      "plugins/core-claude/agents/reviewer.md": agent("reviewer", "model: opus\n"),
      "plugins/core-claude/agents/nested/planner.toml": "",
      "plugins/core/agents/stray.md": agent("stray"),
    }),
  );
  assert.match(msgs, /core-claude\/agents\/reviewer\.md: plugins carry no agents \(ADR-0005\)/);
  assert.match(msgs, /core-claude\/agents\/nested\/planner\.toml: plugins carry no agents/);
  assert.match(msgs, /core\/agents\/stray\.md: plugins carry no agents/);
  assert.doesNotMatch(messages(repo()), /agents/);
});

test("list prints one header per plugin, with its skills below it", () => {
  const root = repo({
    "catalog.yaml": `${CATALOG}  empty:\n    platform: shared\n`,
    "plugins/core-claude/skills/deep/SKILL.md": skill("deep"),
  });
  assert.equal(
    renderList(root),
    [
      "core (shared):",
      "  skill  alpha",
      "mkt (shared):",
      "  skill  mkt-launch",
      "core-claude (claude):",
      "  skill  deep",
      "",
    ].join("\n"),
  );
});

test("list prints nothing for a catalog with no skills", () => {
  const root = tmp();
  put(root, { "catalog.yaml": "plugins:\n  empty:\n    platform: shared\n" });
  assert.equal(renderList(root), "");
});

// ---------- upstream ----------

const UPSTREAM_MD = (src) => `---
repo: ${src}
remote: upstream
branch: main
rewrites:
  - pattern: "\`/([a-z][a-z0-9-]+)\`"
    replace: the \`$1\` skill
    skillGroups: [1]
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
    "skills/eng/bar/SKILL.md": skill("bar"),
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
  assert.ok(!fs.existsSync(path.join(dir, "agents/openai.yaml")), "Codex metadata is dropped (ADR-0006)");
});

test("upstream add rewrites only slash names of real skills", () => {
  const { up, local } = upstreamPair();
  put(up, { "skills/eng/paths/SKILL.md": skill("paths") + "Fall back to `/tmp`, then `/clear` the session and run `/bar`.\n" });
  git(up, "add", ".");
  git(up, "commit", "-qm", "paths");
  upstreamAdd(local, "skills/eng/paths", "core");
  const md = fs.readFileSync(path.join(local, "plugins/core/skills/paths/SKILL.md"), "utf8");
  assert.match(md, /Fall back to `\/tmp`, then `\/clear` the session and run the `bar` skill\./);
});

test("this repo's rewrite rules turn slash skills into plain references and leave the rest alone", () => {
  const { up, local } = upstreamPair();
  const cfg = loadUpstream(local);
  cfg.config.rewrites = loadUpstream(REPO_ROOT).config.rewrites;
  saveUpstream(cfg);
  put(up, {
    "skills/eng/prose/SKILL.md":
      skill("prose") + "Use the `/bar` vocabulary and the `/bar` skill. Fall back to `/tmp`, run `/clear`, then use /bar.\n",
  });
  git(up, "add", ".");
  git(up, "commit", "-qm", "prose");
  upstreamAdd(local, "skills/eng/prose", "core");
  const md = fs.readFileSync(path.join(local, "plugins/core/skills/prose/SKILL.md"), "utf8");
  assert.match(md, /Use the `bar` skill vocabulary and the `bar` skill\. Fall back to `\/tmp`, run `\/clear`, then use the `bar` skill\./);
});

test("upstream pull keeps local edits and brings in upstream changes", () => {
  const { up, local, dir } = upstreamPair();
  const file = path.join(dir, "SKILL.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Line one.", "Line one, edited locally."));
  editUpstream(up, "Line three.", "Line three, improved upstream.", { "skills/eng/foo/EXTRA.md": "new reference\n" });

  const st = upstreamStatus(local);
  assert.equal(st.rows.find((r) => r.name === "foo-local").state, "changed");
  assert.deepEqual(st.candidates, ["skills/eng/bar", "skills/eng/other"]);

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

// A mode skill: a shared skill that carries a skills index and playbooks.
// A skill that starts only when named: the frontmatter key and the Codex policy.
const userSkill = (name, body = "Body.\n") => ({
  [`plugins/core/skills/${name}/SKILL.md`]: skill(name, "disable-model-invocation: true\n", body),
});

function modeRepo(files = {}) {
  const root = repo({
    "plugins/core/skills/mode/SKILL.md": skill("mode", 'argument-hint: "[<playbook>] <task>"\n', "It calls the `alpha` skill.\n\n## Playbooks\n\n| Signal | Playbook |\n|---|---|\n| a question | Investigation (`playbooks/investigation.md`) |\n"),
    "plugins/core/skills/mode/playbooks/investigation.md": "1. Use the `alpha` skill.\n",
    "plugins/core/skills/mode/skills-index.md": "",
    ...files,
  });
  writeSkillsIndexes(root);
  return root;
}

test("the skills index lists every shared skill with its plugin and goes stale when a skill is added", () => {
  const root = modeRepo();
  const index = fs.readFileSync(path.join(root, "plugins/core/skills/mode/skills-index.md"), "utf8");
  assert.match(index, /^- alpha: core$/m);
  assert.match(index, /^- mkt-launch: mkt$/m);
  assert.match(index, /^- mode: core$/m);
  assert.equal(index, renderSkillsIndex(root));
  assert.equal(messages(root), "");
  put(root, { "plugins/core/skills/gamma/SKILL.md": skill("gamma") });
  assert.match(messages(root), /plugins\/core\/skills\/mode\/skills-index\.md: skills index is stale; run `npm run index`/);
});

test("a mode skill whose skills index is missing still fails validation", () => {
  const root = modeRepo({ "plugins/core/skills/mode/playbooks/bug-fix.md": "1. Use the `nope` skill.\n" });
  fs.rmSync(path.join(root, "plugins/core/skills/mode/skills-index.md"));
  const msgs = messages(root);
  assert.match(msgs, /plugins\/core\/skills\/mode\/skills-index\.md: mode skill has no skills index; run `npm run index`/);
  assert.match(msgs, /bug-fix\.md:1: names skill "nope", which does not exist/);
  writeSkillsIndexes(root);
  assert.doesNotMatch(messages(root), /skills index/);
});

test("a mode skill may name only skills and playbooks that exist", () => {
  const msgs = messages(
    modeRepo({
      "plugins/core/skills/mode/playbooks/bug-fix.md": "1. Use the `nope` skill, then the `ghost` playbook.\n2. See playbooks/missing.md.\n",
    }),
  );
  assert.match(msgs, /bug-fix\.md:1: names skill "nope", which does not exist/);
  assert.match(msgs, /bug-fix\.md:1: names playbook "ghost", which has no file in playbooks\//);
  assert.match(msgs, /bug-fix\.md:2: links playbooks\/missing\.md, which does not exist/);
});

test("skills assume no install layout: plugin folders, a marketplace name, a checkout's depth", () => {
  const msgs = messages(
    repo({
      "plugins/core/skills/beta/SKILL.md": skill("beta", "", "Read plugins/core/skills/alpha/SKILL.md, three folders up.\n"),
      "plugins/core/skills/beta/harness/claude-code.md": "Read `core@sanphan-skills` from the install record.\n",
    }),
  );
  assert.match(msgs, /beta\/SKILL\.md:\d+: assumes one install layout: plugins\/core\/skills\//);
  assert.match(msgs, /beta\/harness\/claude-code\.md:1: assumes one install layout: @sanphan-skills/);
  assert.equal(messages(repo({ "plugins/core/skills/beta/SKILL.md": skill("beta", "", "Read `alpha/SKILL.md` next to this skill's folder.\n") })), "");
});

test("a skill does not cite this repository's ADRs; an example ADR of the project is fine", () => {
  const msgs = messages(
    repo({
      "docs/adr/0004-roles.md": "# Roles\n",
      "plugins/core/skills/beta/SKILL.md": skill("beta", "", "Read the roles file (ADR-0004).\n\n> _Contradicts ADR-0007, but worth reopening_\n"),
      "plugins/core/skills/beta/harness/opencode.md": "Before ADR-0004, roles were keys.\n",
    }),
  );
  assert.match(msgs, /beta\/SKILL\.md:\d+: cites this repository's ADR-0004/);
  assert.match(msgs, /beta\/harness\/opencode\.md:1: cites this repository's ADR-0004/);
  assert.doesNotMatch(msgs, /ADR-0007/);
});

test("harness and T3 tool names stay in harness/ and references/", () => {
  const msgs = messages(
    modeRepo({
      "plugins/core/skills/mode/playbooks/investigation.md": "1. Use the `alpha` skill.\n2. Spawn a worker with delegate_task.\n",
      "plugins/core/skills/mode/harness/t3.md": "| spawn a worker | `delegate_task` with `isolation: \"worktree\"` |\n| ask a person | AskUserQuestion, or `$alpha` |\n",
      ...userSkill("beta", "Read references/t3.md.\n"),
      "plugins/core/skills/beta/references/t3.md": "Each step is a fresh `delegate_task`; wakes use `schedule_task`.\n",
    }),
  );
  assert.match(msgs, /investigation\.md:2: names a T3 tool: delegate_task; tool names belong in harness\/ or references\/ \(ADR-0003\)/);
  assert.doesNotMatch(msgs, /harness\/t3\.md/);
  assert.doesNotMatch(msgs, /references\/t3\.md/);
});

test("harness config paths stay in harness/ and references/; skills read docs/agents/", () => {
  const msgs = messages(
    modeRepo({
      "plugins/core/skills/mode/playbooks/investigation.md": "1. Use the `alpha` skill.\n2. Read the roles in ~/.claude/rules/smode-roles.md.\n",
      "plugins/core/skills/mode/harness/cursor.md": "Agents live in `~/.cursor/agents/`.\n",
      ...userSkill("beta", "Write `~/.config/opencode/agents/worker.md`.\n"),
    }),
  );
  assert.match(msgs, /investigation\.md:2: names a harness's config path: ~\/\.claude; skills read docs\/agents\//);
  assert.match(msgs, /beta\/SKILL\.md:\d+: names a harness's config path: ~\/\.config\/opencode/);
  assert.doesNotMatch(msgs, /harness\/cursor\.md/);
});

test("the roles template a project copies must pass the roles check", () => {
  assert.equal(messages(modeRepo({ "plugins/core/skills/mode/roles-template.md": "# Roles\n\nworker: anthropic/claude-sonnet-5-5 effort=medium\n" })), "");
  const msgs = messages(modeRepo({ "plugins/core/skills/mode/roles-template.md": "# Roles\n\narchitect: anthropic/claude-opus-5-5\nworker: sonnet\n" }));
  assert.match(msgs, /mode\/roles-template\.md:3: "architect" is not a role/);
  assert.match(msgs, /mode\/roles-template\.md:4: worker: "sonnet" is not <provider>\/<model>/);
});

test("a skill reads only result keys that the mode skill's RESULTS.md defines", () => {
  const results = "# Result objects\n\n## Common keys\n\n- `step`: the step.\n\n## build\n\n- `head_sha`: the commit.\n- `criteria`: per criterion:\n  - `status`: pass or fail.\n";
  const ok = modeRepo({
    "plugins/core/skills/mode/RESULTS.md": results,
    ...userSkill("beta"),
    "plugins/core/skills/beta/PLAYBOOK.md": "Check the result's `step`, then the build result's `head_sha` and each criterion's result's `status`.\n",
  });
  assert.equal(messages(ok), "");
  const msgs = messages(
    modeRepo({
      "plugins/core/skills/mode/RESULTS.md": results,
      ...userSkill("beta"),
      "plugins/core/skills/beta/PLAYBOOK.md": "Merge at the result's `headSha`.\n",
    }),
  );
  assert.match(msgs, /beta\/PLAYBOOK\.md:1: reads the result key "headSha", which RESULTS\.md does not define/);
});

test("in a plugin with a mode skill, only the mode skill starts on its own (ADR-0005)", () => {
  assert.equal(messages(modeRepo(userSkill("beta"))), "");
  const msgs = messages(
    modeRepo({
      "plugins/core/skills/beta/SKILL.md": skill("beta"),
      "plugins/core/skills/gamma/SKILL.md": skill("gamma", "disable-model-invocation: true\n"),
    }),
  );
  assert.match(msgs, /beta\/SKILL\.md: starts on its own beside the mode skill "mode"; set disable-model-invocation: true/);
  assert.doesNotMatch(msgs, /gamma/);
  assert.match(messages(modeRepo({ "plugins/core/skills/mode/SKILL.md": skill("mode", "disable-model-invocation: true\n", "## Playbooks\n\n(`playbooks/investigation.md`)\n") })), /mode\/SKILL\.md: the mode skill is the entry point; remove disable-model-invocation/);
});

test("argument-hint is one quoted line, and the mode skill's lets a person name the playbook", () => {
  assert.equal(messages(repo({ "plugins/core/skills/beta/SKILL.md": skill("beta", 'argument-hint: "[override]"\n') })), "");
  assert.match(messages(repo({ "plugins/core/skills/beta/SKILL.md": skill("beta", "argument-hint: [override]\n") })), /beta\/SKILL\.md: argument-hint must be one quoted line/);
  const mode = (hint) => messages(modeRepo({ "plugins/core/skills/mode/SKILL.md": skill("mode", hint, "## Playbooks\n\n(`playbooks/investigation.md`)\n") }));
  assert.match(mode('argument-hint: "<task>"\n'), /mode\/SKILL\.md: a person invoking the mode skill may name the playbook/);
  assert.match(mode(""), /mode\/SKILL\.md: a person invoking the mode skill may name the playbook/);
  assert.doesNotMatch(mode('argument-hint: "[<playbook>] <task>"\n'), /name the playbook/);
});

test("every playbook is routed from the mode skill's Playbooks section", () => {
  const msgs = messages(modeRepo({ "plugins/core/skills/mode/playbooks/orphan.md": "1. Do it.\n" }));
  assert.match(msgs, /mode\/playbooks\/orphan\.md: no row of the Playbooks section in SKILL\.md routes to this playbook/);
  assert.doesNotMatch(msgs, /investigation\.md: no row/);
});
