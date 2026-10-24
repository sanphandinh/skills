---
name: autopilot
description: "Build an approved spec unattended: one independently verified and reviewed pull request per ticket, auto-merged when the merge policy allows."
argument-hint: "<spec path | #issue | KEY-1> [--harness omp|claude]"
disable-model-invocation: true
---

Run the orchestrator script on an approved spec. The script holds the state machine; this skill only checks the preconditions and starts it. Never do the orchestration yourself.

## Preconditions

Check each one and stop with the reason when one fails:

- The issue tracker doc (`docs/agents/issue-tracker.md`) exists. If not, tell the user to run the `setup-software-context` skill. Its `Tracker:` line names where tickets live (local, GitHub, GitLab, or Jira); for Jira, `JIRA_EMAIL` and `JIRA_API_TOKEN` must be set.
- The spec the user named (a `.scratch/` path, `#42`, or `KEY-42`) exists on the tracker and its status is `ready-for-agent`. Anything else means the human gate has not passed. A local spec must be pushed to trunk.
- The working tree is clean, and the repository has the remote the tracker doc names for pull requests.
- If `docs/agents/verify.md` is missing, warn that nothing will auto-merge until the `setup-verification` skill has written it, then continue.

## Run

From the repository root, run:

```bash
node <this skill's folder>/scripts/autopilot.mjs run <spec>
```

The script picks the harness itself (the session it runs inside, else the agent plugin the project installed, else the only agent CLI on PATH) and prints which one and why. Pass `--harness <omp|claude>` only when the user names one or the script asks for it.

To take over tickets a dead run had claimed, pass `--as <name>` with the name on their `Claimed-by:` line; a run resumes its own claims and continues their branches.

Pass `--concurrency <n>` when the user asks for parallel tickets, `--max-tokens <n>` or `--max-minutes <n>` to change the per-ticket budget, and `--dry-run` to show the frontier without changing anything.

## Report

The script ends with a report: what merged, what waits for the human and why, and what is still blocked. Relay it as is, with the pull request links. Do not retry `ready-for-human` tickets yourself; they need the human.
