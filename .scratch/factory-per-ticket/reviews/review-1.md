# Review: Factory Coordinator-Per-Ticket Redesign Plan

## Verdict

approve with changes

The overall architecture matches the user-approved brief and makes several strong refinements (generalizing project-specific names, introducing `due` timestamps, moving atomic coordination into `scripts/resources.mjs`, and separating dispatcher from per-ticket coordinator). However, the plan contains blocking liveness, concurrency, security, fidelity, and dependency-order defects that must be resolved before creating the spec/tickets or starting implementation.

## Blocking issues

### 1. [high] Hashing `due` into the watcher fingerprint breaks liveness after the first wake
- **Category:** Gaps and risks (liveness)
- **Evidence:** `plan.md:39` proposes: *"Fingerprint của watcher gồm board cộng với câu hỏi 'đã có due nào tới hạn chưa'"* (watcher fingerprint includes the board plus whether any `due` is reached). `plan.md:51` and `plan.md:121` repeat this.
- **Why it breaks:** If `due=true` is hashed into the change-detection fingerprint, the first wake after a `due` passes writes `due=true` into `wake-fingerprint` and wakes the dispatcher. If that dispatcher run fails (quota/provider error), or wakes a dead coordinator that fails to advance its `due`, or checks a blocked worker that needs a second check one `Wake timeout` later (`plugins/software/skills/factory/PLAYBOOK.md:116`), the next 15-minute watcher tick still computes `due=true`. The fingerprint is unchanged, `wake-check.sh` exits `1` (`quiet`), and the watcher never wakes the dispatcher again.
- **Fix:** Do not include `due` in the equality-compared fingerprint. Have `wake-check.sh` exit `0` when **either** `(board fingerprint changed)` **or** `(resources.mjs due reports any item <= now)`. Also cover four `due` sources that `plan.md:39` misses because they do not live in a coordinator's `tickets/<n>.md`:
  1. Initial `due` written by the dispatcher when launching a coordinator (catches turn-1 coordinator crashes before it writes anything).
  2. Wake `due` written whenever a parked/held coordinator is woken via `send` (catches crashes immediately on wake).
  3. Dispatcher-level `due` for expired `quota.md` entries (needed when the `coordinator` role itself was out of quota, so no `tickets/<n>.md` exists yet) and for running/unknown trunk CI.
  4. Free resource capacity with a non-empty queue (catches lost wakeups; see issue #4).

### 2. [high] Removing the 1-hour wake creates a blindspot for red or unknown trunk CI
- **Category:** Gaps and risks (liveness, merge safety)
- **Evidence:** `plugins/software/skills/factory/references/t3.md:40` fingerprints only trunk's commit SHA (`gh api repos/<owner>/<repo>/commits/<trunk> --jq .sha`). `plugins/software/skills/factory/PLAYBOOK.md:93-96` relies on subsequent wakes to detect red trunk CI and "no result at all for two wake timeouts" (`Unknown CI`). `plan.md:30,46,121` drops the 1-hour fallback wake and assigns `Stop the line` to the dispatcher without updating what `wake-check.sh` fingerprints for trunk.
- **Why it breaks:** When a PR merges, trunk's SHA changes and wakes the dispatcher while trunk CI is still `in_progress`. The dispatcher finishes and archives. Five minutes later trunk CI fails (red) or stalls (`Unknown CI`), while trunk's SHA never changes again. No watcher wake fires until an unrelated board event occurs.
- **Fix:** Include trunk check-run statuses/conclusions (`gh api repos/<owner>/<repo>/commits/<trunk_sha>/check-runs` and `/status`, filtered to `Trunk checks`) in `wake-check.sh`'s board fingerprint, **and** have the dispatcher set a dispatcher-level `due` (`now + Wake timeout`, alerting at `2 * Wake timeout`) whenever a trunk check is `running` or unreported.

### 3. [high] Land resource bundle (`2 slot → scarce → merge`) deadlocks when `Max workers: 1` and misses CI, conflict, failure, and TTL handling
- **Category:** Gaps and risks (concurrency, merge safety)
- **Evidence:** `plan.md:44` (Gap 6): *"Land xin trọn bộ theo đúng thứ tự: 2 slot (verify ‖ review) → các scarce resource mà verify cần → `merge`. Sau đó cập nhật nhánh. Trunk không đổi thì merge luôn. Trunk đổi thì check lại, rồi merge. Cuối cùng nhả hết."* Compare `plugins/software/skills/factory/PLAYBOOK.md:38` (*"together when the limits allow"*) and `PLAYBOOK.md:86` (CI `Required checks` must pass on the current head commit).
- **Why it breaks:**
  1. **Permanent deadlock on `Max workers: 1`:** Requesting `2 slot` can never be satisfied if `Max workers` is `1`.
  2. **Deadlock across multiple scarce resources:** `slot → scarce → merge` is only a partial order when a project defines 2+ `Scarce resources` (`SETUP.md:53`); two coordinators acquiring them in different orders deadlock.
  3. **Parked holder expiry race:** If coordinator B acquires `slot` and then parks waiting for `scarce` or `merge`, B holds `slot` while idle. If the wait exceeds holder TTL, the dispatcher's `reclaim` rips `slot` away from a live parked coordinator, which later runs workers without holding a slot.
  4. **Missing CI, conflict, and failure paths after trunk update:** Pushing a trunk-merged commit produces a new `head_sha` that invalidates `factory/verify`, `factory/review`, **and** GitHub CI `Required checks`. `plan.md:44` says *"Trunk đổi thì check lại, rồi merge"* without waiting for `Required checks` on the new head, without specifying whether the coordinator merges clean trunk updates itself or delegates a `build` worker (and how conflicts trigger `build` + `Conflict rounds`), without renewing holder leases across the multi-step Land (conflict build + CI + verify + review), and without releasing `merge` + `scarce` if the re-check or CI fails and enters Rework.
- **Fix:**
  1. Cap Land's slot request at `min(2, Max workers)`, and define strict head-of-line FIFO blocking in `scripts/resources.mjs` for multi-unit `slot` requests (so a 2-slot waiter is not starved by 1-slot requests).
  2. Sort multiple scarce resources alphabetically (canonical total order) and enforce that order in `scripts/resources.mjs`.
  3. Distinguish live-parked holders from dead/stuck holders: renew leases on every coordinator turn, and do not reclaim an upstream resource held by a live coordinator that is parked in a downstream queue (only reclaim if the thread is dead/failed or past an explicit max park timeout, releasing **all** resources held by that ticket together).
  4. Spell out the full Land state machine after trunk moved: clean merge vs conflict (`build` worker, `Conflict rounds` counter), clean reset gate, `verify` + `review` + waiting for `Required checks` on the new `head_sha`, re-checking `Merge guard`, and releasing `merge` + `scarce` + extra slots immediately if any check fails into Rework or Hold.

### 4. [high] Omitted `factory:active` lifecycle and broken "PR closed without merge" path
- **Category:** Fidelity (contradicts/omits user-approved brief decisions) & Gaps and risks (cleanup/loops)
- **Evidence:**
  - `brief.md §2` explicitly settles: claim a frontier ticket without `factory:active`; write claim lock in memory first, then add `factory:active` and a comment with the thread id. `plan.md` never mentions `factory:active` anywhere — not in `DISPATCHER.md` (`plan.md:102-106`), not in `COORDINATOR.md` Close (`plan.md:101`), and not in `SETUP.md` label creation (`plan.md:115-119`, cf. `plugins/software/skills/factory/SETUP.md:80`).
  - `brief.md §5` says: `person merges or closes the PR → Close, release all resources, unwatch`. `plan.md:101` defines only one `Close`: *"handoff, nhả tài nguyên, unwatch, xoá nhánh remote, báo người chờ, settle sau cùng."*
- **Why it breaks:**
  1. Without `factory:active` in `SETUP.md`, `DISPATCHER.md`, and `COORDINATOR.md`, the brief's agreed tracker-visible claim signal and thread-id comment are dropped. (Also note a sequencing bug in `brief.md §2` itself: the coordinator's thread id does not exist until after `launch-coordinator`, so the order must be: write claim lock → add `factory:active` → launch coordinator → record thread id in state & post ticket comment.)
  2. Running the merged `Close` path when a human **closes a PR without merging** posts a `## Handoff` and closes the ticket (falsely unblocking dependent tickets!). Conversely, removing `factory:active` while leaving the issue open without `factory:hold` causes the next dispatcher run to immediately re-claim and rebuild the PR the human just closed.
