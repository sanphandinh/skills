---
name: setup-verification
description: "Write this project's verification doc: how an agent launches, drives, and observes the real product to prove a change works, with a feature map. Run once per project before relying on autopilot verdicts."
disable-model-invocation: true
---

# Setup Verification

Write `docs/agents/verify.md`: the doc a verifier follows to prove a change works the way a user would see it. A verifier reads it cold, mid-task, in a fresh checkout of a pull request it did not write, so every step must be literal and runnable. Without this doc no verdict ever ran the product, and the `autopilot` skill refuses to auto-merge.

## 1. Interview the repo, not the user

Answer from the codebase; ask the user only what you cannot observe.

- **Surface:** what a user actually touches: web UI, CLI or TUI, desktop app, HTTP API, library. Pick the primary one and note the rest.
- **Launch:** the repo's own documented start command (package scripts, Makefile, README), ports, env vars, seed data, auth, and how to tell it is ready. Ready means usable, not merely that a process answers.
- **Drive:** how an agent interacts programmatically. Existing harnesses first (end-to-end specs, scripts, curl-able routes); otherwise a browser driver for web, a PTY or tmux session for CLI and TUI, plain HTTP for services.
- **Observe:** the evidence a proof can capture: response bodies, terminal transcripts with exit codes, screenshots, logs, files or rows written.
- **Isolate:** whether two instances can run side by side (ports, data directories). If not, the doc says so, and a verifier refuses to drive an instance it did not start.
- **Untracked needs:** anything a check requires that a fresh checkout lacks (gitignored fixtures, local databases, credentials). Verifiers run in worktrees that hold only tracked files.

If the checkout does not build or start as is, fix that or report it precisely before writing anything.

## 2. Write the doc

`docs/agents/verify.md` has these sections, each from what the interview found, with no placeholders left:

- **Launch:** the exact command, how to tell it is ready, and teardown.
- **Doctor:** one read-only check that this instance is worth driving (process up, expected build, port owned by this run).
- **Drive:** the recipe with this repo's real commands, routes, and stable handles (accessible names, data attributes, prompt strings), never coordinates.
- **Evidence:** what to capture and where it goes. Exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state; check side effects alongside what is visible.
- **Cleanup:** stop only what this run started, and keep the evidence.
- **Untracked needs:** each one, and which feature checks depend on it, so a verifier knows when a worktree cannot run a check and reports that instead of skipping it.
- **Feature map:** the top three to five user-facing features (from routes, commands, menus, docs). For each: what it is, every way a user reaches it, the exact drive steps with the observable result that proves it works, and its gotchas. A journey whose precondition the seed data lacks fails, and the reason goes in its gotchas; never weaken a journey to make it pass.

## 3. Prove the doc before handing it over

Follow the doc end to end once, from a fresh worktree of trunk: launch, doctor, drive one mapped feature, capture evidence, clean up, and confirm the evidence survived the cleanup. Fix what fails and clean up after every failed attempt. A doc that was never run is a draft.

## 4. Report

Tell the user the doc is written and proven, which feature you drove, and which untracked needs it lists. Commit it with the repo.

Adapted from `create-verification-skill` in cursor/plugins `pstack` (MIT, Copyright (c) 2026 Lauren Tan).
