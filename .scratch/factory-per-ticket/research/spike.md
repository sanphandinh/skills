# Spike: per-ticket coordinator on T3 Code

Ticket A of the plan (section 2). Run 2026-11-27 on T3 Code server 0.1.12 (macOS arm64), sandbox repository `sanphandinh/factory-ticket-sandbox` (private, created for this run; T3 project `mcp:eeb06939-7caa-4269-942e-7a0e5a76a23b`, setup script `sleep 25 && date -u +%FT%TZ > .setup-ran`, run on worktree create). Every thread named below is in that project. Raw notes per experiment; the summary table is at the end.

## 1. `t3_thread_launch` with a worktree

Thread `factory #1 spike-worktree` (`mcp:launch:7b3366de…751ac0`), Claude Sonnet 5.5 effort low, `full-access`, `workspaceStrategy {type: worktree, baseRef: origin/main, startFromOrigin: true, branch: factory/1-spike-worktree}`.

- Branch kept: `git branch --show-current` = `factory/1-spike-worktree`; `t3_worktree_status` = `{"attached":true,"worktreePath":"/Users/sanphan/.t3/worktrees/factory-ticket-sandbox/factory-1-spike-worktre-fbeeadbb57cb744d","branch":"factory/1-spike-worktree",…}`. PASS.
- Setup script before the first worker: **FAIL**. Activity: "Workspace ready / Workspace preparation completed" at 05:28:01.314Z; the first turn started 05:28:01.325Z; its first command at 05:28:03Z found no `.setup-ran`; both workers (started 05:28:08–10Z) also found none; the setup script wrote `.setup-ran` at 05:28:26Z. T3 runs the project's setup script beside the thread's first turn, not before it.
- Retest with the setup script marked `async: false` (`t3_project_update` scripts; T3's client derives `waitForSetup = runOnWorktreeCreate && async === false`): thread `factory #3 spike-setup-wait` (`mcp:launch:28a4a340…cfcf`), launch requested 05:36:05Z, "Workspace ready" 05:36:31.604Z, first turn started 05:36:31.623Z, its first command (05:36:34Z) found `.setup-ran` written at 05:36:31Z. **PASS**: with a non-async setup script, T3 holds the first turn until setup finished, so every worker the coordinator starts sees a prepared worktree. A script created through `t3_project_create` without `async` ran beside the turn. So the per-step-worktree fallback is not needed; setup checks that every setup script of the project (`runOnWorktreeCreate: true`) has `async: false`.
- Launch on an existing pull request's branch: thread `factory #2 spike-pr-branch` (`mcp:launch:170ebcb5…2985`), `baseRef: origin/spike/pr-branch, branch: spike/pr-branch`: `git branch --show-current` = `spike/pr-branch`, `git log` shows the PR commit `cf7d4aa Spike: PR branch`. PASS. The local branch has no upstream (`git status -sb` prints `## spike/pr-branch` only), so pushes name the remote branch (`git push origin HEAD:<branch>`).

## 2. Antigravity worker with `isolation: "shared"`

From thread #1: `delegate_task` `1 spike-ag` (antigravity, gemini-4-hydrogen, `thought_level: low`) and `1 spike-claude` (claudeAgent, claude-haiku-5-5), both `isolation: "shared"`. Both reported `pwd` and `git rev-parse --show-toplevel` = the coordinator's worktree and branch `factory/1-spike-worktree`; both files (`ag-was-here.txt`, `claude-was-here.txt`) landed in the coordinator's worktree (`git status --short` there: `?? ag-was-here.txt`, `?? claude-was-here.txt`). PASS. Each completion started a new turn in the coordinator thread (notification "Delegated task "1 spike-claude" finished").

## 5. Revive with `existing_worktree`

Thread #1 started `1 spike-sleeper` (antigravity, `sleep 900`) and ended its turn; thread #1 then showed `status: waiting` with the sleeper under `pendingBackgroundTasks`. New thread `factory #1 spike-revive` (`mcp:launch:2902c79b…b434`), `workspaceStrategy {type: existing_worktree, worktreePath: <thread #1's worktree>}`:

- Bound to the old worktree: `pwd` = that path, `git branch --show-current` = `factory/1-spike-worktree`, the untracked files still there. PASS. But T3's own metadata for the new thread says `branch: null` (`t3_worktree_status` and `t3_thread_read`): read the branch with git, never from the revived thread.
- `task_status` on the old thread's task: refused, `task_not_found` ("No delegated task with id … exists on thread <new thread>"). `task_cancel`: refused the same way.
- `t3_thread_read` on the old worker's `childThreadId`: works (status `running`, `parentThreadId` = thread #1, last item `$ sleep 900`).
- `t3_thread_interrupt` with `stop: true` on the old worker's `childThreadId`: `interrupt_requested`, then the child read `status: interrupted`, "Stopped by an agent". So a revived coordinator can see an old worker and stop it, through the child's thread, not through its task. PASS with that mapping.
- Stopping the old worker woke the **old** coordinator: thread #1 got run 5 at 05:29:50Z, started by the notification "Delegated task "1 spike-sleeper" stopped", and answered in that turn. A dead coordinator whose provider is back can therefore act again after a revive, so every coordinator turn first checks that the record's `thread` is its own session (plan 1.6, start of each turn).

## 6. A cheap dispatcher launches a coordinator on another model with `full-access`

Thread `factory dispatcher spike6` (`mcp:launch:4e70dd6a…a8ea8`), Claude Haiku 5.5 effort low, project root (`workspaceStrategy root`, `full-access`), called `t3_thread_launch` with `modelSelection` Sonnet 5.5 and `runtimeMode: "full-access"`: no error; `t3_thread_configure` on the new thread = `{"model":"claude-sonnet-5-5",…,"runtimeMode":"full-access"}`; that thread confirmed the same from inside. PASS. (A launched thread cannot exceed the launcher's modes, so the dispatcher itself must be `full-access`.)

## 7. `t3_thread_send` to an idle top-level thread

Sent to idle thread #2 (`mode: auto`): `delivery: "started"`, a new run (ordinal 2) answered `2026-11-27T05:29:18Z WOKE`. Same on thread #1 (run 4). PASS.

Snoozed: thread #1 snoozed (`t3_thread_organize snooze`, until 2026-12-31) at ~05:58, then sent a message: `delivery: "started"`, run 6 answered `2026-11-27T05:58:55Z SNOOZED-WOKE`. PASS, but afterwards the thread read `snoozed: false`: a message ends the snooze. A coordinator snoozes itself again at the end of each turn (unless it is flagged for a person), or its turns notify the phone.

## 3. What `watch_pull_request` wakes on

Thread #2 linked and watched PR #2 (`until: "merged"`; the watch answered `checksState: "passing"`, "no wake will come for them"). Every wake below is one new turn in thread #2 whose first item is a notification and whose message starts "Update on pull request #2 …, which T3 Code is watching for you:".

| Change (UTC) | Wake | Delay |
|---|---|---|
| Review comment by `sanphandinh` (the account T3 and `gh` run as), 05:35:42 | none, ever | — |
| CI failed on `d16ca25` (pushed 05:38:15) | 05:39:52 "#2: checks failed", body "Checks failed on d16ca25: test <job url>" | ~1.5 min after the failure |
| Trunk commit conflicting with the branch, 05:43:40 | 05:45:55 "#2: merge conflict", body "The branch now conflicts with main." | ~2 min |
| PR conversation comment by `sanphandinh`, 05:43:58 | none | — |
| Branch fixed (failing test dropped, trunk merged) 05:48:32, CI green | 05:49:59 "#2: checks passed", body "All 1 check passed on b7d24b3." | ~1.5 min |

Result: PASS for checks failed, checks passed and conflicts (merge: see experiment 4); **FAIL for comments written by the account T3 runs as**, which is the project owner in this setup (the same holds on `gia-pha-studio`). A comment from another account was not tested (no second account). Fallback taken: the board fingerprint already covers each PR's `updatedAt`, so a new comment starts a dispatcher run; the dispatcher wakes the ticket's coordinator when `comments.mjs fetch` shows a trusted comment not yet acknowledged. The coordinator's own watch still wakes it on checks, conflicts and the merge.

## 9. Does the watch wake on a label change on the issue?

Added `ready-for-human` to issue #1 (closed by PR #2's body) at 05:30:24; no wake in the next 9 minutes (the next wake, 05:39:52, was the CI failure and named only that). As expected: the dispatcher keeps the unhold step.

## Worktree cleanup in T3 0.1.12

The settings the plan assumed ("Cleanup: after the thread settles, after merging") no longer exist. T3 0.1.12 has, globally (`storageCleanup`) and per project (Settings, a project's worktree cleanup set to custom), these rules (read from T3's own settings text):

- **Delete merged worktrees** (`worktreeOnMerge`): "worktrees whose pull request is merged and whose commits are included in the default branch".
- **Delete inactive worktrees** (`worktreeAfterDays`): "after their threads have been inactive for this many days".
- **Delete settled worktrees** (`worktreeSettledAfterDays`): "this many days after their thread settles. Set 0 days to remove them at the next cleanup".
- **Delete unchanged worktrees** (`worktreeUnchanged`): "worktrees with no commits beyond the default branch".
- **Keep worktrees with local changes** (`worktreeKeepWhen`): `uncommitted-changes` (default; "keeps edits and untracked files, deletes ignored files"), `any-local-files`, or `tracked-changes`.

The cleanup sweep runs hourly (`StorageCleanup.sweep` spans in T3's server trace at 04:20:40Z and 05:20:40Z). This machine's global settings are `worktreeAfterDays: 3` and `worktreeUnchanged: true`; with them, a coordinator's worktree before its first commit (plan, hold on a plan question) is "unchanged", and a ticket held more than 3 days is "inactive": both rules can remove a live coordinator's worktree. Consequences for the design: setup asks the person to set the project's worktree cleanup to custom with inactive, unchanged and settled off, and merged on (settled stays off: a superseded coordinator settles on its next turn while the revived one still works in the same worktree; review of ticket 01, finding 2); a revive or a wake whose worktree is gone launches the coordinator on a new worktree from the ticket's branch (experiment 1 showed that works); the dispatcher's sweep stays the last net.

## Seen on the way: effort options per model

`orchestrator_capabilities` (2026-11-27 05:27Z) lists the effort option by model, not by instance. On `cursor`: `grok-4.7` takes `reasoning_effort` (low…xhigh), `grok-4.6` takes `effort`, `claude-opus-5-5` takes `effort`, `gemini-4-neon` takes `reasoning_effort`, `composer-2.5` has none. On `antigravity` every Gemini model takes `thought_level`; on `claudeAgent`, `effort`; on `opencode`, `variant`. So the reference maps `effort=<level>` to the option of that model whose values are effort levels, instead of one option per instance.
