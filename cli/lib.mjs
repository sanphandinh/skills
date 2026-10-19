// Repo tooling: catalog, validation (skills, platform agents, roles), upstream tracking.
// Installing into projects is left to each agent's native plugin system.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const TEXT_EXT = new Set([".md", ".yaml", ".yml", ".json", ".sh", ".py", ".mjs", ".js", ".ts", ".toml", ".txt", ""]);

// Frontmatter keys a shared skill may carry: the Agent Skills standard plus the
// invocation keys that Claude Code and OMP honour and Codex tolerates.
export const SHARED_SKILL_KEYS = ["name", "description", "disable-model-invocation", "argument-hint", "license", "compatibility", "metadata"];
const CLAUDE_MODEL_ALIASES = ["opus", "sonnet", "haiku", "inherit"];
const OMP_BUILTIN_ROLES = ["default", "smol", "slow", "vision", "plan", "commit", "tiny", "memory", "task", "advisor", "web", "judge"];

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

// ROLES.md frontmatter: { roles: { <logical>: { omp: "@role" | [...], claude: alias, codex: {...} } } }
export function loadRoles(root) {
  const file = path.join(root, "ROLES.md");
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, "utf8").match(FM_RE);
  return m ? YAML.parse(m[1]) : null;
}

// ---------- validation ----------

const TOOL_NAMES = /\b(Skill tool|Task tool|Agent tool|Bash tool|Read tool|Edit tool|Write tool|AskUserQuestion|TodoWrite)\b/;

export function validate(root) {
  const catalog = loadCatalog(root);
  const skills = listSkills(root, catalog);
  const agents = listAgents(root, catalog);
  const roles = loadRoles(root);
  const names = new Set(skills.map((s) => s.name));
  const issues = [];
  const seen = new Map();
  const add = (file, msg) => issues.push({ file: path.relative(root, file), msg });

  for (const plugin of Object.keys(catalog.plugins)) {
    if (!fs.existsSync(path.join(root, "plugins", plugin))) add(path.join(root, "catalog.yaml"), `plugin "${plugin}" has no folder under plugins/`);
  }

  for (const skill of skills) {
    const skillFile = path.join(skill.dir, "SKILL.md");
    const { frontmatter, body } = parseSkillMd(fs.readFileSync(skillFile, "utf8"));
    if (!frontmatter) {
      add(skillFile, "missing frontmatter");
      continue;
    }
    if (skill.platform === "shared") {
      const extra = Object.keys(frontmatter).filter((k) => !SHARED_SKILL_KEYS.includes(k));
      if (extra.length) add(skillFile, `platform-specific frontmatter in a shared skill (move the skill to a -claude or -omp plugin): ${extra.join(", ")}`);
    }
    if (frontmatter.name !== skill.name) add(skillFile, `name "${frontmatter.name}" does not match folder "${skill.name}"`);
    if (!frontmatter.description || String(frontmatter.description).length < 20) add(skillFile, "description is missing or too short to trigger reliably");
    const prefix = catalog.plugins[skill.plugin]?.prefix ?? "";
    if (prefix && !skill.name.startsWith(prefix)) add(skillFile, `name must start with plugin prefix "${prefix}"`);
    if (seen.has(skill.name)) add(skillFile, `duplicate skill name, also in plugin ${seen.get(skill.name)}`);
    seen.set(skill.name, skill.plugin);
    if (fs.existsSync(path.join(skill.dir, "overlays"))) add(path.join(skill.dir, "overlays"), "overlays/ is not read by any agent; use frontmatter and agents/openai.yaml");

    if (skill.platform !== "shared") continue;
    for (const file of walk(skill.dir).filter((f) => f.endsWith(".md"))) {
      const text = file === "SKILL.md" ? body : fs.readFileSync(path.join(skill.dir, file), "utf8");
      text.split("\n").forEach((line, i) => {
        const where = `${path.join(skill.dir, file)}:${i + 1}`;
        if (/^(<{7}|>{7})( |$)/.test(line)) add(where, "unresolved merge conflict marker");
        if (TOOL_NAMES.test(line)) add(where, `names a specific agent tool: ${line.match(TOOL_NAMES)[0]}`);
        for (const m of line.matchAll(/(?:^|[\s`(])[/$]([a-z][a-z0-9-]+)\b/g)) {
          if (names.has(m[1])) add(where, `invokes skill with agent syntax "${m[0].trim()}"; refer to it by name`);
        }
      });
    }
  }

  const ompRoles = new Set(OMP_BUILTIN_ROLES);
  for (const r of Object.values(roles?.roles ?? {})) for (const sel of [r.omp ?? []].flat()) ompRoles.add(String(sel).replace(/^@/, ""));
  const agentNames = new Map();
  for (const agent of agents) {
    const text = fs.readFileSync(agent.file, "utf8");
    if (agent.platform === "shared") {
      add(agent.file, "agents belong in a platform plugin (-omp, -claude), not a shared one");
      continue;
    }
    const { frontmatter } = parseSkillMd(text);
    if (!frontmatter?.name || !frontmatter?.description) add(agent.file, "agent needs name and description");
    const key = `${agent.platform}:${frontmatter?.name}`;
    if (agentNames.has(key)) add(agent.file, `duplicate ${agent.platform} agent name, also in ${agentNames.get(key)}`);
    agentNames.set(key, path.relative(root, agent.file));
    if (agent.platform === "omp") {
      if (!fs.existsSync(path.join(root, "plugins", agent.plugin, ".omp-plugin", "plugin.json"))) {
        add(agent.file, "OMP agents need .omp-plugin/plugin.json, or OMP reads them as Claude-dialect and drops `model`");
      }
      for (const sel of [frontmatter?.model ?? []].flat()) {
        if (!String(sel).startsWith("@")) add(agent.file, `model "${sel}" is a concrete model; use a role selector (@role) from ROLES.md`);
        else if (!ompRoles.has(String(sel).slice(1))) add(agent.file, `role "${sel}" is not a built-in OMP role and not listed in ROLES.md`);
      }
    }
    if (agent.platform === "claude") {
      const model = frontmatter?.model;
      if (model && !CLAUDE_MODEL_ALIASES.includes(model)) add(agent.file, `model "${model}" should be one of ${CLAUDE_MODEL_ALIASES.join(", ")} so it follows ROLES.md`);
    }
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