- **Fix:**
  1. Add `factory:active` to `SETUP.md` label creation (and migration), `DISPATCHER.md` claim/reclaim (with partial-claim recovery if a dispatcher crashes between adding `factory:active` and launching the coordinator), and `COORDINATOR.md` Close.
  2. Split `Close` into **Merged** (post `## Handoff`, close ticket, remove `factory:active`, delete remote branch, release resources, wake waiters, unwatch, settle) and **Closed without merge** (do not post handoff or close ticket; add `factory:hold` with a brief asking whether to close or retry, remove `factory:active`, release resources, wake collision waiters, unwatch, settle).

### 5. [high] Prompt injection and GitHub permission check flaw on PR (and issue) comments
- **Category:** Gaps and risks (security / prompt injection)
- **Evidence:** `brief.md §5` requires treating non-owner/non-collaborator comments as untrusted data (prompt injection). `plan.md:98` states only: *"comment của người tin cậy (owner hoặc collaborator, kiểm bằng `gh api …/collaborators/<login>/permission`)."*
- **Why it breaks:**
  1. On a public GitHub repository, `GET /repos/{owner}/{repo}/collaborators/{username}/permission` returns **HTTP 200** with `{"permission": "read"}` for *any* GitHub user! Checking only command exit status or membership without requiring `.permission` to be `"admin"`, `"maintain"`, or `"write"` (rejecting `"triage"`, `"read"`, `"none"`, and non-200) treats every stranger as trusted.
  2. The factory itself posts `## Factory plan/verify/review/rework/brief` using the authenticated `gh` user (usually the repo owner, who has `"admin"` permission). Without filtering out factory-authored headings (or tracking handled comment IDs), the coordinator can misinterpret its own comments as human instructions.
  3. Reading all comments into the LLM context first and filtering by author afterward still exposes the model to prompt injection from untrusted comment bodies (including on issue comments read after `factory:hold` is removed, `PLAYBOOK.md:112`).
  4. `gh pr view --comments` only returns issue-level PR comments, missing PR review bodies (`/pulls/<n>/reviews`) and inline code review comments (`/pulls/<n>/comments`) where humans typically ask for code changes.
