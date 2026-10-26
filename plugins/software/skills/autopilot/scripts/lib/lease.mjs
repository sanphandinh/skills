// Step leases: a time-limited hold on one ticket, kept as a ref on the remote
// (`refs/autopilot/lease/<name>`) pointing at a commit whose message says who
// holds it until when. Creating the ref is atomic, and taking over an expired
// lease is a compare-and-swap with --force-with-lease, so two runs on two
// machines never hold the same lease.
import { execFileSync, spawnSync } from "node:child_process";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const IDENTITY = { GIT_AUTHOR_NAME: "autopilot", GIT_AUTHOR_EMAIL: "autopilot@localhost", GIT_COMMITTER_NAME: "autopilot", GIT_COMMITTER_EMAIL: "autopilot@localhost" };

const run = (cwd, args, env) => spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });

export const leaseRef = (name) => `refs/autopilot/lease/${name}`;

function holderOf(repo, remote, ref) {
  if (run(repo, ["fetch", "-q", remote, ref]).status !== 0) return null;
  const sha = run(repo, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
  try {
    return { sha, ...JSON.parse(run(repo, ["log", "-1", "--format=%B", sha]).stdout) };
  } catch {
    return { sha, expires: 0 };
  }
}

// Returns the lease, or null when someone else holds it.
export function takeLease(repo, remote, name, { who, step, now, ttlMs }) {
  const ref = leaseRef(name);
  const msg = JSON.stringify({ who, step, expires: now + ttlMs });
  const sha = execFileSync("git", ["commit-tree", EMPTY_TREE, "-m", msg], { cwd: repo, encoding: "utf8", env: { ...process.env, ...IDENTITY } }).trim();
  if (run(repo, ["push", "-q", remote, `${sha}:${ref}`]).status === 0) return { ref, sha };
  const held = holderOf(repo, remote, ref);
  if (!held || held.expires > now) return null;
  if (run(repo, ["push", "-q", `--force-with-lease=${ref}:${held.sha}`, remote, `${sha}:${ref}`]).status === 0) return { ref, sha };
  return null;
}

export function releaseLease(repo, remote, lease) {
  if (lease) run(repo, ["push", "-q", `--force-with-lease=${lease.ref}:${lease.sha}`, remote, `:${lease.ref}`]);
}
