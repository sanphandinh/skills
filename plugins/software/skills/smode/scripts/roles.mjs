#!/usr/bin/env node
// smode's role configuration: docs/agents/roles.md in the project.
//
//   node roles.mjs check [--root <project>]
//   node roles.mjs show  [--root <project>] [--channels <a,b>] [--now <ISO time>]
//
// `check` reports format errors and exits 1 when there are any.
// `show` prints every role's candidates in order with what the factory's memory
// says about each (provider check, quota block, last use) when the project runs
// the factory. `--channels` lists the channels this session's harness runs (its
// harness doc says which); without it the "here" column is `?`.
// No dependencies: it runs from wherever the skill is installed (a plugin, a skills folder), which has no node_modules.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROLES = ["scout", "worker", "thinker", "reviewer", "coordinator"];
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
export const OPTIONS = ["effort", "via"];
export const ROLES_FILE = path.join("docs", "agents", "roles.md");

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// One candidate: `<provider>/<model>` then `key=value` options.
export function parseCandidate(text) {
  const [head, ...opts] = text.trim().split(/\s+/);
  const m = head?.match(/^([^/\s]+)\/(\S+)$/);
  if (!m) return { error: `"${text.trim()}" is not <provider>/<model>` };
  const [, provider, model] = m;
  if (!NAME.test(provider)) return { error: `provider "${provider}" is not a lowercase name` };
  if (!MODEL.test(model)) return { error: `model "${model}" is not a model id` };
  const c = { provider, model, options: {} };
  for (const opt of opts) {
    const kv = opt.match(/^([a-z_]+)=(\S+)$/);
    if (!kv) return { error: `option "${opt}" is not key=value` };
    const [, key, value] = kv;
    if (!OPTIONS.includes(key)) return { error: `option "${key}" is not one of ${OPTIONS.join(", ")}` };
    if (key in c.options) return { error: `option "${key}" is given twice` };
    if (key === "effort" && !EFFORTS.includes(value)) return { error: `effort "${value}" is not one of ${EFFORTS.join(", ")}` };
    if (key === "via" && !NAME.test(value)) return { error: `via "${value}" is not a lowercase name` };
    c.options[key] = value;
  }
  return { candidate: c };
}

// The candidate's identity in the factory's memory: provider, model and channel, never the effort.
export function candidateId(c) {
  return `${c.provider}/${c.model}${c.options.via ? ` via=${c.options.via}` : ""}`;
}

// The channel that runs the candidate: `via`, else the provider itself.
export function channelOf(c) {
  return c.options.via ?? c.provider;
}

// Role lines are `<role>: <candidate>, <candidate>`, lowercase key at the start of the
// line, outside code fences. Everything else is prose.
export function parseRoles(text) {
  const roles = {};
  const errors = [];
  const warnings = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const m = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
    if (!m) return;
    const [, role, rest] = m;
    if (!ROLES.includes(role)) return errors.push({ line: n, msg: `"${role}" is not a role; the roles are ${ROLES.join(", ")}` });
    if (role in roles) return errors.push({ line: n, msg: `role "${role}" is given twice` });
    if (!rest.trim()) return errors.push({ line: n, msg: `role "${role}" has no candidate` });
    const list = [];
    for (const part of rest.split(",")) {
      const r = parseCandidate(part);
      if (r.error) errors.push({ line: n, msg: `${role}: ${r.error}` });
      else if (list.some((c) => candidateId(c) === candidateId(r.candidate))) errors.push({ line: n, msg: `${role}: ${candidateId(r.candidate)} is listed twice` });
      else list.push(r.candidate);
    }
    roles[role] = list;
  });
  // A reviewer checks the worker's change from another model family. The family is the
  // model's maker, the provider part, whatever channel runs it.
  const worker = roles.worker?.[0];
  if (worker && roles.reviewer?.length && roles.reviewer.every((c) => c.provider === worker.provider)) {
    warnings.push(`every reviewer candidate is from ${worker.provider}, like the first worker candidate; a reviewer should be another model family`);
  }
  return { roles, errors, warnings };
}

export function loadRoles(root) {
  const file = path.join(root, ROLES_FILE);
  if (!fs.existsSync(file)) return null;
  return { file, ...parseRoles(fs.readFileSync(file, "utf8")) };
}

// ---------- the factory's memory, read only ----------

function expandHome(p) {
  return p.replace(/^~(?=$|\/)/, os.homedir());
}

// The settings are `docs/agents/factory.md`; `factory-v2.md` is the name they had
// before ADR-0005, kept until the project's factory setup converts it.
export function factoryMemory(root) {
  const settings = ["factory.md", "factory-v2.md"].map((f) => path.join(root, "docs", "agents", f)).find((f) => fs.existsSync(f));
  if (!settings) return null;
  const m = fs.readFileSync(settings, "utf8").match(/^Memory:\s*(.+?)\s*$/m);
  if (!m) return null;
  const dir = expandHome(m[1]);
  return fs.existsSync(dir) ? dir : null;
}

