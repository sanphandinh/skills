#!/usr/bin/env node
// Command line entry: `autopilot.mjs run <spec> --harness <name> [options]`.
import { parseArgs } from "node:util";
import { createForge } from "./lib/forge.mjs";
import { createHarness } from "./lib/harness.mjs";
import { renderReport } from "./lib/report.mjs";
import { runAutopilot } from "./lib/run.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    harness: { type: "string" },
    repo: { type: "string", default: process.cwd() },
    remote: { type: "string", default: "origin" },
    trunk: { type: "string", default: "main" },
    concurrency: { type: "string", default: "1" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

const [command, spec] = positionals;
if (values.help || command !== "run" || !spec || !values.harness) {
  console.log("usage: autopilot.mjs run <spec path> --harness <omp|claude> [--repo dir] [--remote origin] [--trunk main] [--concurrency n] [--dry-run]");
  process.exit(values.help ? 0 : 1);
}

const report = await runAutopilot({
  repoDir: values.repo,
  spec,
  harness: createHarness(values.harness, { repoDir: values.repo }),
  forge: createForge({ repoDir: values.repo }),
  remote: values.remote,
  trunk: values.trunk,
  concurrency: Number(values.concurrency),
  dryRun: values["dry-run"],
});
console.log(renderReport(report));
process.exit(report.status === "refused" ? 1 : 0);
