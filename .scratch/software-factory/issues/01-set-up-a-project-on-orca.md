# 01: Set up a project for the factory on Orca

**What to build:** a developer installs the `factory` plugin, opens a sandbox repository in Orca, and runs the factory skill's `setup` mode. Setup writes `docs/agents/factory.md`, registers the repository with Orca, creates the factory's labels on a GitHub tracker, and runs a smoke test that drives every interface operation through Orca and reports pass or fail for each. The interface document and the Orca reference are written from what the smoke test actually ran (the Orca spike), not from Orca's documentation alone. ADR-0002 and the glossary record the new decision and vocabulary.

**Blocked by:** None (can start immediately)

**Status:** closed

**Door:** two-way

- [x] The `factory` plugin ships the `factory` skill (user-invoked, `setup` mode documented) and is listed in the Claude Code, Codex and Oh My Pi catalogs.
  Verify: `npm run validate` and `npm test` pass; each of the three catalogs lists `factory`.
- [x] Setup writes `docs/agents/factory.md` with `Manager: orca` and every documented setting at its default, registers the repository with Orca, and on a GitHub tracker creates `factory:hold` and `priority:p1` to `priority:p3`.
  Verify: run setup in the sandbox repository; read the file; `orca repo list --json` lists the repository; `gh label list` shows the labels.
- [x] The smoke test drives open-workspace, start-worker, wait-events, send, inspect, flag-human, stop-worker, close-workspace and resume through Orca and reports each one.
  Verify: run the smoke test; every operation reports pass; `orca worktree list --json` shows the smoke worktree during the test and not afterwards.
- [x] A heartbeat never counts as `done`, and a worker that asks a question produces a `question` event before its `done`.
  Verify: in the smoke test, a worker told to ask one question and then finish yields `question`, then `done`, in that order.
- [x] Close-workspace refuses to remove a worktree that holds unpushed commits.
  Verify: leave an unpushed commit in a smoke worktree; close-workspace reports it and the worktree stays.
- [x] A new coordinator session sees a still-running worker through resume.
  Verify: start a long smoke worker, end the coordinator session, start a new one in an Orca terminal and resume; the worker is listed and later reports `done`.
- [x] A worker runs on the model its role names in the project's role mapping, and the factory names no model.
  Verify: the smoke worker reports the model it ran on; it matches the role mapping for its role.
- [x] The Orca reference names the Orca version it was verified on, lists the traps the spike hit, and points at Orca's own orchestration guide for protocol detail instead of copying it.
  Verify: read the reference; its version matches `orca --version`.
- [x] ADR-0002 records the agent-driven factory and supersedes ADR-0001's orchestrator, and the glossary defines coordinator, worker, wake, agent manager, interface, reference, hold and verdict status.
  Verify: read `docs/adr/` and `GLOSSARY.md`.

## Handoff

**Delivered:** a fresh Oh My Pi session in an Orca terminal on `sanphandinh/factory-sandbox` ran `/skill:factory setup`: it asked four questions (manager, required checks, scarce resources, write), wrote and pushed `docs/agents/factory.md`, created the labels and the memory folder, created the factory's Orca Run, and reported ten smoke checks, all PASS (question before done, follow-up received, push check refused an unpushed commit, resume from a second terminal saw the live sleeper, stop-worker stopped it).
**Interfaces introduced:** the nine interface operations and the event vocabulary (`done`, `failed`, `question`, `blocked`, `message`, `timeout`); `docs/agents/factory.md` lines `Manager`, `Agent`, `Trunk`, `Max workers`, `Scarce resources`, `Fix rounds`, `Required checks`, `Wake timeout`, `Memory`; the memory folder layout (`index.md`, `journal.md`, `wiki/`, `results/`).
**Deviations from spec:** worker results live in the memory folder, not in the worktree; the coordinator, not the workers, writes every comment, pull request and status, because Orca's worker preamble forbids workers posting to GitHub. Merge rules stay in `merge-policy.md` instead of new `factory.md` lines. Worker instructions are called work orders; "brief" stays the note to a person.
**Decisions:** one `factory` skill with modes instead of a separate setup skill, so the interface and references live in one place. Workers start on `@smol` and delegate the step to the role agent.
**Gotchas:** `orca worktree rm` removes a checkout with unpushed commits; `result.launch.effective.model` echoes the role, the real model is in `worker-list`; plugins installed for a project are not visible in Orca's new worktrees, so the role agents must be installed at user scope, and stale copies in `~/.omp/agent/agents/` shadow them (moved aside to `~/.omp/agent/agents.pre-factory-2026-11-01/` on this machine).
**For the next ticket:** 03: `once` and `run` follow PLAYBOOK.md and WORK-ORDERS.md on the same interface.