- **Fix:** Specify a small deterministic filter (either a helper in `scripts/` or a documented `gh api` + `jq` pipeline) that fetches issue comments, PR reviews, and inline review comments, checks `collaborators/<login>/permission` for `admin|maintain|write`, drops factory-prefixed comments and untrusted bodies *before* printing anything to the agent's context, and tracks last-processed comment/review IDs in ticket state.

### 6. [high] Multi-writer races on `quota.md`, `<memory>` git commits, and LLM-edited Markdown parsed by `resources.mjs`
- **Category:** Gaps and risks (concurrency) & Repo rules (`AGENTS.md` Rule 9)
- **Evidence:** `plan.md:40` says coordinators write `tickets/<n>.md`, `results/`, and *"các dòng quota ghi atomic"* while the dispatcher is the sole writer of `journal.md`, `wiki/`, and `<memory>` git commits. `plan.md:81-86` puts `tickets/<n>.md` (a Markdown file containing `thread`, `worktree`, `branch`, `status`, `due`, etc.) in `MEMORY.md` and does not include `quota.md` in `scripts/resources.mjs`. `plugins/software/skills/factory/scripts/roles.mjs:138-142` reads `quota.md` directly.
- **Why it breaks:**
  1. Concurrent coordinators cannot atomically add/remove lines in a single shared `quota.md` without a lock; simultaneous temp+rename overwrites clobber each other's quota blocks.
  2. Even with only the dispatcher committing `<memory>`, coordinators concurrently create/remove `resources/`, `claims/`, lock dirs, and `tickets/<n>.md` while the dispatcher runs `git add`/`git commit`, causing `git` errors on vanishing files or committing transient lock state.
  3. Having an LLM hand-edit a Markdown file (`tickets/<n>.md`) that `scripts/resources.mjs due` must reliably parse for `due`, `status`, `thread`, and `waiting on #m` violates `AGENTS.md` Rule 9 and `docs/adr/0002-factory-coordinator-agent.md:8`: a minor formatting drift by a coordinator silently breaks `due` and `reclaim`.
- **Fix:**
  1. Route all `quota.md` mutations (add block, prune expired) through `scripts/resources.mjs` under a `mkdir` lock (preserving the exact `quota.md` line format so `scripts/roles.mjs:138-142` keeps working unchanged).
  2. Add a `.gitignore` in `<memory>` (created by `SETUP.md`) ignoring transient runtime state (`resources/`, `claims/`, `*.lock`, `*.tmp`, `wake-fingerprint`), or stage only durable files (`index.md journal.md wiki/ tickets/ results/ providers.md quota.md`).
  3. Split machine-read ticket state (JSON written only via `resources.mjs` subcommands: `threadId`, `worktreePath`, `branch`, `status`, `due`, `waitingOn`, `reworkRounds`, `conflictRounds`, `liveTask`) from the human-readable `tickets/<n>.md` narrative/lessons log. Also add stale-mutex breaking (PID + mtime) in `resources.mjs` for `mkdir` locks left behind by crashed processes.

### 7. [high] Reset gate fails on unpushed branches, and parallel `verify ‖ review` in one worktree collides on `git status`
- **Category:** Gaps and risks (concurrency, merge safety) & Accuracy
- **Evidence:** `plan.md:41` (Gap 3): *"Trước khi reset, kiểm tra local khớp `origin/<branch>`; nếu không khớp thì dừng, vì đó là việc chưa push."* And `plan.md:107-109` keeps `verify ‖ review` in the shared worktree without detach. Compare `plugins/software/skills/factory/INTERFACE.md:32` (explicitly handles unpushed branches via `origin/<trunk>..HEAD`) and `plugins/software/skills/smode/playbooks/review.md:5,7,9` (`git fetch origin`, fixed point `origin/<trunk>`, and **`5. Check git status: still clean.`**).
- **Why it breaks:**
  1. Before `plan` and before the first `build`, `origin/<branch>` does not exist yet (the branch was just created locally from `origin/<trunk>`). Requiring local `HEAD == origin/<branch>` unconditionally halts every new ticket at step 1.
  2. While `verify` runs in parallel with `review` in the same worktree, `verify` drives the product (builds, dev server, temp specs/screenshots). Any untracked file written by `verify` during the run makes `review`'s step 5 (`Check git status: still clean`, `review.md:9`) fail or report spurious dirty-tree findings.
  3. `review.md:7` diffs against `origin/<trunk>`, which can be stale in a long-lived worktree unless `git fetch origin` runs at the reset gate before Check.
