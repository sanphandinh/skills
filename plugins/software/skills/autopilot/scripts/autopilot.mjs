#!/usr/bin/env node
// Command line entry:
//   autopilot.mjs tick [options]          one pass over the whole tracker (for a scheduler)
//   autopilot.mjs run <spec> [options]    tick over one spec until nothing is actionable, then report
//   autopilot.mjs status [options]        the board
import { spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createForge } from "./lib/forge.mjs";
import { createHarness, detectHarness } from "./lib/harness.mjs";
import { orcaHarness, orcaRepoId, orcaTransport, orcaWorkspaces, relaunchInOrca } from "./lib/orca.mjs";
import { renderReport, renderStatus } from "./lib/report.mjs";
import { runAutopilot, status, tick } from "./lib/run.mjs";
import { createTracker } from "./lib/trackers/index.mjs";

const USAGE = `usage:
  autopilot.mjs tick [--harness omp|claude|orca] [options]
  autopilot.mjs run <spec path | #issue | KEY-1> [--harness omp|claude|orca] [--concurrency n] [--dry-run] [options]
  autopilot.mjs status [options]

options: [--repo dir] [--remote origin] [--trunk main] [--as name] [--max-tokens n] [--max-minutes n]
         [--agent omp|claude|codex]   with --harness orca: the agent Orca starts for each worker`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    harness: { type: "string" },
    agent: { type: "string" },
    repo: { type: "string", default: process.cwd() },
    remote: { type: "string", default: "origin" },
    trunk: { type: "string", default: "main" },
    concurrency: { type: "string" },
    as: { type: "string", default: `autopilot@${os.hostname()}` },
    "max-tokens": { type: "string" },
    "max-minutes": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

const [command, spec] = positionals;
if (values.help || !["run", "tick", "status"].includes(command) || (command === "run" && !spec)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

const common = {
  repoDir: values.repo,
  remote: values.remote,
  trunk: values.trunk,
  who: values.as,
  forge: createForge({ repoDir: values.repo }),
  budget: {
    ...(values["max-tokens"] ? { tokens: Number(values["max-tokens"]) } : {}),
    ...(values["max-minutes"] ? { timeMs: Number(values["max-minutes"]) * 60_000 } : {}),
  },
};

if (command === "status") {
  console.log(renderStatus(await status(common)));
  process.exit(0);
}

let agents;
let workspaces;
if (values.harness === "orca") {
  // Orca mode: every run is an Orca worker in an Orca worktree. Orchestration
  // needs an Orca terminal as the coordinator, so outside one the command
  // relaunches itself there and waits.
  const orca = orcaTransport({ cwd: values.repo });
  if (!process.env.ORCA_TERMINAL_HANDLE) {
    try {
      const r = await relaunchInOrca({ orca, repoDir: values.repo, title: `autopilot ${command}`, argv: [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)] });
      process.stdout.write(r.output);
      process.exit(r.exitCode ?? 1);
    } catch (err) {
      console.error(`autopilot: Orca mode needs Orca running (${err.message})`);
      process.exit(1);
    }
  }
  const agent = values.agent ?? (spawnSync("sh", ["-c", "command -v omp"], { stdio: "ignore" }).status === 0 ? "omp" : "claude");
  try {
    workspaces = orcaWorkspaces({ orca, repoId: await orcaRepoId(orca, values.repo), repoDir: values.repo });
  } catch (err) {
    console.error(`autopilot: ${err.message}`);
    process.exit(1);
  }
  const timeoutMs = values["max-minutes"] ? Number(values["max-minutes"]) * 60_000 : undefined;
  agents = orcaHarness({ orca, agent, objective: `autopilot ${command}${spec ? ` ${spec}` : ""}`, ...(timeoutMs ? { timeoutMs } : {}) });
  console.log(`Harness: orca, workers run ${agent} (coordinator ${process.env.ORCA_TERMINAL_HANDLE})`);
} else {
  let harness;
  try {
    harness = detectHarness({ explicit: values.harness, repoDir: values.repo });
  } catch (err) {
    console.error(`autopilot: ${err.message}`);
    process.exit(1);
  }
  console.log(`Harness: ${harness.name} (${harness.why})`);
  agents = createHarness(harness.name, { repoDir: values.repo });
}

if (command === "tick") {
  const t = await tick({ ...common, harness: agents, workspaces, ...(values.concurrency ? { concurrency: Number(values.concurrency) } : {}) });
  if (t.status !== "ticked") console.log(`Tick ${t.status}.`);
  for (const r of t.runs) console.log(`${r.id ?? r.group ?? "trunk"}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}${r.pr ? ` ${r.pr}` : ""}`);
  if (t.status === "ticked" && !t.runs.length) console.log("Nothing to do.");
  process.exit(0);
}

const report = await runAutopilot({
  ...common,
  spec,
  harness: agents,
  workspaces,
  tracker: createTracker({ repoDir: values.repo, remote: values.remote, trunk: values.trunk, spec }),
  concurrency: Number(values.concurrency ?? 1),
  dryRun: values["dry-run"],
});
console.log(renderReport(report));
process.exit(report.status === "refused" ? 1 : 0);
