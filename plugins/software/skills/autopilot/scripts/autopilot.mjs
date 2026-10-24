#!/usr/bin/env node
// Command line entry: `autopilot.mjs run <spec> --harness <name> [options]`.
import os from "node:os";
import { parseArgs } from "node:util";
import { createForge } from "./lib/forge.mjs";
import { createHarness, detectHarness } from "./lib/harness.mjs";
import { renderReport } from "./lib/report.mjs";
import { runAutopilot } from "./lib/run.mjs";
import { createTracker } from "./lib/trackers/index.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    harness: { type: "string" },
    repo: { type: "string", default: process.cwd() },
    remote: { type: "string", default: "origin" },
    trunk: { type: "string", default: "main" },
    concurrency: { type: "string", default: "1" },
    as: { type: "string", default: `autopilot@${os.hostname()}` },
    "max-tokens": { type: "string" },
    "max-minutes": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

const [command, spec] = positionals;
if (values.help || command !== "run" || !spec) {
  console.log("usage: autopilot.mjs run <spec path | #issue | KEY-1> [--harness omp|claude] [--repo dir] [--remote origin] [--trunk main] [--concurrency n] [--as name] [--max-tokens n] [--max-minutes n] [--dry-run]");
  process.exit(values.help ? 0 : 1);
}

let harness;
try {
  harness = detectHarness({ explicit: values.harness, repoDir: values.repo });
} catch (err) {
  console.error(`autopilot: ${err.message}`);
  process.exit(1);
}
console.log(`Harness: ${harness.name} (${harness.why})`);

const report = await runAutopilot({
  repoDir: values.repo,
  spec,
  harness: createHarness(harness.name, { repoDir: values.repo }),
  tracker: createTracker({ repoDir: values.repo, remote: values.remote, trunk: values.trunk, spec }),
  forge: createForge({ repoDir: values.repo }),
  remote: values.remote,
  trunk: values.trunk,
  concurrency: Number(values.concurrency),
  who: values.as,
  budget: {
    ...(values["max-tokens"] ? { tokens: Number(values["max-tokens"]) } : {}),
    ...(values["max-minutes"] ? { timeMs: Number(values["max-minutes"]) * 60_000 } : {}),
  },
  dryRun: values["dry-run"],
});
console.log(renderReport(report));
process.exit(report.status === "refused" ? 1 : 0);