- **Fix:**
  1. Follow `INTERFACE.md:32`: if `origin/<branch>` exists, verify `HEAD == origin/<branch>` and working tree matches; if `origin/<branch>` does not exist yet (before first push), verify `git log origin/<trunk>..HEAD` is empty before cleaning.
  2. Always run `git fetch origin` at the reset gate before `Check` so `origin/<trunk>` is fresh and `HEAD` is on `<branch>` at `<head_sha>` (so neither `verify.md:5` nor `review.md:5` runs `git checkout --detach`).
  3. Direct `verify` to keep evidence outside the worktree (e.g. `<memory>/evidence/`), and note in `WORK-ORDERS.md` for `review` to inspect git (`<head_sha>` against `origin/<trunk>`) and tolerate transient untracked verifier artifacts when running in parallel — or verify in the spike whether `verify` + `review` ever collide on build artifacts.

### 8. [high] Missing `INTERFACE.md` operations will violate `AGENTS.md` Rule 3 (`T3_TOOL_NAMES` validator)
- **Category:** Repo rules (`AGENTS.md` Rule 3, `cli/lib.mjs:140-141`)
- **Evidence:** `plugins/software/skills/factory/SKILL.md:12`: *"The factory reaches the agent manager only through the operations in INTERFACE.md."* `cli/lib.mjs:140-141` fails `npm run validate` if any T3 tool name (`link_pull_request`, `t3_thread_*`, `t3_worktree_list`, etc.) appears outside `references/`. Yet `plan.md:90` (`INTERFACE.md`) lists only `launch-coordinator`, `start-worker`, `send`, `watch-pr`, `unwatch-pr`, `revive`, `close-workspace`, and `schedule-wakes`, while `plan.md:50,101,104-105` and `brief.md §7` require `COORDINATOR.md` and `DISPATCHER.md` to perform:
  - linking the PR to the coordinator thread (`link_pull_request`),
  - settling the coordinator at Close (`t3_thread_organize` `settle`),
  - archiving the dispatcher at exit (`t3_thread_organize` `archive`),
  - snoozing a new coordinator (`t3_thread_organize` `snooze`),
  - listing worktrees for stray sweep (`t3_worktree_list`),
  - inspecting a coordinator thread's health for `revive` (distinct from inspecting a child worker via `task_status`, which fails across threads per `references/t3.md:7`).
- **Fix:** Add or fold every one of these into `INTERFACE.md` as manager-neutral operations (for example: fold `snooze` into `launch-coordinator`, add `link-pr`, `settle-coordinator` / `archive-dispatcher` or `finish-session`, `list-workspaces`, and extend `inspect` to cover coordinator sessions as well as workers) and map each in `references/t3.md`.

### 9. [high] Reviving a dead coordinator risks two concurrent writers in one worktree, and claiming an existing PR fails with `baseRef: origin/main`
- **Category:** Gaps and risks (concurrency, migration, fidelity)
- **Evidence:**
  - `references/t3.md:7`: *"`task_status` and `task_cancel` refuse another thread's tasks."* `brief.md §2` job 4 and `plan.md:90,104` revive a dead coordinator by creating a new thread on `existing_worktree`.
  - `plugins/software/skills/factory/PLAYBOOK.md:32`: *"The ticket's pull request is the open one that closes it, whoever opened it ... Its branch is the ticket's branch, whatever its name, and the factory carries it on from where it is."* `brief.md §3` hardcodes `baseRef: "origin/main", branch: "factory/<n>-<slug>"` on `launch-coordinator`.
- **Why it breaks:**
  1. If a coordinator dies while a child `build` worker is still running, the revived coordinator on `existing_worktree` cannot inspect (`task_status`) or cancel (`task_cancel`) the old thread's child worker. Starting a new worker immediately puts two workers editing the same worktree simultaneously.
  2. If a claimed ticket already has an open PR (human-opened per `PLAYBOOK.md:32`, or carried over during migration from the old factory), launching a worktree from `origin/main` with `branch: "factory/<n>-<slug>"` either fails (branch already exists) or discards the PR's existing commits.
