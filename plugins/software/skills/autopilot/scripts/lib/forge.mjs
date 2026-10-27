// Forge port: openPr, findPr, comment, comments, markReady, ciStatus, merge,
// isMerged, trunkStatus, rerunFailed, prForCommit. The host and the
// repository come from the tracker doc's `Pull requests:` line (else its
// `Tracker:` line when that names GitHub or GitLab), and every call names that
// repository explicitly, so a second remote (such as `upstream`) can never
// receive a pull request or a merge.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gitlabForge, glabApi } from "./trackers/gitlab.mjs";

const TRACKER_DOC = "docs/agents/issue-tracker.md";

export function forgeConfig(repoDir) {
  const file = path.join(repoDir, TRACKER_DOC);
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const m =
    text.match(/^(?:\*\*)?Pull requests:(?:\*\*)?\s*(github|gitlab)\s+([\w.-]+(?:\/[\w.-]+)+)\s*$/im) ??
    text.match(/^(?:\*\*)?Tracker:(?:\*\*)?\s*(github|gitlab)\s+([\w.-]+(?:\/[\w.-]+)+)\s*$/im);
  if (!m) throw new Error(`${TRACKER_DOC} has no "Pull requests: github|gitlab <owner>/<repo>" line, so autopilot does not know where pull requests go`);
  return { kind: m[1].toLowerCase(), repo: m[2] };
}

export function createForge({ repoDir, command, transport }) {
  const cfg = forgeConfig(repoDir);
  if (cfg.kind === "gitlab") return gitlabForge({ repo: cfg.repo, api: transport ?? glabApi({ cwd: repoDir, ...(command ? { command } : {}) }) });
  return github({ repo: cfg.repo, command: command ?? "gh", cwd: repoDir });
}

// Worst of a set of check outcomes: fail, pending, pass, or none.
export function rollUp(states) {
  if (!states.length) return "none";
  if (states.includes("fail")) return "fail";
  if (states.includes("pending")) return "pending";
  return "pass";
}

const TRUSTED = ["OWNER", "MEMBER", "COLLABORATOR"];

