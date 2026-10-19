---
name: autopilot
description: "Build an approved spec unattended: one independently verified and reviewed pull request per ticket, auto-merged when the merge policy allows."
argument-hint: "<spec path> [harness: omp | claude]"
disable-model-invocation: true
---

Run the orchestrator script on an approved spec. The script holds the state machine; this skill only checks the preconditions and starts it. Never do the orchestration yourself.

## Preconditions

Check each one and stop with the reason when one fails:

- The issue tracker doc (`docs/agents/issue-tracker.md`) exists. If not, tell the user to run the `setup-software-context` skill.
- The spec the user named exists on trunk and its status is `ready-for-agent`. Anything else means the human gate has not passed.
- The working tree is clean, and the repository has the remote the tracker doc names for pull requests.
- If `docs/agents/verify.md` is missing, warn that nothing will auto-merge until the `setup-verification` skill has written it, then continue.

## Run

From the repository root, run:

```bash
node <this skill's folder>/scripts/autopilot.mjs run <spec path> --harness <omp|claude>
```

Use the harness the user named; otherwise the one this session runs on. Pass `--concurrency <n>` when the user asks for parallel tickets, `--max-tokens <n>` or `--max-minutes <n>` to change the per-ticket budget, and `--dry-run` to show the frontier without changing anything.

## Report

The script ends with a report: what merged, what waits for the human and why, and what is still blocked. Relay it as is, with the pull request links. Do not retry `ready-for-human` tickets yourself; they need the human.