- **Fix:**
  1. Extend Spike Test 5 to verify how the dispatcher checks whether the dead coordinator's child worker thread is still running (`t3_thread_read` on `childThreadId`) and whether it must wait or can stop it before launching the revived coordinator on `existing_worktree`. Document that guard in `DISPATCHER.md`.
  2. In `DISPATCHER.md`, check for an existing open PR closing the ticket (`PLAYBOOK.md:32`) before `launch-coordinator`; if one exists, pass `baseRef: "origin/<pr_branch>"`, `startFromOrigin: true`, `branch: "<pr_branch>"` (and include existing-PR branch checkout in Spike Test 1).

### 10. [high] Build order runs Ticket A before the Spike, and dependency tags omit critical tests and fallbacks
- **Category:** Order and dependencies
- **Evidence:** `plan.md:131-135` schedules Ticket A (`scripts/resources.mjs`, `MEMORY.md`, `roles-template.md`, `thought_level`) **before** Ticket B (Spike). Individual file dependencies in `plan.md:81-123` also miss dependencies, and `plan.md:62-68` omits fallbacks for Tests 7 and 9:
  - Step 1 (`resources.mjs`) & Step 2 (`MEMORY.md`), marked `[độc lập]`: depend on Tests 1, 5, 7, 8 (e.g., if Test 7 fails, park-and-wake via `t3_thread_send` breaks; if Test 5 needs child-worker tracking, ticket state fields change).
  - Step 10 (`roles-template.md`), marked `[độc lập]`: depends on Test 6 (`plan.md:68`: if Test 6 fails, dispatcher moves from `scout` to `coordinator`, changing the role descriptions).
  - Step 3 (`INTERFACE.md`), marked `[chờ 1, 3, 5]`: also depends on **Tests 2, 4, 6, 7, 8** (shared workspace, `close-workspace` cleanup, `send` to idle coordinator, `scout` launching coordinator).
  - Step 4 (`COORDINATOR.md`), marked `[chờ 2, 3, 7]`: also depends on **Tests 1, 4, 8** (worktree setup/branch naming; whether T3 "after merging" deletes the coordinator's CWD while `Close` runs!).
  - Step 5 (`DISPATCHER.md`), marked `[chờ 6, 7, 9]`: also depends on **Tests 1, 3, 4, 5, 8** (`launch-coordinator`, fallback if Test 3 fails, cleanup ownership, `revive`).
  - Step 6 (`WORK-ORDERS.md`), marked `[chờ 2]`: also depends on **Test 1** (if Test 1 fails, worktrees stay per-step and `fetch`/`reset` cannot be dropped).
- **Fix:**
  1. Reorder tickets so the **Spike runs first** (Ticket A = Spike + the standalone `thought_level` bugfix in `references/t3.md:55`; Ticket B = `scripts/resources.mjs` + `MEMORY.md`; Ticket C = `INTERFACE.md`, `COORDINATOR.md`, `DISPATCHER.md`, `WORK-ORDERS.md`, `SKILL.md`; Ticket D = `SETUP.md`, `references/t3.md`, `roles-template.md`, `smode/playbooks/factory.md`, repo docs & manifest bumps).
  2. Add fallbacks for **Test 7** (if `t3_thread_send` cannot wake an idle top-level thread, park-and-wake cannot work as designed — must revive/launch or revisit design) and **Test 9** (if `watch_pull_request` *does* wake on issue label removal, dispatcher job 3 simplifies).
  3. For Test 8 (`plan.md:59`), also explicitly design `Close` to run post-merge commands independent of the worktree CWD (e.g. `gh -R <owner>/<repo>` from `<memory>`) so a fast T3 "after merging" deletion cannot crash `Close`.

### 11. [high] Resource-handoff wake loss and collision circular-wait deadlock
- **Category:** Gaps and risks (concurrency, liveness)
- **Evidence:** `brief.md §4` (*"the releaser `t3_thread_send`s the head of the queue. Safety net: dispatcher reclaims expired/dead holders and wakes the queue head if nobody did"*), `plan.md:48` (Gap 10: *"Người chờ ghi `waiting on #m` vào hồ sơ của mình. Coordinator #m, khi Close, gửi tin cho những người đang chờ nó."*), `plan.md:82`.
- **Why it breaks:**
  1. **Lost wake on release:** If Coordinator A crashes after `resources.mjs release` and before sending the wake message to Coordinator B (head of queue), B sits idle forever unless `resources.mjs due` treats "resource has free capacity AND queue is non-empty" (or an unacknowledged grant older than e.g. 5 minutes) as immediately due so the dispatcher wakes B.
  2. **Collision circular wait (deadlock):** If Ticket A and Ticket B finish `Plan` at roughly the same time with overlapping `files_to_change`, A can see B's plan (`waiting on #B`) while B sees A's plan (`waiting on #A`). Neither proceeds and neither ever wakes the other.
  3. **Non-factory PR collisions & stale branch base:** If `files_to_change` overlaps a human-opened PR (no coordinator), nobody sends a wake on merge unless the dispatcher checks `waiting on PR #<p>` on board change. Also, once `#m` merges and wakes waiting Ticket A, A's worktree is still on the old trunk commit before `#m`; building without first updating from `origin/<trunk>` guarantees avoidable conflicts.
- **Fix:**
  1. In `resources.mjs`, have `due` report immediately due whenever any resource has available capacity with a waiter in `queue` (or track a short grant/ack deadline); have `DISPATCHER.md` wake unacked/head waiters.
  2. Add a deterministic collision tie-breaker: a ticket already past `Plan` (building/open PR) always takes precedence; between two tickets both finishing `Plan`, the lower ticket number (or earlier claim timestamp) proceeds and the higher waits. Support waiting on a set of blockers (including non-factory PR numbers), and fast-forward/update the worktree to `origin/<trunk>` before starting `build` after a collision wait or a `Plan`-phase hold.

## Non-blocking issues

### 12. [medium] Accuracy errors in current-state references and repo details
- **Category:** Accuracy & Repo rules
- **Evidence:**
  1. `plan.md:124` updates only `"`once` for one wake"` in `plugins/software/skills/smode/playbooks/factory.md:6`, missing line 3 (*"a coordinator builds every approved spec"*), line 7 (*"the coordinator follows its playbook"*), and critically **line 5** (*"an `Agent:` line without a `Coordinator:` line"*), which becomes broken/misleading once `Coordinator:` is removed and fails to catch old single-coordinator `factory.md` files (which *have* `Coordinator:`).
  2. `plan.md:124` says *"Chạy `npm run index` nếu có mô tả thay đổi"*: inaccurate — `renderSkillsIndex` in `cli/lib.mjs:164-179` outputs only `- <skill>: <plugin>`, not skill descriptions.
  3. `plan.md:128` says *"Bump `software` lên 0.13.0 ở cả ba manifest và marketplace"*: inaccurate — `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json` do not contain version fields; only the three `plugins/software/.{claude,cursor,antigravity}-plugin/plugin.json` manifests do (`cli/lib.mjs:296-323`).
  4. `plan.md:109` says `WORK-ORDERS.md` should drop `fetch`, `reset`, and `switch`: note that `fetch` + `git reset --hard origin/<branch>` was actually in `references/t3.md:17`, while `WORK-ORDERS.md:29` had `switch to it first` and `git pull --ff-only origin <branch>`.
  5. Minor citation slips: `plan.md:32` cites `MEMORY.md:3` for *"commit một lần mỗi wake"* (actually `MEMORY.md:16`); `plan.md:33` attributes `git worktree remove` to `PLAYBOOK.md` Close (actually `references/t3.md:24`; `PLAYBOOK.md:58` calls `close-workspace`); `plan.md:20` cites `PLAYBOOK.md:126-129` as kept unchanged, overlooking `PLAYBOOK.md:128` (`Finish before start`), which changes for resource acquisition under pure FIFO (`brief.md §4`).
- **Fix:** Update all four lines of `smode/playbooks/factory.md` (and `SETUP.md:10` to detect v1 via `Agent:` without `Manager:`, and single-coordinator via `Coordinator:` present). Correct the manifest/index notes in step 11–12.

### 13. [medium] Migration detection and cleanup are incomplete
- **Category:** Gaps and risks (migration)
- **Evidence:** `plan.md:52` (Gap 14) detects the old design only by checking `t3-coordinator` in memory `index.md`, and stops at checking live workers, deleting the old watcher, adding `Max tickets`, and dropping `Coordinator:`.
- **Why it matters:**
  - On a second machine or clean memory dir, `docs/agents/factory.md` still has `Coordinator:` while `index.md` has no `t3-coordinator`, so migration would not trigger.
  - Migration does not mention creating `factory:active` on GitHub (`SETUP.md:80`), deleting/replacing `<memory>/wake-check.sh` and `wake-fingerprint`, creating `tickets/`/`claims/`/`resources/` and `.gitignore`, unpinning/renaming the old `t3-coordinator` thread, removing `t3-coordinator`/`live workers` from `index.md`, or reminding the user to disable T3's **"after the thread settles"** cleanup setting.
  - `SETUP.md:14` (`Override`) also needs to support `Max tickets`, `Conflict rounds`, `Reset keeps`, and drop leftover `Coordinator:` lines.
- **Fix:** Trigger migration if **either** `docs/agents/factory.md` has `Coordinator:` **or** `<memory>/index.md` has `t3-coordinator`, and add the full migration checklist above to `SETUP.md`.

### 14. [medium] Dispatcher lock has no expiry/reclaim, and `scout` quota exhaustion is unhandled
- **Category:** Gaps and risks (liveness)
- **Evidence:** `plan.md:49` (Gap 11) adds a `mkdir` lock `dispatcher` to prevent overlapping dispatchers, and `plan.md:82` lists `lock dispatcher` and `reclaim holder quá hạn hoặc thread đã chết`.
- **Why it matters:** If a dispatcher crashes mid-run (provider error, quota, killed), a non-expiring `mkdir` lock blocks all future dispatches permanently. Separately, if the watcher's pinned `scout` model runs out of quota, the watcher fails every 15 minutes until reset; and the watcher launching the dispatcher needs to pick the first available `scout` candidate from `docs/agents/roles.md` (not hardcode one) or record quota failures.
- **Fix:** Give the `dispatcher` lock a TTL (e.g., `Wake timeout`, storing `threadId` and `expiry`) so `wake-check.sh` / `resources.mjs` can reclaim an expired/dead dispatcher lock. Document in `DISPATCHER.md`/`references/t3.md` how the watcher chooses the dispatcher's `scout` candidate (first non-blocked `PASS` candidate) and note watcher-thread quota exhaustion as a known limitation.

### 15. [medium] Over-building and contention in Land fast-path + premature `spec`/`to-tickets` split
- **Category:** Simplicity
- **Evidence:** `plan.md:44` (Gap 6) always acquires `2 slot + scarce + merge` in Land even when trunk has not moved. `plan.md:131-135` splits work into 4 tickets with `resources.mjs` written before the spike.
- **Why it matters:** When trunk has not moved since `Check`, waiting for 2 free slots and every scarce resource (e.g. a dev-server port) blocks other tickets unnecessarily just to run `gh pr merge`.
- **Fix:** Keep the user's "always update branch, hold `merge` while verify and review rerun" rule, but allow a clean fast-path: acquire `merge` first; if `git merge-base --is-ancestor origin/<trunk> HEAD` is true, merge immediately and release `merge` (zero slot/port wait). Only if trunk moved: release `merge`, acquire `min(2, Max workers)` slots → sorted scarce resources → `merge`, then update from trunk, re-check (keeping `merge` held), and merge. (Assumption: releasing `merge` *before* starting the branch update does not violate the user's rule of holding `merge` during the update and re-check; confirm with the user if strict single-acquisition is preferred.)