function github({ repo, command, cwd }) {
  const call = (args, input) => {
    const r = spawnSync(command, args, { cwd, input, encoding: "utf8" });
    return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? String(r.error ?? "") };
  };
  // Every subcommand but `api` takes --repo; `api` names the repository in
  // its path.
  const gh = (args, input) => call(args[0] === "api" ? args : [...args, "--repo", repo], input);
  const must = (args, input) => {
    const r = gh(args, input);
    if (r.code !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${r.err.trim()}`);
    return r.out;
  };
  const json = (args) => JSON.parse(must(args) || "null");
  const STATE = { OPEN: "open", MERGED: "merged", CLOSED: "closed" };
  const failedCheck = (c) => c.status === "completed" && ["failure", "cancelled", "timed_out", "action_required"].includes(c.conclusion);
  const statusAt = async (ref) => {
    const runs = json(["api", `repos/${repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=100`])?.check_runs ?? [];
    const status = json(["api", `repos/${repo}/commits/${encodeURIComponent(ref)}/status`]) ?? {};
    const contexts = status.statuses ?? [];
    const states = [
      ...runs.map((c) => (c.status !== "completed" ? "pending" : failedCheck(c) ? "fail" : "pass")),
      ...contexts.map((s) => (s.state === "success" ? "pass" : s.state === "pending" ? "pending" : "fail")),
    ];
    return {
      sha: runs[0]?.head_sha ?? status.sha ?? null,
      state: rollUp(states),
      url: runs.find(failedCheck)?.html_url ?? contexts.find((s) => s.state !== "success")?.target_url ?? null,
    };
  };

  return {
    repo,
    async openPr({ branch, base, title, body, draft = false }) {
      const url = must(["pr", "create", "--head", branch, "--base", base, "--title", title, "--body-file", "-", ...(draft ? ["--draft"] : [])], body).trim().split("\n").at(-1);
      return { number: Number(url.match(/\/pull\/(\d+)/)?.[1]), url };
    },
    // The newest pull request for a branch, in any state.
    async findPr(branch) {
      const [pr] = json(["pr", "list", "--head", branch, "--state", "all", "--limit", "1", "--json", "number,url,state,isDraft,body,author"]) ?? [];
      return pr ? { number: pr.number, url: pr.url, state: STATE[pr.state] ?? "open", draft: Boolean(pr.isDraft), body: pr.body ?? "", author: pr.author?.login ?? null } : null;
    },
    async comment(number, body) {
      must(["pr", "comment", String(number), "--body-file", "-"], body);
    },
    // { body, author, trusted }: trusted when the pull request's author or a
    // repository owner, member or collaborator wrote it.
    async comments(number) {
      const view = json(["pr", "view", String(number), "--json", "comments,author"]) ?? {};
      return (view.comments ?? []).map((c) => {
        const author = c.author?.login ?? null;
        return { body: c.body ?? "", author, trusted: author === view.author?.login || TRUSTED.includes(c.authorAssociation) };
      });
    },
    async markReady(number) {
      must(["pr", "ready", String(number)]);
    },
    async updatePr(number, { body }) {
      must(["pr", "edit", String(number), "--body-file", "-"], body);
    },
    async ciStatus(number) {
      const r = gh(["pr", "checks", String(number), "--json", "bucket"]);
      if (r.code !== 0 && /no checks reported/i.test(r.err)) return "pass";
      if (r.code !== 0 && !r.out.trim()) return "pending";
      const buckets = JSON.parse(r.out || "[]").map((c) => c.bucket);
      if (buckets.some((b) => b === "fail" || b === "cancel")) return "fail";
      if (buckets.some((b) => b === "pending")) return "pending";
      return "pass";
    },
    async merge(number) {
      must(["pr", "merge", String(number), "--squash"]);
    },
    // Read the pull request back: a merge command can succeed while only
    // queueing the merge.
    async isMerged(number) {
      return JSON.parse(must(["pr", "view", String(number), "--json", "state"])).state === "MERGED";
    },
    // CI of the newest commit on a branch: { sha, state: pass|fail|pending|none,
    // url of a failed check }.
    async trunkStatus(branch) {
      const s = await statusAt(branch);
      const sha = s.sha ?? json(["api", `repos/${repo}/commits/${encodeURIComponent(branch)}`])?.sha ?? null;
      return { sha, state: s.state, url: s.url };
    },
    // Status of one commit, for finding the oldest red commit in a range.
    async statusFor(sha) {
      const s = await statusAt(sha);
      return { state: s.state, url: s.url };
    },
    async rerunFailed(sha) {
      let reran = false;
      for (const run of json(["run", "list", "--commit", sha, "--json", "databaseId,conclusion"]) ?? []) {
        if (!["failure", "cancelled", "timed_out"].includes(run.conclusion)) continue;
        if (gh(["run", "rerun", String(run.databaseId), "--failed"]).code === 0) reran = true;
      }
      // A check run from an app (Xcode Cloud, a third-party CI) has no
      // Actions run to rerun; re-request it directly.
      for (const check of json(["api", `repos/${repo}/commits/${sha}/check-runs?per_page=100`])?.check_runs ?? []) {
        if (!failedCheck(check) || !check.id) continue;
        if (gh(["api", "-X", "POST", `repos/${repo}/check-runs/${check.id}/rerequest`]).code === 0) reran = true;
      }
      return reran;
    },
    // The pull request a commit came from: { number, branch } or null.
    async prForCommit(sha) {
      const [pr] = json(["api", `repos/${repo}/commits/${sha}/pulls`]) ?? [];
      return pr ? { number: pr.number, branch: pr.head?.ref ?? "" } : null;
    },
  };
}
