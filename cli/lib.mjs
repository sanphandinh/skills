// Repo tooling: catalog, validation (skills, plugins, roles template), upstream tracking.
// Installing into projects is left to each agent's native plugin system.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { parseRoles } from "../plugins/software/skills/factory/scripts/roles.mjs";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const TEXT_EXT = new Set([".md", ".yaml", ".yml", ".json", ".sh", ".py", ".mjs", ".js", ".ts", ".toml", ".txt", ""]);

// Frontmatter keys a shared skill may carry: the Agent Skills standard plus the
// invocation keys that Claude Code, OpenCode, Antigravity and Cursor honour.
export const SHARED_SKILL_KEYS = ["name", "description", "disable-model-invocation", "argument-hint", "license", "compatibility", "metadata"];

// ---------- small helpers ----------

export function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitOk(cwd, args) {
  return spawnSync("git", args, { cwd, stdio: "ignore" }).status === 0;
}

function readYaml(file, fallback = undefined) {
  if (!fs.existsSync(file)) return fallback;
  return YAML.parse(fs.readFileSync(file, "utf8")) ?? fallback;
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "__pycache__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

function isText(file) {
  return TEXT_EXT.has(path.extname(file).toLowerCase());
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------- frontmatter ----------

export function parseSkillMd(text) {
  const m = text.match(FM_RE);
  if (!m) return { frontmatter: null, body: text };
  return { frontmatter: parseFrontmatter(m[1]), body: text.slice(m[0].length) };
}

// Agents accept loose frontmatter such as an unquoted description containing ": ".
// Fall back to one `key: value` per line when strict YAML rejects it.
function parseFrontmatter(src) {
  try {
    return YAML.parse(src) ?? {};
  } catch (err) {
    const out = {};
    for (const line of src.split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!kv) throw err;
      const v = kv[2].replace(/^(["'])(.*)\1$/, "$2");
      out[kv[1]] = v === "true" ? true : v === "false" ? false : v;
    }
    return out;
  }
}

// Rename a skill by editing only its `name:` line, so the rest of the
// frontmatter stays byte-identical to its source (keeps upstream merges clean).
export function renameSkillText(text, name) {
  const m = text.match(FM_RE);
  if (!m) throw new Error("SKILL.md has no frontmatter");
  return m[0].replace(/^name:.*$/m, `name: ${name}`) + text.slice(m[0].length);
}

// ---------- catalog and repo contents ----------

export function loadCatalog(root) {
  const catalog = readYaml(path.join(root, "catalog.yaml"));
  if (!catalog?.plugins) throw new Error(`catalog.yaml with a plugins map is missing in ${root}`);
  for (const p of Object.values(catalog.plugins)) p.platform ??= "shared";
  return catalog;
}

export function listSkills(root, catalog = loadCatalog(root)) {
  const skills = [];
  for (const [plugin, info] of Object.entries(catalog.plugins)) {
    const dir = path.join(root, "plugins", plugin, "skills");
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const skillDir = path.join(dir, name);
      if (fs.existsSync(path.join(skillDir, "SKILL.md"))) skills.push({ plugin, platform: info.platform, name, dir: skillDir });
    }
  }
  return skills;
}

export function listAgents(root, catalog = loadCatalog(root)) {
  const agents = [];
  for (const [plugin, info] of Object.entries(catalog.plugins)) {
    const dir = path.join(root, "plugins", plugin, "agents");
    for (const file of walk(dir).filter((f) => f.endsWith(".md") || f.endsWith(".toml"))) {
      agents.push({ plugin, platform: info.platform, file: path.join(dir, file) });
    }
  }
  return agents;
}

// The text of `repo list`: each plugin's header once, then its skills, in
// catalog order.
export function renderList(root, catalog = loadCatalog(root)) {
  const skills = listSkills(root, catalog);
  const lines = [];
  for (const plugin of new Set(skills.map((e) => e.plugin))) {
    lines.push(`${plugin} (${catalog.plugins[plugin].platform}):`);
    for (const s of skills) if (s.plugin === plugin) lines.push(`  skill  ${s.name}`);
  }
  return lines.map((l) => `${l}\n`).join("");
}

// ---------- validation ----------

const TOOL_NAMES = /\b(Skill tool|Task tool|Agent tool|Bash tool|Read tool|Edit tool|Write tool|AskUserQuestion|TodoWrite)\b/;
// T3 Code's orchestration tools. They may appear only where a skill maps actions
// to one harness or one agent manager (ADR-0003).
const T3_TOOL_NAMES =
  /\b(delegate_task|task_status|task_cancel|orchestrator_capabilities|schedule_task|list_scheduled_tasks|delete_scheduled_task|run_scheduled_task_now|create_threads|watch_pull_request|unwatch_pull_request|link_pull_requests?|t3_[a-z_]+)\b/;
// A harness's own configuration paths. Skills read the project's docs/agents/
// (ADR-0004); only a harness doc or a manager's reference may name these.
const HARNESS_CONFIG_PATHS = /(~\/\.(?:claude|cursor|gemini)\b|~\/\.config\/opencode\b|\.claude\/rules\b)/;
// Paths that hold only for one way of installing skills: a plugin folder, a
// marketplace name, or a checkout's layout. A skill may be installed by a
// plugin, copied into a skills folder (`npx skills add`), or run from a
// checkout, so skills are found by name (smode's "Running a skill by name").
const INSTALL_LAYOUT = /(@sanphan-skills\b|\bplugins\/[a-z0-9-]+\/skills\/|\b(?:two|three|four) folders up\b)/;
// The harnesses this repository supports, one doc each in a mode skill's harness/ (ADR-0006).
export const HARNESS_DOCS = ["claude-code.md", "opencode.md", "antigravity.md", "cursor.md"];
// Folders of a shared skill whose job is naming one harness's or manager's tools.
const TOOL_MAPPING_DIRS = ["harness", "references"];
export const SKILLS_INDEX = "skills-index.md";

function inToolMappingDir(file) {
  return TOOL_MAPPING_DIRS.includes(file.split(path.sep)[0]);
}

// ---------- skills index (mode skills find other skills by name) ----------

// Every shared skill with the plugin it ships in, so a mode skill can find a
// skill that lives in another plugin (installed plugins are separate folders).
export function renderSkillsIndex(root, catalog = loadCatalog(root)) {
  const rows = listSkills(root, catalog)
    .filter((s) => s.platform === "shared")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `- ${s.name}: ${s.plugin}`);
  return [
    "# Skills index",
    "",
    "Generated by `npm run index`; do not edit by hand. `npm run validate` fails while it is stale.",
    "",
    "Each line is `<skill>: <plugin>`. The skill's file is `plugins/<plugin>/skills/<skill>/SKILL.md` in a checkout of this repository or in a harness's marketplace clone, and `<installPath>/skills/<skill>/SKILL.md` in an installed plugin. The harness docs say where each harness keeps both.",
    "",
    ...rows,
    "",
  ].join("\n");
}

// Mode skills are the shared skills that carry playbooks or a skills index.
// Playbooks count on their own, so a mode skill whose index was deleted is
// still checked (and `npm run index` writes the index back).
export function modeSkills(root, catalog = loadCatalog(root)) {
  return listSkills(root, catalog).filter(
    (s) => s.platform === "shared" && (fs.existsSync(path.join(s.dir, SKILLS_INDEX)) || fs.existsSync(path.join(s.dir, "playbooks"))),
  );
}

export function writeSkillsIndexes(root) {
  const catalog = loadCatalog(root);
  const index = renderSkillsIndex(root, catalog);
  const written = [];
  for (const s of modeSkills(root, catalog)) {
    fs.writeFileSync(path.join(s.dir, SKILLS_INDEX), index);
    written.push(path.relative(root, path.join(s.dir, SKILLS_INDEX)));
  }
  return written;
}

export function validate(root) {
  const catalog = loadCatalog(root);
  const skills = listSkills(root, catalog);
  const agents = listAgents(root, catalog);
  const names = new Set(skills.map((s) => s.name));
  const issues = [];
  const seen = new Map();
  const add = (file, msg) => issues.push({ file: path.relative(root, file), msg });

  for (const plugin of Object.keys(catalog.plugins)) {
    if (!fs.existsSync(path.join(root, "plugins", plugin))) add(path.join(root, "catalog.yaml"), `plugin "${plugin}" has no folder under plugins/`);
  }

  // This repository's own ADRs. An installed skill runs in another project, whose
  // ADR-0004 (if any) is a different decision, so a skill states its rule instead.
  const adrDir = path.join(root, "docs", "adr");
  const ownAdrs = new Set(fs.existsSync(adrDir) ? fs.readdirSync(adrDir).map((f) => f.match(/^(\d{4})-/)?.[1]).filter(Boolean) : []);

  for (const skill of skills) {
    const skillFile = path.join(skill.dir, "SKILL.md");
    const { frontmatter, body } = parseSkillMd(fs.readFileSync(skillFile, "utf8"));
    if (!frontmatter) {
      add(skillFile, "missing frontmatter");
      continue;
    }
    if (skill.platform === "shared") {
      const extra = Object.keys(frontmatter).filter((k) => !SHARED_SKILL_KEYS.includes(k));
      if (extra.length) add(skillFile, `platform-specific frontmatter in a shared skill (move the skill to a -claude plugin): ${extra.join(", ")}`);
    }
    if (frontmatter.name !== skill.name) add(skillFile, `name "${frontmatter.name}" does not match folder "${skill.name}"`);
    if (!frontmatter.description || String(frontmatter.description).length < 20) add(skillFile, "description is missing or too short to trigger reliably");
    // The hint a harness shows after /<skill>. Unquoted, `[override]` parses as a YAML list.
    const hint = frontmatter["argument-hint"];
    if (hint !== undefined && (typeof hint !== "string" || !hint.trim() || hint.includes("\n"))) {
      add(skillFile, 'argument-hint must be one quoted line, such as "[<ticket>]"');
    }
    const prefix = catalog.plugins[skill.plugin]?.prefix ?? "";
    if (prefix && !skill.name.startsWith(prefix)) add(skillFile, `name must start with plugin prefix "${prefix}"`);
    if (seen.has(skill.name)) add(skillFile, `duplicate skill name, also in plugin ${seen.get(skill.name)}`);
    seen.set(skill.name, skill.plugin);
    if (fs.existsSync(path.join(skill.dir, "overlays"))) add(path.join(skill.dir, "overlays"), "overlays/ is not read by any agent; use frontmatter");
    if (fs.existsSync(path.join(skill.dir, "agents", "openai.yaml"))) add(path.join(skill.dir, "agents", "openai.yaml"), "Codex metadata; Codex is not a supported harness (ADR-0006): delete it");

    if (skill.platform !== "shared") continue;
    for (const file of walk(skill.dir).filter((f) => f.endsWith(".md"))) {
      const text = file === "SKILL.md" ? body : fs.readFileSync(path.join(skill.dir, file), "utf8");
      const mapsTools = inToolMappingDir(file);
      text.split("\n").forEach((line, i) => {
        const where = `${path.join(skill.dir, file)}:${i + 1}`;
        if (/^(<{7}|>{7})( |$)/.test(line)) add(where, "unresolved merge conflict marker");
        for (const m of line.matchAll(/\bADR-(\d{4})\b/g)) {
          if (ownAdrs.has(m[1])) add(where, `cites this repository's ADR-${m[1]}; the skill runs in another project, whose ADRs are its own: state the rule itself`);
        }
        if (INSTALL_LAYOUT.test(line)) add(where, `assumes one install layout: ${line.match(INSTALL_LAYOUT)[0]}; find a skill by name, as smode's "Running a skill by name" does`);
        if (mapsTools) return;
        if (TOOL_NAMES.test(line)) add(where, `names a specific agent tool: ${line.match(TOOL_NAMES)[0]}`);
        if (T3_TOOL_NAMES.test(line)) add(where, `names a T3 tool: ${line.match(T3_TOOL_NAMES)[0]}; tool names belong in harness/ or references/ (ADR-0003)`);
        if (HARNESS_CONFIG_PATHS.test(line)) add(where, `names a harness's config path: ${line.match(HARNESS_CONFIG_PATHS)[0]}; skills read docs/agents/, harness paths belong in harness/ or references/ (ADR-0004)`);
        for (const m of line.matchAll(/(?:^|[\s`(])[/$]([a-z][a-z0-9-]+)\b(?!\/)/g)) {
          if (names.has(m[1])) add(where, `invokes skill with agent syntax "${m[0].trim()}"; refer to it by name`);
        }
      });
    }
  }

  // Mode skills: the skills index matches the repository, and every skill and
  // playbook their prose names exists.
  const index = renderSkillsIndex(root, catalog);
  for (const mode of modeSkills(root, catalog)) {
    const indexFile = path.join(mode.dir, SKILLS_INDEX);
    if (!fs.existsSync(indexFile)) add(indexFile, "mode skill has no skills index; run `npm run index`");
    else if (fs.readFileSync(indexFile, "utf8") !== index) add(indexFile, "skills index is stale; run `npm run index`");
    const playbooks = new Set(walk(path.join(mode.dir, "playbooks")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
    for (const file of walk(mode.dir).filter((f) => f.endsWith(".md") && f !== SKILLS_INDEX && !inToolMappingDir(f))) {
      fs.readFileSync(path.join(mode.dir, file), "utf8")
        .split("\n")
        .forEach((line, i) => {
          const where = `${path.join(mode.dir, file)}:${i + 1}`;
          for (const m of line.matchAll(/`([a-z][a-z0-9-]*)` skills?\b/g)) {
            if (!names.has(m[1])) add(where, `names skill "${m[1]}", which does not exist`);
          }
          for (const m of line.matchAll(/`([a-z][a-z0-9-]*)` playbooks?\b/g)) {
            if (!playbooks.has(m[1])) add(where, `names playbook "${m[1]}", which has no file in playbooks/`);
          }
          for (const m of line.matchAll(/\bplaybooks\/([a-z][a-z0-9-]*)\.md\b/g)) {
            if (!playbooks.has(m[1])) add(where, `links playbooks/${m[1]}.md, which does not exist`);
          }
          // The mode skill works alone; delegation by role is the factory's (ADR-0006).
          const delegation = line.match(/docs\/agents\/roles\.md|\broles\.mjs\b|`(?:scout|thinker|reviewer|coordinator)`|\bfresh worker/);
          if (delegation) add(where, `delegates by role ("${delegation[0]}"); the mode skill works alone, and only the factory delegates (ADR-0006)`);
        });
    }
  }

  // One manifest per harness that installs plugins (ADR-0006), all at one version.
  const MANIFEST_DIRS = [".claude-plugin", ".cursor-plugin", ".antigravity-plugin"];
  const MANIFESTS = MANIFEST_DIRS.map((d) => path.join(d, "plugin.json"));
  const versionOf = new Map();
  for (const plugin of fs.existsSync(path.join(root, "plugins")) ? fs.readdirSync(path.join(root, "plugins")) : []) {
    const present = MANIFESTS.filter((rel) => fs.existsSync(path.join(root, "plugins", plugin, rel)));
    if (catalog.plugins[plugin]?.platform === "shared" && present.length) {
      for (const rel of MANIFESTS.filter((r) => !present.includes(r))) add(path.join(root, "plugins", plugin, rel), `missing: a shared plugin ships a manifest for Claude Code, Cursor and Antigravity (ADR-0006)`);
    }
    for (const rel of present) {
      const file = path.join(root, "plugins", plugin, rel);
      const version = JSON.parse(fs.readFileSync(file, "utf8")).version;
      if (!version) continue;
      const first = versionOf.get(plugin);
      if (!first) versionOf.set(plugin, { version, file });
      else if (first.version !== version) add(file, `version ${version} differs from ${first.version} in ${path.relative(root, first.file)}`);
    }
  }
  // Each marketplace lists exactly the shared plugins that ship a manifest.
  const listed = [...versionOf.keys()].filter((p) => catalog.plugins[p]?.platform === "shared").sort();
  for (const dir of [".claude-plugin", ".cursor-plugin"]) {
    const file = path.join(root, dir, "marketplace.json");
    if (!fs.existsSync(file)) {
      if (listed.length) add(file, "missing: the marketplace lists the shared plugins");
      continue;
    }
    const names = (JSON.parse(fs.readFileSync(file, "utf8")).plugins ?? []).map((e) => e.name).sort();
    if (names.join(",") !== listed.join(",")) add(file, `lists ${names.join(", ") || "nothing"}; the shared plugins are ${listed.join(", ")}`);
  }
  // A mode skill is the entry point of its plugin (ADR-0005): it starts on its
  // own, and every other skill of the plugin starts only when named.
  for (const mode of modeSkills(root, catalog)) {
    const modeFile = path.join(mode.dir, "SKILL.md");
    const modeFm = parseSkillMd(fs.readFileSync(modeFile, "utf8")).frontmatter ?? {};
    if (modeFm["disable-model-invocation"] === true) {
      add(modeFile, "the mode skill is the entry point; remove disable-model-invocation");
    }
    if (typeof modeFm["argument-hint"] !== "string" || !modeFm["argument-hint"].includes("<playbook>")) {
      add(modeFile, 'a person invoking the mode skill may name the playbook; set argument-hint: "[<playbook>] <task>"');
    }
    for (const other of skills.filter((s) => s.plugin === mode.plugin && s.name !== mode.name)) {
      const file = path.join(other.dir, "SKILL.md");
      if (parseSkillMd(fs.readFileSync(file, "utf8")).frontmatter?.["disable-model-invocation"] !== true) {
        add(file, `starts on its own beside the mode skill "${mode.name}"; set disable-model-invocation: true`);
      }
    }
    // The supported harnesses (ADR-0006): a mode skill's harness/ holds one doc for each, and no other.
    const harnessDir = path.join(mode.dir, "harness");
    if (fs.existsSync(harnessDir)) {
      const docs = fs.readdirSync(harnessDir).filter((f) => f.endsWith(".md"));
      for (const want of HARNESS_DOCS) if (!docs.includes(want)) add(path.join(harnessDir, want), "missing: every supported harness has a harness doc (ADR-0006)");
      for (const doc of docs) if (!HARNESS_DOCS.includes(doc)) add(path.join(harnessDir, doc), `not a supported harness; the harness docs are ${HARNESS_DOCS.join(", ")} (ADR-0006)`);
    }
    // Every playbook is reachable: a row of the Playbooks section links it.
    const text = fs.readFileSync(modeFile, "utf8");
    const at = text.search(/^## Playbooks\b/m);
    // From "## Playbooks" up to the next level-2 heading; its ### tables are inside.
    const section = at < 0 ? "" : text.slice(at).split(/\n(?=## (?!#))/)[0];
    const routed = new Set([...section.matchAll(/\bplaybooks\/([a-z][a-z0-9-]*)\.md\b/g)].map((m) => m[1]));
    for (const file of walk(path.join(mode.dir, "playbooks")).filter((f) => f.endsWith(".md"))) {
      if (!routed.has(file.slice(0, -3))) add(path.join(mode.dir, "playbooks", file), "no row of the Playbooks section in SKILL.md routes to this playbook");
    }
  }

  // Result objects are defined once, in a mode skill's RESULTS.md (ADR-0005): a
  // skill that reads "the result's `<key>`" may read only keys defined there.
  const resultKeys = new Set();
  for (const mode of modeSkills(root, catalog)) {
    const file = path.join(mode.dir, "RESULTS.md");
    if (fs.existsSync(file)) for (const m of fs.readFileSync(file, "utf8").matchAll(/^\s*- `([a-z][a-z0-9_]*)`:/gm)) resultKeys.add(m[1]);
  }
  if (resultKeys.size) {
    for (const skill of skills.filter((s) => s.platform === "shared")) {
      for (const file of walk(skill.dir).filter((f) => f.endsWith(".md") && f !== "RESULTS.md")) {
        fs.readFileSync(path.join(skill.dir, file), "utf8")
          .split("\n")
          .forEach((line, i) => {
            for (const m of line.matchAll(/\bresult's `([A-Za-z][A-Za-z0-9_]*)`/g)) {
              if (!resultKeys.has(m[1])) add(`${path.join(skill.dir, file)}:${i + 1}`, `reads the result key "${m[1]}", which RESULTS.md does not define`);
            }
          });
      }
    }
  }

  // A roles template a skill copies to a project's docs/agents/roles.md must pass `roles check`.
  for (const skill of skills.filter((s) => s.platform === "shared")) {
    const rolesTemplate = path.join(skill.dir, "roles-template.md");
    if (!fs.existsSync(rolesTemplate)) continue;
    for (const e of parseRoles(fs.readFileSync(rolesTemplate, "utf8")).errors) add(`${rolesTemplate}:${e.line}`, e.msg);
  }

  // Platform agents only restated playbooks and pinned models that delegation
  // now picks from the project's docs/agents/roles.md (ADR-0005).
  for (const agent of agents) {
    add(agent.file, "plugins carry no agents (ADR-0005): describe the step in a smode playbook; delegation picks the model from docs/agents/roles.md");
  }
  return { skills, agents, issues };
}

// ---------- upstream tracking (UPSTREAM.md frontmatter) ----------

export function loadUpstream(root) {
  const file = path.join(root, "UPSTREAM.md");
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(FM_RE);
  if (!m) throw new Error("UPSTREAM.md has no frontmatter");
  return { file, config: YAML.parse(m[1]), body: text.slice(m[0].length) };
}

export function saveUpstream(up) {
  fs.writeFileSync(up.file, `---\n${YAML.stringify(up.config, { lineWidth: 0 })}---\n${up.body}`);
}

// A rule with `skillGroups` rewrites a match only when each listed capture names
// a real skill, so paths (`/tmp`) and harness commands (`/clear`) pass through.
export function applyRewrites(text, rewrites = [], { skills = new Set() } = {}) {
  for (const r of rewrites) {
    if (r.pattern === undefined) {
      text = text.split(r.from).join(r.to);
      continue;
    }
    const re = new RegExp(r.pattern, r.flags ?? "g");
    text = r.skillGroups
      ? text.replace(re, (match, ...groups) =>
          r.skillGroups.every((n) => skills.has(groups[n - 1])) ? r.replace.replace(/\$(\d)/g, (_, n) => groups[n - 1] ?? "") : match,
        )
      : text.replace(re, r.replace);
  }
  return text;
}

// Skill names a rewrite may treat as real: this repo's skills plus every skill
// folder upstream has at `commit`.
function knownSkills(root, commit) {
  const names = new Set(listSkills(root).map((s) => s.name));
  for (const f of git(root, ["ls-tree", "-r", "--name-only", commit]).split("\n")) {
    if (f.endsWith("/SKILL.md")) names.add(path.posix.basename(path.posix.dirname(f)));
  }
  return names;
}

function upstreamRef(cfg) {
  return `${cfg.remote ?? "upstream"}/${cfg.branch ?? "main"}`;
}

export function fetchUpstream(root, cfg) {
  const remote = cfg.remote ?? "upstream";
  if (!gitOk(root, ["remote", "get-url", remote])) git(root, ["remote", "add", remote, cfg.repo]);
  git(root, ["fetch", "--quiet", remote, cfg.branch ?? "main"]);
}

// Export an upstream skill at a commit into a temp dir: renamed to its local
// name and run through the rewrite rules, exactly like the local copy was.
export function exportUpstreamSkill(root, cfg, commit, upstreamPath, localName) {
  const tmp = tmpDir("skills-up-");
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  if (!gitOk(root, ["cat-file", "-e", `${commit}:${upstreamPath}`])) return { dir: null, exists: false, cleanup };
  const tar = execFileSync("git", ["archive", commit, upstreamPath], { cwd: root, maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-C", tmp], { input: tar });
  const dir = path.join(tmp, upstreamPath);
  // Codex metadata is not kept: Codex is not a supported harness (ADR-0006).
  fs.rmSync(path.join(dir, "agents", "openai.yaml"), { force: true });
  if (fs.existsSync(path.join(dir, "agents")) && !fs.readdirSync(path.join(dir, "agents")).length) fs.rmdirSync(path.join(dir, "agents"));
  const skills = knownSkills(root, commit);
  for (const rel of walk(dir).filter(isText)) {
    const f = path.join(dir, rel);
    let text = applyRewrites(fs.readFileSync(f, "utf8"), cfg.rewrites, { skills });
    if (rel === "SKILL.md") text = renameSkillText(text, localName);
    fs.writeFileSync(f, text);
  }
  return { dir, exists: true, cleanup };
}

export function upstreamStatus(root, { fetch = true } = {}) {
  const up = loadUpstream(root);
  const cfg = up.config;
  if (fetch) fetchUpstream(root, cfg);
  const ref = upstreamRef(cfg);
  const head = git(root, ["rev-parse", ref]);
  const rows = [];
  for (const [name, s] of Object.entries(cfg.skills ?? {})) {
    if (!gitOk(root, ["cat-file", "-e", `${head}:${s.path}`])) rows.push({ name, state: "removed-upstream", path: s.path });
    else if (s.commit === head || gitOk(root, ["diff", "--quiet", s.commit, head, "--", s.path])) rows.push({ name, state: "current", path: s.path });
    else {
      const log = git(root, ["log", "--format=%h %s", `${s.commit}..${head}`, "--", s.path]).split("\n").filter(Boolean);
      rows.push({ name, state: "changed", path: s.path, commits: log });
    }
  }
  const tracked = new Set(Object.values(cfg.skills ?? {}).map((s) => s.path));
  const ignored = new Set(cfg.ignore ?? []);
  const candidates = git(root, ["ls-tree", "-r", "--name-only", head, "skills"])
    .split("\n")
    .filter((f) => f.endsWith("/SKILL.md"))
    .map((f) => path.posix.dirname(f))
    .filter((p) => !tracked.has(p) && !ignored.has(p) && !p.includes("/deprecated/"));
  return { head, ref, rows, candidates };
}

function readMaybe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function eq(a, b) {
  return a === null || b === null ? a === b : a.equals(b);
}

// Three-way merge one tracked skill: base = upstream at recorded commit, ours = local,
// theirs = upstream head. Both upstream sides are renamed and rewritten first.
export function upstreamPull(root, name, { fetch = true, to } = {}) {
  const up = loadUpstream(root);
  const cfg = up.config;
  const entry = cfg.skills?.[name];
  if (!entry) throw new Error(`"${name}" is not tracked in UPSTREAM.md`);
  if (fetch) fetchUpstream(root, cfg);
  const head = to ?? git(root, ["rev-parse", upstreamRef(cfg)]);
  const local = listSkills(root).find((s) => s.name === name);
  if (!local) throw new Error(`local skill "${name}" not found under plugins/`);

  const base = exportUpstreamSkill(root, cfg, entry.commit, entry.path, name);
  const theirs = exportUpstreamSkill(root, cfg, head, entry.path, name);
  const result = { name, from: entry.commit, to: head, updated: [], added: [], deleted: [], conflicts: [], notes: [] };
  try {
    if (!theirs.exists) {
      result.notes.push("skill no longer exists upstream; nothing merged. Decide whether to keep it or untrack it.");
      return result;
    }
    const files = new Set([...(base.exists ? walk(base.dir) : []), ...walk(theirs.dir), ...walk(local.dir)]);
    for (const rel of [...files].sort()) {
      const b = base.exists ? readMaybe(path.join(base.dir, rel)) : null;
      const t = readMaybe(path.join(theirs.dir, rel));
      const oPath = path.join(local.dir, rel);
      const o = readMaybe(oPath);
      if (eq(t, b) || eq(o, t)) continue;
      if (eq(o, b)) {
        if (t === null) {
          fs.rmSync(oPath);
          result.deleted.push(rel);
        } else {
          writeFile(oPath, t);
          (o === null ? result.added : result.updated).push(rel);
        }
        continue;
      }
      if (o === null) {
        result.notes.push(`${rel}: deleted locally but changed upstream; left deleted`);
        continue;
      }
      if (t === null) {
        result.notes.push(`${rel}: modified locally but deleted upstream; kept local copy`);
        continue;
      }
      const basePath = b === null ? path.join(theirs.dir, "..", ".empty-base") : path.join(base.dir, rel);
      if (b === null) fs.writeFileSync(basePath, "");
      const r = spawnSync("git", ["merge-file", "-L", "local", "-L", "base", "-L", "upstream", oPath, basePath, path.join(theirs.dir, rel)]);
      if (r.status === 0) {
        if (!fs.readFileSync(oPath).equals(o)) result.updated.push(rel);
      } else if (r.status > 0) result.conflicts.push(rel);
      else throw new Error(`git merge-file failed on ${rel}: ${r.stderr}`);
    }
    entry.commit = head;
    saveUpstream(up);
    return result;
  } finally {
    base.cleanup();
    theirs.cleanup();
  }
}

// Import a new upstream skill into a plugin and start tracking it.
export function upstreamAdd(root, upstreamPath, plugin, { as, fetch = true } = {}) {
  const up = loadUpstream(root);
  const cfg = up.config;
  if (fetch) fetchUpstream(root, cfg);
  const catalog = loadCatalog(root);
  if (!catalog.plugins[plugin]) throw new Error(`unknown plugin "${plugin}"`);
  const name = as ?? path.posix.basename(upstreamPath);
  const dest = path.join(root, "plugins", plugin, "skills", name);
  if (fs.existsSync(dest)) throw new Error(`${path.relative(root, dest)} already exists`);
  const head = git(root, ["rev-parse", upstreamRef(cfg)]);
  const exported = exportUpstreamSkill(root, cfg, head, upstreamPath, name);
  try {
    if (!exported.exists) throw new Error(`${upstreamPath} does not exist at ${upstreamRef(cfg)}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(exported.dir, dest, { recursive: true });
  } finally {
    exported.cleanup();
  }
  cfg.skills ??= {};
  cfg.skills[name] = { path: upstreamPath, commit: head };
  saveUpstream(up);
  return { name, dest, commit: head };
}
