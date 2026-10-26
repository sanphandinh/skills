// Thin git helpers. Everything the orchestrator does to a repository goes
// through real git so a test repository behaves like a real one.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function git(cwd, args, input) {
  return execFileSync("git", args, { cwd, encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }).trim();
}

export function gitOk(cwd, args) {
  return spawnSync("git", args, { cwd, stdio: "ignore" }).status === 0;
}

export function show(cwd, ref, rel) {
  const r = spawnSync("git", ["show", `${ref}:${rel}`], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
}

export function listTree(cwd, ref, dir) {
  const r = spawnSync("git", ["ls-tree", "--name-only", `${ref}:${dir}`], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
}

// A detached worktree at `ref`, removed by the returned cleanup.
export function worktree(repo, ref, { branch } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "autopilot-wt-"));
  git(repo, ["worktree", "add", "-q", ...(branch ? ["-B", branch] : ["--detach"]), dir, ref]);
  return { dir, cleanup: () => (gitOk(repo, ["worktree", "remove", "--force", dir]), fs.rmSync(dir, { recursive: true, force: true })) };
}

// Patch identity of the code change between trunk and head. Tracker files
// (`.scratch/`) and decision trails (`.autopilot/`) are excluded, so recording
// a decision never invalidates a verdict.
export function patchId(repo, base, head) {
  const diff = git(repo, ["diff", `${base}...${head}`, "--", ".", ":(exclude).scratch", ":(exclude).autopilot"]);
  if (!diff) return "empty";
  return git(repo, ["patch-id", "--stable"], `${diff}\n`).split(" ")[0];
}

// Files that conflict when `head` merges `base`, or null when it merges
// cleanly. Nothing is written to any branch.
export function conflicts(repo, base, head) {
  const r = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", "--no-messages", base, head], { cwd: repo, encoding: "utf8" });
  if (r.status === 0) return null;
  if (r.status !== 1) throw new Error(`git merge-tree failed: ${r.stderr.trim()}`);
  return r.stdout.split("\n").slice(1).filter(Boolean);
}

export const isAncestor = (repo, a, b) => gitOk(repo, ["merge-base", "--is-ancestor", a, b]);

export function changedFiles(repo, base, head) {
  return git(repo, ["diff", "--name-only", `${base}...${head}`]).split("\n").filter(Boolean);
}
