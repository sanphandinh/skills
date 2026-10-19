// Pick the tracker adapter from the tracker doc's `Tracker:` line:
// `local` (also the default), `github <owner>/<repo>`, `gitlab <group>/<project>`,
// or `jira <site URL> <project key>`.
import fs from "node:fs";
import path from "node:path";
import { githubTracker, ghApi } from "./github.mjs";
import { labelMap } from "./labels.mjs";
import { localTracker } from "./local.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";
const LABELS_DOC = "docs/agents/triage-labels.md";

const read = (repoDir, rel) => {
  const f = path.join(repoDir, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
};

export function trackerConfig(doc) {
  const m = String(doc).match(/^(?:\*\*)?Tracker:(?:\*\*)?\s*(\w+)(?:\s+(\S+))?(?:\s+(\S+))?\s*$/m);
  if (!m) return { kind: "local" };
  const kind = m[1].toLowerCase();
  if (kind === "jira") return { kind, site: m[2], project: m[3] };
  return { kind, repo: m[2] };
}

export const factories = {
  local: ({ repoDir, remote, trunk, spec }) => localTracker({ repo: repoDir, remote, trunk, spec }),
  github: ({ repoDir, spec, cfg, transport }) => {
    if (!cfg.repo) throw new Error(`${TRACKER_DOC}: "Tracker: github" needs <owner>/<repo>`);
    return githubTracker({ repo: cfg.repo, spec, api: transport ?? ghApi({ cwd: repoDir }), labels: labelMap(read(repoDir, LABELS_DOC)), cwd: repoDir });
  },
};

export function createTracker({ repoDir, remote = "origin", trunk = "main", spec, transport }) {
  const cfg = trackerConfig(read(repoDir, TRACKER_DOC));
  const make = factories[cfg.kind];
  if (!make) throw new Error(`${TRACKER_DOC}: unsupported tracker "${cfg.kind}"; supported: ${Object.keys(factories).join(", ")}`);
  return make({ repoDir, remote, trunk, spec, cfg, transport });
}
