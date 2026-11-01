# 01: Set up a project for the factory on Orca

**What to build:** a developer installs the `factory` plugin, opens a sandbox repository in Orca, and runs the factory skill's `setup` mode. Setup writes `docs/agents/factory.md`, registers the repository with Orca, creates the factory's labels on a GitHub tracker, and runs a smoke test that drives every interface operation through Orca and reports pass or fail for each. The interface document and the Orca reference are written from what the smoke test actually ran (the Orca spike), not from Orca's documentation alone. ADR-0002 and the glossary record the new decision and vocabulary.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] The `factory` plugin ships the `factory` skill (user-invoked, `setup` mode documented) and is listed in the Claude Code, Codex and Oh My Pi catalogs.
  Verify: `npm run validate` and `npm test` pass; each of the three catalogs lists `factory`.
- [ ] Setup writes `docs/agents/factory.md` with `Manager: orca` and every documented setting at its default, registers the repository with Orca, and on a GitHub tracker creates `factory:hold` and `priority:p1` to `priority:p3`.
  Verify: run setup in the sandbox repository; read the file; `orca repo list --json` lists the repository; `gh label list` shows the labels.
- [ ] The smoke test drives open-workspace, start-worker, wait-events, send, inspect, flag-human, stop-worker, close-workspace and resume through Orca and reports each one.
  Verify: run the smoke test; every operation reports pass; `orca worktree list --json` shows the smoke worktree during the test and not afterwards.
- [ ] A heartbeat never counts as `done`, and a worker that asks a question produces a `question` event before its `done`.
  Verify: in the smoke test, a worker told to ask one question and then finish yields `question`, then `done`, in that order.
- [ ] Close-workspace refuses to remove a worktree that holds unpushed commits.
  Verify: leave an unpushed commit in a smoke worktree; close-workspace reports it and the worktree stays.
- [ ] A new coordinator session sees a still-running worker through resume.
  Verify: start a long smoke worker, end the coordinator session, start a new one in an Orca terminal and resume; the worker is listed and later reports `done`.
- [ ] A worker runs on the model its role names in the project's role mapping, and the factory names no model.
  Verify: the smoke worker reports the model it ran on; it matches the role mapping for its role.
- [ ] The Orca reference names the Orca version it was verified on, lists the traps the spike hit, and points at Orca's own orchestration guide for protocol detail instead of copying it.
  Verify: read the reference; its version matches `orca --version`.
- [ ] ADR-0002 records the agent-driven factory and supersedes ADR-0001's orchestrator, and the glossary defines coordinator, worker, wake, agent manager, interface, reference, hold and verdict status.
  Verify: read `docs/adr/` and `GLOSSARY.md`.
