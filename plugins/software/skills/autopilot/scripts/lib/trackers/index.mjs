// Pick the tracker adapter from the tracker doc's `Tracker:` line:
// `local` (also the default), `github <owner>/<repo>`, `gitlab <group>/<project>`,
// or `jira <site URL> <project key>`. `createTracker` serves one spec;
// `scanTrackers` serves the whole tracker: one adapter per open spec plus one
// for the standalone tickets (where fix tickets are filed).
import fs from "node:fs";
import path from "node:path";
import { githubSpecs, githubTracker, ghApi } from "./github.mjs";
import { gitlabSpecs, gitlabTracker, glabApi } from "./gitlab.mjs";
import { jiraApi, jiraSpecs, jiraStatuses, jiraTracker } from "./jira.mjs";
import { labelMap } from "./labels.mjs";
import { FIXES_DIR, localGroups, localTracker } from "./local.mjs";

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

function remoteParts({ repoDir, cfg, transport, env = process.env }) {
  if (cfg.kind === "github") {
    if (!cfg.repo) throw new Error(`${TRACKER_DOC}: "Tracker: github" needs <owner>/<repo>`);
    return { repo: cfg.repo, api: transport ?? ghApi({ cwd: repoDir }), labels: labelMap(read(repoDir, LABELS_DOC)), cwd: repoDir };
  }
  if (cfg.kind === "gitlab") {
    if (!cfg.repo) throw new Error(`${TRACKER_DOC}: "Tracker: gitlab" needs <group>/<project>`);
    return { repo: cfg.repo, api: transport ?? glabApi({ cwd: repoDir }), labels: labelMap(read(repoDir, LABELS_DOC)), cwd: repoDir };
  }
  if (!cfg.site || !cfg.project) throw new Error(`${TRACKER_DOC}: "Tracker: jira" needs <site URL> <project key>`);
  return {
    project: cfg.project,
    api: transport ?? jiraApi({ site: cfg.site, email: env.JIRA_EMAIL, token: env.JIRA_API_TOKEN }),
    statuses: jiraStatuses(read(repoDir, TRACKER_DOC)),
    cwd: repoDir,
  };
}

export const factories = {
  local: ({ repoDir, remote, trunk, spec, dir }) => localTracker({ repo: repoDir, remote, trunk, spec, dir }),
  github: (o) => githubTracker({ ...remoteParts(o), spec: o.spec }),
  gitlab: (o) => gitlabTracker({ ...remoteParts(o), spec: o.spec }),
  jira: (o) => jiraTracker({ ...remoteParts(o), spec: o.spec }),
};

const SPECS = { github: githubSpecs, gitlab: gitlabSpecs, jira: jiraSpecs };

function config(repoDir) {
  const cfg = trackerConfig(read(repoDir, TRACKER_DOC));
  if (!factories[cfg.kind]) throw new Error(`${TRACKER_DOC}: unsupported tracker "${cfg.kind}"; supported: ${Object.keys(factories).join(", ")}`);
  return cfg;
}

export function createTracker({ repoDir, remote = "origin", trunk = "main", spec, transport }) {
  const cfg = config(repoDir);
  return factories[cfg.kind]({ repoDir, remote, trunk, spec, cfg, transport });
}

// { trackers: [one per open spec, then the standalone one], standalone }.
export async function scanTrackers({ repoDir, remote = "origin", trunk = "main", transport }) {
  const cfg = config(repoDir);
  const make = (spec, dir) => factories[cfg.kind]({ repoDir, remote, trunk, spec, dir, cfg, transport });
  if (cfg.kind === "local") {
    const groups = localGroups({ repo: repoDir, remote, trunk });
    if (!groups.some((g) => g.dir === FIXES_DIR)) groups.push({ spec: null, dir: FIXES_DIR });
    const trackers = groups.map((g) => make(g.spec, g.dir));
    return { trackers, standalone: trackers.find((t) => t.key === path.posix.basename(FIXES_DIR)) };
  }
  const specs = await SPECS[cfg.kind](remoteParts({ repoDir, cfg, transport }));
  const standalone = make(null);
  return { trackers: [...specs.map((s) => make(s)), standalone], standalone };
}