### 16. [low] Fidelity check: explicit list of where the plan fills gaps vs tweaks brief decisions
- **Category:** Fidelity
- **Evidence & Classification:**
  - **Refines a brief detail (good, flag for user awareness):**
    - `plan.md:41` (Gap 3): changes `brief.md §3`'s *"Clean reset gate before every worker"* to *"before every step (once before parallel `verify ‖ review`)"* — necessary so reset does not destroy `verify`'s workspace mid-run.
    - `plan.md:51` (Gap 13): drops `results/` from `brief.md §8`'s watcher fingerprint (*"board or results/ changed"*) and replaces it with `due` — sound, since worker results now wake their coordinator directly.
    - `plan.md:42-43` (Gaps 4–5): replaces `brief.md §3-4`'s project-specific `node_modules`, `.wrangler/state`, `port-4317` with `Reset keeps:`, `verify.md` Cleanup, and `Scarce resources` — required by repo rules (`ADR-0002:11`).
  - **Fills a gap (unaddressed in brief; confirm policy with user):**
    - `plan.md:47` (Gap 9): owner/collaborator code-change comments do not count toward `Fix rounds`. (Sensible since human-triggered; confirm with user.)
    - `plan.md:45` (Gap 7): `factory:hold` releases all resources and keeps only the worktree. (Essential; avoids holding scarce resources indefinitely during human waits.)
    - `plan.md:46` (Gap 8): `Stop` cancels watcher + sets `Status: paused`, letting active coordinators finish their current step. (Note: clarify **where** a human types `pause` / `resume` / `stop` now that there is no single permanent coordinator thread! See issue #19.)
    - `plan.md:116`: `Conflict rounds: 3` promoted to a `docs/agents/factory.md` setting (matches `brief.md §5`'s proposed max 3).
  - **Contradicts/omits a brief decision (must fix):** `factory:active` omitted (issue #4); `Close` conflates merged vs unmerged-closed PR (issue #4).

### 17. [low] `scripts/resources.mjs` must explicitly forbid external dependencies
- **Category:** Repo rules
- **Evidence:** `plugins/software/skills/factory/scripts/roles.mjs:12` documents *"No dependencies: it runs from wherever the skill is installed (a plugin, a skills folder), which has no node_modules."* `plan.md:81-84` does not state this constraint for `scripts/resources.mjs`.
- **Fix:** State explicitly that `scripts/resources.mjs` uses Node >=20 built-ins only (`node:fs`, `node:path`, `node:os`, `node:crypto`), zero external packages, and uses `resources.test.mjs` so `npm test` (`package.json:11`) runs it automatically.

## Missing items

### 18. [medium] Missing updates to `PLATFORMS.md`, `README.md`, `SKILL.md` description, and tracker templates
- **Evidence:**
  - `PLATFORMS.md:91-130` (`## Running the factory`) describes the old single-coordinator design in detail (*"The coordinator is that thread for life"*, *"after an hour"*, *"`factory once` = one wake"*). `plan.md:125-129` omits it completely.
  - `README.md:18` describes *"a coordinator agent"* in the pipeline summary; `plan.md:129` mentions only adding a release note.
  - `plugins/software/skills/factory/SKILL.md:3` frontmatter description still says *"a coordinator builds approved specs"*.
  - `plugins/software/skills/setup-software-context/issue-tracker-github.md:33` and `issue-tracker-gitlab.md:33` list factory labels/comments (`factory:hold`, `## Handoff`) and should mention `factory:active` if that label is part of the tracker contract.
- **Fix:** Add all four files to Step 12 (Ticket D).

### 19. [medium] User interface for `pause`, `resume`, `stop` with no permanent coordinator thread
- **Evidence:** `plugins/software/skills/factory/PLAYBOOK.md:120-122` and `SKILL.md:17` assume a human tells the long-lived coordinator thread `"pause"`, `"resume"`, or `"stop"`. `plugins/software/skills/smode/SKILL.md:82` routes `"stop", "pause", "resume"` to `playbooks/factory.md`. Under the new design (`plan.md:46,112-114`), there is no single coordinator thread; `SKILL.md` only lists `setup | setup override | run | once`.
- **Why it matters:** It is unclear how a user issues `pause`, `resume`, or `stop` (which thread do they type it in, and does `SKILL.md` gain `pause | resume | stop` modes or handle them from any chat thread?).
- **Fix:** Define explicit `pause`, `resume`, and `stop` handling in `SKILL.md` (and `argument-hint` / `smode/playbooks/factory.md`) so a user can run them from any thread in the project root: `pause` writes `Status: paused` to `<memory>/index.md`; `resume` writes `Status: running` and triggers a dispatcher run; `stop` deletes the watcher schedule and writes `Status: paused`.

### 20. [medium] Conflict-resolution work order instructions missing from `WORK-ORDERS.md`
- **Evidence:** `brief.md §5` requires: *"conflict from a trunk merge: build merges trunk into branch, resolves, runs tests, pushes; then rerun BOTH verify and review"* and *"conflict touches protected path or changes another ticket's meaning: hold with brief."* Because the coordinator never reads diffs (`PLAYBOOK.md:5`), only the `build` worker can detect *"changes another ticket's meaning"*. `plan.md:107-110` does not add conflict-resolution instructions to `WORK-ORDERS.md`.
- **Fix:** Add a conflict-resolution variant to `WORK-ORDERS.md`'s `build` section instructing the worker to merge `origin/<trunk>`, run tests, push, and — if resolving the conflict touches a protected path from `docs/agents/merge-policy.md` or alters another ticket's semantics — abort/stop and report the conflict in the result's `questions` (reusing existing `smode/RESULTS.md:14` keys without changing the schema).

### 21. [low] Stray worktree sweep safety rule is unspecified
- **Evidence:** `plan.md:105` says only *"quét worktree"* (sweep worktrees). Compare `references/t3.md:24`: *"Never pick a worktree by commit or by the `t3/` prefix: a person's worktree and the watcher's sit at the same trunk commit, and a cleanup by commit removed both."*
- **Fix:** State in `DISPATCHER.md` and `references/t3.md` that stray sweep removes **only** worktrees recorded in factory ticket state whose ticket is closed/merged (or PR merged), whose coordinator thread is settled/archived, and that pass the push check (or have a merged PR) — never arbitrary worktrees from `t3_worktree_list`.

## Points where you agree

1. **Generalizing project-specific details (`plan.md:42-43`, Gaps 4–5):** Moving `node_modules`/`.wrangler/state` to `Reset keeps:` + `verify.md` Cleanup and `port-4317` to `Scarce resources` keeps the skill clean and compliant with `ADR-0002:11`.
2. **Putting concurrency-critical logic in `scripts/resources.mjs` (`plan.md:81-84`):** Matches `AGENTS.md` Rule 9 and `ADR-0002:8` — FIFO queues, lock ordering, claims, and `due` calculations should never rely on LLM prose.
3. **Single writer for `journal.md`, `wiki/`, and `<memory>` git commits (`plan.md:40`, Gap 2):** Keeping the dispatcher as the sole git committer and wiki ingester cleanly avoids parallel `index.lock` and wiki merge conflicts (once paired with issue #6's `.gitignore` and locked `quota.md`).
4. **Splitting `PLAYBOOK.md` into `DISPATCHER.md` and `COORDINATOR.md` (`plan.md:73,93-106`):** Cleanly follows `writing-for-agents` progressive disclosure by branch, keeping each agent's context focused.
5. **Catching `thought_level` (`plan.md:53`, Gap 15) and adding Spike Tests 7–9 (`plan.md:57-60`):** Both are sharp catches; Test 8 (cleanup-during-Close race) and Test 7 (waking idle top-level threads) directly target the riskiest T3 unknowns.