// Lines of `providers.md` and `quota.md` start with the candidate id written the way
// `roles.md` writes it (options other than `via` are ignored).
function idOfMemoryLine(line) {
  const first = line.split("|")[0].trim();
  const r = parseCandidate(first);
  return r.candidate ? candidateId(r.candidate) : null;
}

export function readMemory(dir) {
  const checks = new Map();
  const blocks = new Map();
  const lastUse = new Map();
  if (!dir) return { checks, blocks, lastUse };
  const lines = (name) => (fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), "utf8").split(/\r?\n/) : []);
  for (const line of lines("providers.md")) {
    const id = idOfMemoryLine(line);
    const result = line.match(/result:\s*(PASS|FAIL|NOT CHECKED)(?:\s+(\d{4}-\d{2}-\d{2}))?/);
    if (id && result) checks.set(id, result[2] ? `${result[1]} ${result[2]}` : result[1]); // the last line wins
  }
  for (const line of lines("quota.md")) {
    const id = idOfMemoryLine(line);
    const until = line.match(/blocked until\s+(\S+)/);
    if (id && until) blocks.set(id, until[1]);
  }
  const results = path.join(dir, "results");
  for (const name of fs.existsSync(results) ? fs.readdirSync(results).filter((f) => f.endsWith(".json")) : []) {
    const file = path.join(results, name);
    let route;
    try {
      route = JSON.parse(fs.readFileSync(file, "utf8")).route;
    } catch {
      continue;
    }
    if (typeof route !== "string") continue;
    const r = parseCandidate(route);
    if (!r.candidate) continue;
    const id = candidateId(r.candidate);
    const when = fs.statSync(file).mtime;
    if (!lastUse.has(id) || lastUse.get(id) < when) lastUse.set(id, when);
  }
  return { checks, blocks, lastUse };
}

// ---------- output ----------

const minute = (d) => d.toISOString().slice(0, 16) + "Z";

export function renderShow(root, { channels, now = new Date() } = {}) {
  const loaded = loadRoles(root);
  if (!loaded) return `No ${ROLES_FILE}: every worker runs on the session's model. Run smode's setup playbook to write it.\n`;
  const memoryDir = factoryMemory(root);
  const memory = readMemory(memoryDir);
  const rows = [["role", "#", "candidate", "effort", "here", "provider check", "quota", "last used"]];
  for (const role of ROLES) {
    const list = loaded.roles[role];
    if (!list) {
      rows.push([role, "-", "(session model)", "", "", "", "", ""]);
      continue;
    }
    list.forEach((c, i) => {
      const id = candidateId(c);
      const until = memory.blocks.get(id);
      const quota = !until ? "" : new Date(until) > now ? `blocked until ${until}` : `expired ${until}`;
      const here = channels ? (channels.includes(channelOf(c)) ? "yes" : "no") : "?";
      rows.push([
        i === 0 ? role : "",
        String(i + 1),
        id,
        c.options.effort ?? "",
        here,
        memoryDir ? memory.checks.get(id) ?? "not checked" : "",
        quota,
        memory.lastUse.has(id) ? minute(memory.lastUse.get(id)) : "",
      ]);
    });
  }
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  const out = rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col])).join("  ").trimEnd());
  out.splice(1, 0, widths.map((w) => "-".repeat(w)).join("  "));
  const notes = [];
  if (!memoryDir) notes.push("No factory memory for this project: provider check, quota and last use are empty.");
  for (const e of loaded.errors) notes.push(`error: ${ROLES_FILE}:${e.line}: ${e.msg}`);
  for (const w of loaded.warnings) notes.push(`warning: ${w}`);
  return [...out, ...(notes.length ? ["", ...notes] : [])].join("\n") + "\n";
}

export function renderCheck(root) {
  const loaded = loadRoles(root);
  if (!loaded) return { text: `No ${ROLES_FILE}: every worker runs on the session's model.\n`, ok: true };
  const lines = [
    ...loaded.errors.map((e) => `${ROLES_FILE}:${e.line}: ${e.msg}`),
    ...loaded.warnings.map((w) => `warning: ${w}`),
  ];
  const count = Object.values(loaded.roles).reduce((a, l) => a + l.length, 0);
  lines.push(`${Object.keys(loaded.roles).length} role(s), ${count} candidate(s), ${loaded.errors.length} error(s)`);
  return { text: lines.join("\n") + "\n", ok: loaded.errors.length === 0 };
}

function main(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith("--") || rest[i + 1] === undefined) return usage();
    flags[rest[i].slice(2)] = rest[i + 1];
  }
  const root = path.resolve(flags.root ?? process.cwd());
  if (command === "check") {
    const { text, ok } = renderCheck(root);
    process.stdout.write(text);
    return ok ? 0 : 1;
  }
  if (command === "show") {
    const now = flags.now ? new Date(flags.now) : new Date();
    process.stdout.write(renderShow(root, { channels: flags.channels?.split(",").filter(Boolean), now }));
    return 0;
  }
  return usage();
}

function usage() {
  process.stderr.write("usage: roles.mjs check [--root <project>]\n       roles.mjs show [--root <project>] [--channels <a,b>] [--now <ISO time>]\n");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
