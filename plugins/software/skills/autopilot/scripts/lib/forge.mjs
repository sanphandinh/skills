// Forge port: openPr, findPr, comment, ciStatus, merge, isMerged. The adapter and the
// repository come from the tracker doc's `Pull requests:` line, and every call
// names that repository explicitly, so a second remote (such as `upstream`)
// can never receive a pull request or a merge.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TRACKER_DOC = "docs/agents/issue-tracker.md";

export function forgeConfig(repoDir) {
  const file = path.join(repoDir, TRACKER_DOC);
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const m = text.match(/^(?:\*\*)?Pull requests:(?:\*\*)?\s*(\w+)\s+([\w.-]+\/[\w.-]+)\s*$/m);
  if (!m) throw new Error(`${TRACKER_DOC} has no "Pull requests: github <owner>/<repo>" line, so autopilot does not know where pull requests go`);
  return { kind: m[1].toLowerCase(), repo: m[2] };
}

export function createForge({ repoDir, command }) {
  const cfg = forgeConfig(repoDir);
  if (cfg.kind !== "github") throw new Error(`unsupported pull request host "${cfg.kind}"`);
  return github({ repo: cfg.repo, command: command ?? "gh", cwd: repoDir });
}

function github({ repo, command, cwd }) {
  const gh = (args, input) => {
    const r = spawnSync(command, [...args, "--repo", repo], { cwd, input, encoding: "utf8" });
    return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? String(r.error ?? "") };
  };
  const must = (args, input) => {
    const r = gh(args, input);
    if (r.code !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${r.err.trim()}`);
    return r.out;
  };
  return {
    repo,
    async openPr({ branch, base, title, body }) {
      const url = must(["pr", "create", "--head", branch, "--base", base, "--title", title, "--body-file", "-"], body).trim().split("\n").at(-1);
      return { number: Number(url.match(/\/pull\/(\d+)/)?.[1]), url };
    },
    async findPr(branch) {
      const [pr] = JSON.parse(must(["pr", "list", "--head", branch, "--state", "open", "--json", "number,url"]) || "[]");
      return pr ?? null;
    },
    async comment(number, body) {
      must(["pr", "comment", String(number), "--body-file", "-"], body);
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
  };
}
