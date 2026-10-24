#!/usr/bin/env node
// Repo tooling for this skills marketplace: list, validate, track upstream.
// Projects install plugins with each agent's own plugin commands, not with this tool.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { listAgents, listSkills, upstreamAdd, upstreamPull, upstreamStatus, validate } from "./lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `repo <command> [options]

  list                      Skills and agents per plugin.
  validate                  Check skills, platform agents, and roles against the repo rules.
  upstream status [--no-fetch]
                            Tracked upstream skills that changed, and untracked candidates.
  upstream pull <skill...|--all> [--no-fetch]
                            Three-way merge upstream changes into local skills.
  upstream add <upstream-path> <plugin> [--as NAME]
                            Import a new upstream skill and start tracking it.
`;

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(2);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      "no-fetch": { type: "boolean" },
      all: { type: "boolean" },
      as: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const fetch = !values["no-fetch"];
  if (!cmd || values.help || cmd === "help") return console.log(HELP);

  switch (cmd) {
    case "list": {
      const agents = listAgents(REPO_ROOT);
      let plugin;
      for (const s of listSkills(REPO_ROOT)) {
        if (s.plugin !== plugin) console.log(`${(plugin = s.plugin)} (${s.platform}):`);
        console.log(`  skill  ${s.name}`);
      }
      for (const a of agents) console.log(`${a.plugin} (${a.platform}):\n  agent  ${path.basename(a.file).replace(/\.(md|toml)$/, "")}`);
      return;
    }
    case "validate": {
      const { skills, agents, issues } = validate(REPO_ROOT);
      for (const i of issues) console.log(`${i.file}: ${i.msg}`);
      console.log(`${skills.length} skills, ${agents.length} agents, ${issues.length} issue(s)`);
      if (issues.length) process.exitCode = 1;
      return;
    }
    case "upstream": {
      const [sub, ...args] = positionals;
      if (sub === "status") {
        const st = upstreamStatus(REPO_ROOT, { fetch });
        console.log(`upstream ${st.ref} @ ${st.head.slice(0, 12)}`);
        for (const r of st.rows) {
          if (r.state === "current") continue;
          console.log(`  ${r.state.padEnd(17)} ${r.name}  (${r.path})`);
          for (const c of r.commits ?? []) console.log(`      ${c}`);
        }
        const current = st.rows.filter((r) => r.state === "current").length;
        console.log(`  ${current}/${st.rows.length} tracked skills current`);
        if (st.candidates.length) {
          console.log("untracked upstream skills (add with `upstream add`, or list under `ignore:` in UPSTREAM.md):");
          for (const c of st.candidates) console.log(`  ${c}`);
        }
        return;
      }
      if (sub === "pull") {
        const names = values.all ? upstreamStatus(REPO_ROOT, { fetch }).rows.filter((r) => r.state === "changed").map((r) => r.name) : args;
        if (!names.length) fail(values.all ? "every tracked skill is current" : "name at least one skill, or pass --all");
        let conflicts = 0;
        names.forEach((name, i) => {
          const r = upstreamPull(REPO_ROOT, name, { fetch: fetch && !values.all && i === 0 });
          console.log(`${name}: ${r.from.slice(0, 8)} -> ${r.to.slice(0, 8)}`);
          for (const f of r.updated) console.log(`  merged    ${f}`);
          for (const f of r.added) console.log(`  added     ${f}`);
          for (const f of r.deleted) console.log(`  deleted   ${f}`);
          for (const f of r.conflicts) console.log(`  CONFLICT  ${f}`);
          for (const n of r.notes) console.log(`  note      ${n}`);
          conflicts += r.conflicts.length;
        });
        if (conflicts) {
          console.log(`${conflicts} file(s) have conflict markers; resolve them, then run validate.`);
          process.exitCode = 1;
        }
        return;
      }
      if (sub === "add") {
        const [upstreamPath, plugin] = args;
        if (!upstreamPath || !plugin) fail("usage: upstream add <upstream-path> <plugin> [--as NAME]");
        const r = upstreamAdd(REPO_ROOT, upstreamPath.replace(/\/$/, ""), plugin, { as: values.as, fetch });
        console.log(`added ${r.name} -> ${path.relative(REPO_ROOT, r.dest)} @ ${r.commit.slice(0, 12)}`);
        return;
      }
      return fail("usage: upstream status|pull|add");
    }
    default:
      fail(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (e) {
  fail(e.message);
}
