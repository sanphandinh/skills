# A dispatcher per run and a coordinator per ticket

ADR-0002 made the factory one long-lived coordinator per repository, and the T3 reference kept it as one thread for life, woken by a watcher. Run for real on `gia-pha-studio` (2026-11-26/27), that design showed four costs: the coordinator's context grew with every wake; `wake-check.sh` woke it every hour even when nothing changed (eight empty Opus wakes in a row while the board waited on one hold); every step had its own worktree (4–8 worktrees and 4–8 `pnpm install` per ticket, with results passed between steps through the remote); and one ticket's history was spread over many wakes. The hold was also two rules: GitHub and GitLab used a hold label of the factory's own, Jira and local trackers the triage role `ready-for-human`.

We now run **a watcher, a dispatcher per run, and a coordinator per ticket**. The watcher (a scheduled, fresh, cheap session) starts a dispatcher only when the board's fingerprint changed or something in the memory folder fell due. The dispatcher, a fresh session on the `scout` route that keeps nothing between runs, claims tickets, launches their coordinators, wakes and revives them, keeps the line and sweeps workspaces. Each claimed ticket gets its own coordinator, a session on the `coordinator` route in the ticket's own workspace from plan to Close; its workers share that workspace, behind a reset gate before every step. Shared state lives in the memory folder and is written through `scripts/resources.mjs` under one lock: claims, resources (`slot`, scarce resources, `merge`, taken in one order with first-in-first-out queues), each ticket's due, the dispatcher lock, the run status and quota blocks. The merge queue is the `merge` resource: Land merges at once when the branch already contains trunk, and otherwise updates the branch from trunk and checks it again while holding `merge`. A hold is the triage role `ready-for-human` on every tracker; the factory adds no label of its own, and a claim is a record in memory plus a `## Factory claim` comment.

## Considered options

- **Keep one coordinator and only drop the hourly wake.** Rejected: it fixes the empty wakes but not the growing context, the per-step worktrees or the scattered history.
- **A label such as `factory:active` for the claim.** Rejected: adding a label is not atomic, so it cannot stop two dispatchers claiming one ticket; it is a second source of truth beside memory; and every change moves the board's fingerprint.
- **Keep the factory's own hold label.** Rejected: the triage roles already carry the meaning on every tracker, and one rule for all trackers is simpler than two.
- **A per-step worktree when the setup script is slow.** Rejected after the spike: T3 holds a new thread's first turn until a setup script marked `async: false` finished, so one workspace per ticket is ready before the first worker.
- **Reclaim resources by the clock.** Rejected: a coordinator parked on a person or a resource may wait for days; a holding past its time only makes the dispatcher look, and resources are reclaimed only from a session found dead.

## Consequences

- Supersedes ADR-0002's long-lived coordinator and its one-coordinator-per-repository rule. The rest of ADR-0002 stands: the coordinator orchestrates and never reads diffs, workers run smode playbooks, verdicts are statuses on the exact head commit, merges use `--match-head-commit`.
- `docs/agents/factory.md` drops `Coordinator:` and gains `Max tickets`, `Conflict rounds` and `Reset keeps`; `factory setup` converts a running factory of the old design, including its old hold labels.
- The factory's modes are `setup`, `setup override`, `run`, `once`, `pause`, `resume` and `stop`; `run` only schedules the watcher, so the session a person types in never becomes part of the factory.
- The T3 reference depends on T3's per-project worktree cleanup being set so it never removes a live coordinator's workspace, and on the dispatcher, not the pull request watch, to notice comments written by the account T3 runs as.
- Evidence: `.scratch/factory-per-ticket/research/` (the spike and the end-to-end runs).
