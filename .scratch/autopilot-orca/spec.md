Status: closed

# Autopilot on Orca: every run visible as an Orca worker

## Problem Statement

Autopilot runs its agents as hidden `omp -p` or `claude -p` processes in temporary worktrees. The developer cannot watch a run while it works, and afterwards has to dig through JSON files in a state directory to find out what an agent did. Reviewing and debugging unattended work is therefore slow and unintuitive. The developer already uses Orca, a local agent manager with a UI for worktrees, agent terminals and session history, and wants autopilot's runs to show up there, without autopilot becoming tied to Orca or to one agent.

## Solution

An optional Orca mode. With `--harness orca`, each run's workspace is an Orca-managed worktree and each agent call is an Orca supervised worker (an agent terminal visible in Orca, running omp, Claude Code or Codex). The tick itself runs inside an Orca terminal as the coordinator; started from cron or a plain shell, the CLI relaunches itself there. Orchestration (ticks, next steps, run records, leases, stop the line) is unchanged. Without Orca, the default worktree and harness adapters run exactly as today.

## User Stories

1. As a developer, I want to start autopilot with `--harness orca`, so that every run appears in Orca.
2. As a developer, I want to choose which agent Orca starts for the workers (omp, Claude Code, Codex), so that switching agents needs no other change.
3. As a developer, I want each run's checkout to be an Orca worktree named after the ticket and step, so that I find it in Orca's sidebar.
4. As a developer, I want each agent call to be an Orca worker terminal titled with the ticket and role, so that I can watch it work.
5. As a developer, I want the tick to run in an Orca terminal even when cron starts it, so that Orca can supervise the workers and I can see the tick too.
6. As a developer, I want a worker that finished successfully to be released with its output archived and its worktree removed, so that Orca stays tidy and I can still read what it did.
7. As a developer, I want a worker whose run failed to be retained with its worktree kept, so that I can open it and debug.
8. As a developer, I want the run record on the pull request to name the Orca dispatches of that run, so that I go from the pull request to the exact worker output.
9. As a developer, I want a worker's question to get an automatic answer that no human is available, so that an unattended run never hangs on a question.
10. As a developer, I want a worker that escalates, fails, or never reports within the run's time budget to count as a failed attempt, so that the normal fix rounds and hand-offs apply.
11. As a developer, I want autopilot to refuse Orca mode with a clear message when Orca is not running or the repository is not added to Orca, so that I know what to fix.
12. As a developer, I want the default mode to keep working on machines without Orca, so that the skill stays portable.

## Implementation Decisions

- **Workspace port.** The places where an agent works (implement and rework on the ticket branch, gates on the pushed head, the split of a local spec) open a workspace through a port: `open({ ref, name })` returning a directory and a cleanup. The default adapter is today's `git worktree add`. Mechanical work without an agent (branch updates, decision trails, tracker edits) keeps plain git worktrees.
- **Orca workspace adapter.** `orca worktree create --repo id:<repo> --name <name> --base-branch <ref> --setup skip --no-parent --comment <ticket · step>`. The repository id comes from `orca repo list` by path. Autopilot keeps pushing `HEAD` to the ticket branch, so Orca's own branch name does not matter. Cleanup removes the worktree unless one of its workers was retained.
- **Orca harness adapter.** One Run per tick (`orchestration run-create`). Each agent call is `orchestration worker-start --spec <prompt> --worktree id:<worktree> --agent <agent> --task-title <ticket · role> --run <run>`. The spec keeps the delegation to the named role agent and adds a result contract: write the final JSON object to `.autopilot-out/<role>-<n>.json` in the worktree and send `worker_done` with `--report-path`. `.autopilot-out/` is excluded through the repository's `info/exclude`.
- **Mailbox.** One loop per tick waits with `orchestration check --run <run> --wait --types worker_done,escalation,question`, matches each message to its worker by the payload's `dispatchId`, answers questions with "no human is available; decide yourself, or finish with outcome failed", treats escalations as failures, and acknowledges each delivery.
- **Settlement.** Before the workspace is cleaned up, a succeeded worker is released (`worker-release`, which archives its output) and any other worker is retained (`worker-retain`). Release always precedes removing the worktree, or the archive is lost.
- **Coordinator.** Orchestration commands need an Orca terminal (`ORCA_TERMINAL_HANDLE`). The CLI in Orca mode without one relaunches the same command with `orca terminal create --worktree path:<repo> --title "autopilot …" --command …`, waits for it to exit, and exits with its status.
- **Run records** gain `orca: [dispatch ids]`.
- **Budgets.** Orca reports no tokens, so in Orca mode only the time budget applies; the token budget and daily token limit see zero.
- **Known side effect.** When the base ref is the repository's default branch, Orca fast-forwards the local default branch (observed in a spike on 2026-10-25).

## Testing Decisions

- The Orca adapters take a transport (`orca <args> --json` → parsed JSON), like the GitHub and GitLab adapters. Tests use an in-memory fake Orca whose workers run scripted role handlers in real git worktrees and post `worker_done` to a fake mailbox.
- Primary seam stays one tick: a tick in Orca mode takes a ticket to a merged pull request; run records name the dispatches; succeeded workers are released and their worktrees removed; a failed verification's workers are retained and their worktree kept; a question gets the automatic answer; a worker that never reports fails the attempt.
- Adapter-level tests: repository lookup by path and the refusal when it is missing; relaunch into an Orca terminal when no coordinator handle exists; every call goes through the transport with `--json`.
- Prior art: `forge.test.mjs` (fake CLI transports), `tick.test.mjs`.

## Out of Scope

- Orca automations as the scheduler (they start an agent prompt, not a command); cron or launchd starts the tick.
- Remote Orca hosts and paired servers.
- Token accounting in Orca mode.
- Adapters for other agent managers; the workspace and harness ports leave room for them.

## Further Notes

- Spike, 2026-10-25, Orca 1.4.237, omp 18.12.6: `run-create` outside an Orca terminal fails with `no_active_sender_terminal`; inside one, a worker started with `worker-start` wrote its report and sent `worker_done` with `payload.dispatchId`, `outcome` and `reportPath` within 13 seconds; `check --run --wait` returned it; the worktree stayed clean with `.autopilot-out/` excluded; a non-default base ref created no local branch; `worker-release` after the worktree was removed archived nothing.
- Orca types a terminal's `--command` into the terminal's shell, so the command ends only that process; `exec` makes the terminal end with it. Orca's `terminal wait` may report exit code 0 for a failed command (`host_status_unavailable`), so the relaunch writes the exit code and output to files and reads them back.
- Three workers starting at once must share one Run; the harness creates the Run once per tick.
- Orca names this repository by its `upstream` remote; the adapter never relies on Orca's remote identity, only on the repository path.
