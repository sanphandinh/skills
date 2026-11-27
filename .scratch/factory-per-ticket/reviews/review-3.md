# Review Round 3: Factory Coordinator-Per-Ticket Plan (v4)

## Verdict

approve with changes

Every `file:line` citation in `plan-v4.md` matches the repository accurately. Plan v4 cleanly resolves Round-2's `ready-for-human` PR deadlock (`S1`/`S7`), `wake-fingerprint` write timing and Source-5 FIFO gating (`S5`), `git fetch origin` in Land (`S4`), memory multi-writer isolation (`S11`), tracked-file reset (`S13`), missing repo file updates (`S14`), and spike-before-spec ordering (`S15`). Six blocking issues remain in liveness/due handling, Land pre-checks, revive/watcher lock sequencing, `comments.mjs` endpoints, and the ticket state model, along with six non-blocking consistency gaps and four over-building simplifications.

## Blocking issues

### 1. [high] `due` handling hangs `blocked` workers and `Unknown CI` PRs, and fails to clear `due` when tickets hold, wait, or park
- **Evidence:** `plan-v4.md:52-58` (§1.3), `plan-v4.md:69-72` (§1.4), `plan-v4.md:266-275` (Step 6 `DISPATCHER.md`); `plugins/software/skills/factory/INTERFACE.md:30`, `PLAYBOOK.md:86,96,116`, `references/t3.md:7,34`.
- **Why it breaks:**
  1. **Blocked workers hang forever:** Because `task_status` and `task_cancel` refuse another thread's tasks (`references/t3.md:7`), only the ticket's own coordinator can nudge or cancel a worker that stopped reporting (`INTERFACE.md:30`, `PLAYBOOK.md:116`). Yet §1.4 (`plan-v4.md:71`) instructs the dispatcher to simply renew the lease whenever a worker is still running—without checking whether the worker has had activity within `Wake timeout` (`references/t3.md:34`). A blocked worker never sends a completion event, so the coordinator stays idle forever while the dispatcher endlessly renews its lease.
  2. **Idle `running` coordinators (e.g., waiting on `Required checks` / `Unknown CI`) hang and cause 15-minute empty-wake loops:** When a PR waits on `Required checks` that never report (`PLAYBOOK.md:96`), `watch-pr` never fires. Its `due` expires and wakes the dispatcher, which sees a live `idle` coordinator with no live worker. `DISPATCHER.md` (`plan-v4.md:266-275`) has no step to wake a live idle coordinator on expired `due` or advance its `due`—so `due` stays expired and launches empty dispatchers every 15 minutes while `Unknown CI` is never detected.
  3. **Empty wakes on `held` / `waiting` / `parked`:** §1.3 never specifies clearing `due` (`null`) when a coordinator enters `held`, `waiting`, or `parked`. Leaving the previous `due` set recreates the 15-minute empty-wake loop while the board only waits on a human or another ticket.
- **Fix:**
  1. Define the `due` lifecycle explicitly in §1.3/§1.5: set `due = now + Wake timeout` whenever a coordinator is `running` (waiting on a worker or `Required checks`), on launch (Source 2), and on wake (Source 3); **clear `due = null`** whenever a ticket transitions to `held`, `waiting`, `parked`, or closed.
  2. In `DISPATCHER.md`'s due-inspection step:
     - If a `running` coordinator has a live worker: inspect `childThreadId` activity (`t3_thread_read`). If it has recent activity, renew lease and `due`; if it has **no new activity for `Wake timeout`**, wake the coordinator (`send` + reset `due`) so the coordinator handles the `blocked` worker.
     - If a `running` coordinator is alive (`idle`) with **no** live worker and its `due` expired, wake it (`send` + reset `due`) so it checks `Required checks` / `Unknown CI` or resumes stalled work.

### 2. [high] Land merges red trunk into healthy PRs and sends `PENDING` `Required checks` to Rework/Hold
- **Evidence:** `plan-v4.md:73-84` (§1.4 Land Steps 1–7); `plugins/software/skills/factory/PLAYBOOK.md:27,86,89,95`.
- **Why it breaks:**
  1. **Merging broken trunk into PRs:** Land evaluates Merge guard only in Step 2 (when trunk has *not* moved) and Step 6 (after updating from trunk and re-checking). When trunk is **red** (`Stop the line`, `PLAYBOOK.md:89,95`), `origin/<trunk>` has moved to the broken commit, so Step 2 is skipped, Step 3 acquires slots + scarce + `merge`, Step 4 merges the **broken trunk commit** into the PR branch, Step 5 fails `verify`/`Required checks`, and Step 7 sends a healthy ticket into **Rework**—burning `Fix rounds` on trunk's regression. Similarly, PRs that already require a human hold (`Auto-merge: off`, `Door: one-way`, protected path, trunk-fix PR) run a full trunk-merge + verify + review cycle while holding `merge` before Step 6 finally holds them.
  2. **`PENDING` CI treated as failure:** Ticket chain (`PLAYBOOK.md:27`) enters Land once `factory/verify` and `factory/review` are `success`, even while GitHub `Required checks` are still `PENDING`/`IN_PROGRESS`. In Step 2, Merge guard line 2 fails on `PENDING` CI, and Step 7 (`plan-v4.md:84`) releases all resources and transitions to **Rework or Hold** on *any* Merge guard failure—instead of waiting for CI to finish.
- **Fix:**
  1. Add a **pre-Land gate** before Step 1 (and re-checked before Step 3's trunk update):
     - If `Required checks` on the current head are `PENDING`/`IN_PROGRESS`, do not acquire `merge`; end the turn waiting on `watch-pr` with `due` set. If `FAILED`, enter Rework.
     - Check static Merge guard gates before Step 3: if `ready-for-human` is present, or `Auto-merge: off`, `Door: one-way`, disallowed blast radius, protected path, or trunk-fix PR requires a human (and is not already approved), hold without merging trunk; if **trunk is red**, wait (release `merge` if held; do not merge red trunk into the branch and do not enter Rework or Hold).
  2. Clarify in Steps 5 and 7 that `PENDING` `Required checks` on the new head is a **wait** (end turn with `due` set, keeping `merge` held—and optionally releasing `slot`/`scarce` once `verify` and `review` pass), not a Step 7 failure exit.

### 3. [high] `revive` runs before resource reclaim and omits `link-pr`/`watch-pr`, causing self-deadlock and blind PRs
- **Evidence:** `plan-v4.md:66` (§1.4), `plan-v4.md:113-117` (§1.6), `plan-v4.md:265-275` (Steps 5–6).
- **Why it breaks:**
  1. **Self-deadlock after revive:** `DISPATCHER.md` runs `revive` (`plan-v4.md:268`) *before* `gia hạn hoặc thu hồi tài nguyên` (`plan-v4.md:270`). If dead Coordinator A died while holding `slot`, `scarce`, or `merge`, `revive` launches Coordinator B and writes B's live `threadId` into `tickets/<n>.json`. Step 4 then sees a live coordinator and never reclaims A's resources. Coordinator B starts with fresh context and calls `resources.mjs acquire` for its next step, where `<n>` still holds A's leaked resources (e.g., holding `merge` causes `resources.mjs` to reject acquiring `slot` for violating total order §1.4 line 66).
  2. **Detached PR link/watch on revived or existing-PR coordinators:** A revived coordinator (`existing_worktree`) and a newly claimed ticket with an existing open PR (`plan-v4.md:113`) run on new threads that do not inherit `link_pull_request` or `watch_pull_request`. Without re-calling `link-pr` and `watch-pr`, PR events (CI, reviews, conflicts, human merges) never wake the coordinator and T3's "after merging" worktree cleanup never fires.
- **Fix:**
  1. In `revive` (§1.6 & `DISPATCHER.md`), after confirming the old child worker has exited or been stopped, call `resources.mjs reclaim <n>` (releasing all resources held by `<n>` and clearing stale `liveTask`) *before* launching Coordinator B.
  2. In `COORDINATOR.md`, require any coordinator thread on its first turn with an existing open PR (after `revive`, claiming an existing PR, or migration) to call `link-pr` and `watch-pr`.

### 4. [high] Putting `lock` inside `DISPATCHER.md` misses turn-1 `scout` quota crashes and keeps the quota crash loop
- **Evidence:** `plan-v4.md:61-62` (§1.3), `plan-v4.md:267` (Step 6 `DISPATCHER.md`), `plan-v4.md:298` (Step 10 `references/t3.md`).
- **Why it breaks:** Step 6 places acquiring the `dispatcher` lock inside `DISPATCHER.md` (`plan-v4.md:267`). When the watcher launches a dispatcher thread on a `scout` candidate that is out of quota, the provider rejects turn 1 before the dispatcher runs a single shell command—so the `dispatcher` lock is never written and never records that `threadId`. On the next tick, §1.3's quota recovery (*"lock quá hạn bị thu hồi. Khi thu hồi, đọc `error` của thread đã chết. Có dấu hiệu quota thì chặn candidate `scout` đó"*) never runs, and the watcher launches the same exhausted `scout` candidate every 15 minutes indefinitely. It also leaves a race window where `factory once`/`resume` and a watcher tick can launch two dispatchers concurrently before either acquires the lock.
- **Fix:** Have the caller that starts the dispatcher (the watcher in `references/t3.md`, or `factory once`/`resume`) acquire the `dispatcher` lock with TTL before calling `t3_thread_launch` and immediately record the returned `threadId` in the lock (the dispatcher still releases the lock on exit). On subsequent ticks, if a lock exists, the watcher checks whether its `threadId` already `failed` or the lock expired; if so, it reads `error`, calls `resources.mjs quota-block` when quota words match, reclaims the lock, and launches on the next `scout` candidate.

### 5. [high] `scripts/comments.mjs` conflates ticket issue comments with PR conversation comments (3 endpoints instead of 4)
- **Evidence:** `plan-v4.md:149-150` (§1.9), `plan-v4.md:247-250` (Ticket B Step 2), `plan-v4.md:330` (§4).
- **Why it breaks:** On GitHub, top-level comments on the **ticket issue** (`/repos/{owner}/{repo}/issues/<ticket>/comments`, where humans answer `## Factory brief` holds) and top-level Conversation comments on the **pull request** (`/repos/{owner}/{repo}/issues/<pr>/comments`, where humans request code changes) are two separate endpoints with different numbers (`<ticket>` vs `<pr>`), alongside `/pulls/<pr>/reviews` (whose timestamp field is `submitted_at`, not `created_at`) and `/pulls/<pr>/comments`. Plan v4 specifies only three endpoints (`issue:<id>`, `review:<id>`, `inline:<id>`, and *"id trùng giữa ba endpoint"* at `plan-v4.md:330`). A 3-endpoint design either drops PR Conversation comments or drops ticket hold-answer comments, and breaks on Jira/local trackers where `<ticket>` is not a GitHub issue number.
- **Fix:** Make `comments.mjs fetch` accept `--issue <n>` (optional, for GitHub trackers) and `--pr <n>` (optional, once a PR exists) separately: query `/issues/<issue>/comments` when `--issue` is given, and query `/issues/<pr>/comments`, `/pulls/<pr>/reviews` (using `submitted_at`), and `/pulls/<pr>/comments` when `--pr` is given. Keep endpoint-namespaced IDs (`issue:<id>`, `review:<id>`, `inline:<id>`; GitHub issue and PR conversation comments share one `issue_comment` ID space) and tag each returned item with its surface (`ticket` vs `pr`).

### 6. [high] `tickets/<n>.json` status enum contradicts `check-plan`'s `building` state and breaks collision checks across `parked`/`held`
- **Evidence:** `plan-v4.md:93` (§1.5), `plan-v4.md:105` (§1.6), `plan-v4.md:157-161` (§1.10).
- **Why it breaks:**
  1. §1.5 (`plan-v4.md:93`) enumerates ticket statuses as `running`, `parked on <resource>`, `held`, `waiting on [#m, PR #p]`, `closed_unmerged`, and §1.6 (`plan-v4.md:105`) counts `Max tickets` over `running`, `parked`, `waiting`. Yet §1.10 (`plan-v4.md:160`) transitions a ticket to **`building`**, which is absent from both lists.
  2. Overloading one `status` field for both lifecycle phase (`planning` vs past-plan `building`) and wait state (`running`/`parked`/`held`) breaks collision protection: if Ticket #10 passes `check-plan` (`building`) and then parks waiting for a `slot` (`parked on slot`) before opening a PR, its `status` is overwritten. When Ticket #2 runs `check-plan` on overlapping files, #10 no longer shows `building`, allowing both tickets to build overlapping files concurrently.
- **Fix:** Split the two fields in `tickets/<n>.json`:
  - `state`: `running | parked | waiting | held | closed_unmerged` (with `parkedOn` / `waitingOn`; `Max tickets` counts `state` in `{running, parked, waiting}`).
  - `planCleared`: boolean (`false` until `check-plan` approves the ticket; remains `true` across `parked` and `held` until Close).
  - Under the `check-plan` lock, check overlap against `--open-prs` and every claimed ticket with `planCleared === true`.

## Non-blocking issues

### 7. [medium] Push check in `Close (closed_unmerged)` and stray sweep fails when the closed PR's remote branch was deleted
- **Evidence:** `plan-v4.md:131` (§1.7), `plan-v4.md:175` (§1.12), `plugins/software/skills/factory/INTERFACE.md:32`; previously flagged in `review-2.md:34` (S3).
- **Why it matters:** When a person closes a PR without merging and deletes (or GitHub auto-deletes) its remote branch, `origin/<branch>` disappears after `git fetch --prune`. `INTERFACE.md:32`'s push check then falls back to `git log origin/<trunk>..HEAD`, which is non-empty because of the closed PR's commits—failing the push check and leaving the worktree orphaned indefinitely. Also, in `closed_unmerged` (`plan-v4.md:131`), the coordinator runs inside that worktree and must invoke `git -C <project_root> worktree remove` (or defer removal to the dispatcher's sweep after settle) so it does not delete its own CWD.
- **Fix:** Extend the push check in `INTERFACE.md` / `DISPATCHER.md`: when a ticket has a merged or closed PR, a clean `git status --porcelain` plus `HEAD == <pr.headRefOid>` (or `git fetch origin refs/pull/<pr>/head && git log FETCH_HEAD..HEAD` empty) satisfies the push check even if `origin/<branch>` was deleted. Run `close-workspace` from `<project_root>` (or let the dispatcher sweep `closed_unmerged` worktrees after settle).

### 8. [medium] `factory stop` writes `paused`, but `factory run` never resets `state/status.json` to `running`
- **Evidence:** `plan-v4.md:43` (§1.2), `plan-v4.md:58` (§1.3), `plan-v4.md:166-169` (§1.11), `plan-v4.md:287` (Step 8 `SKILL.md`).
- **Why it matters:** `factory stop` deletes the watcher schedule and writes `paused` to `state/status.json` (`plan-v4.md:169`). If the user later restarts the factory with `factory run` (`plan-v4.md:43`: "`run` chỉ lập lịch watcher"), `state/status.json` remains `paused`, so the rescheduled watcher exits quiet on every tick (`plan-v4.md:58`).
- **Fix:** Require `factory run` to write `running` into `state/status.json` via `resources.mjs` when scheduling the watcher.

### 9. [medium] Snoozing coordinators on creation suppresses `flag-human` notifications unless `flag-human` unsnoozes
- **Evidence:** `plan-v4.md:174` (§1.12), `plan-v4.md:193` (§1.13), `plan-v4.md:255,298` (Steps 4 & 10), `plugins/software/skills/factory/references/t3.md:22,93`.
- **Why it matters:** Every coordinator thread is now snoozed on creation (`plan-v4.md:174`). `references/t3.md:22`'s `flag-human` only `pin`s and `rename`s the thread, relying on turn-end notifications to alert the user. While snoozed, notifications are suppressed and the thread stays in the snoozed list.
- **Fix:** Update `flag-human` in `references/t3.md` to call `t3_thread_organize` `unsnooze` + `pin` + `rename` (`⏸ #<n> …`), and on unhold/clear call `unpin` + `rename` back + `snooze` (with an explicit `snoozedUntil` ISO timestamp as `t3_thread_organize` requires).

### 10. [medium] Migration pre-claiming old in-flight tickets in memory conflicts with partial-claim recovery
- **Evidence:** `plan-v4.md:180` (§1.12) vs `plan-v4.md:112-113` (§1.6).
- **Why it matters:** §1.12 line 180 says migration should pre-claim in-flight tickets in memory (*"Ticket đang làm dở được claim lại trong memory"*). Tickets from the old single-coordinator design have no per-ticket coordinator thread or persistent worktree; writing a claim without a `threadId` creates a broken partial claim (§1.6 line 112) that the first dispatcher immediately discards.
- **Fix:** Remove pre-claiming from the migration checklist in §1.12 / `SETUP.md`. After confirming no old workers are live, leave open tickets unclaimed in memory so the first dispatcher run claims them normally and picks up any existing open PR via §1.6's existing-PR rule (`baseRef: origin/<pr_branch>`, `branch: <pr_branch>`).

### 11. [medium] `## Factory brief` `To answer:` wording must distinguish standalone tickets from spec child tickets on label trackers
- **Evidence:** `plan-v4.md:193,196-198` (§1.13), `plugins/software/skills/factory/PLAYBOOK.md:109`.
- **Why it matters:** On GitHub/GitLab, Hold removes `ready-for-agent` and adds `ready-for-human` (`plan-v4.md:193`). Unholding a **standalone** ticket requires restoring `ready-for-agent` (`plan-v4.md:197`), whereas unholding a **spec child** ticket requires only removing `ready-for-human` (`plan-v4.md:198`). Plan v4 never specifies the updated `**To answer:**` line (`PLAYBOOK.md:109`). If the brief says only "remove `ready-for-human`", standalone tickets will never re-enter unhold.
- **Fix:** Specify three `**To answer:**` variants in `COORDINATOR.md` (§1.13): standalone tickets (and Jira/local) → *"reply on this issue, then move it back to `<ready-for-agent>` (removing `<ready-for-human>`)"*; spec child tickets on label trackers → *"reply on this issue, then remove `<ready-for-human>`"*; human-merge PR holds (protected path / trunk fix) → *"merge the pull request (or reply and remove `<ready-for-human>`)"*.

### 12. [low] Migration omits removing `factory:hold` from issues if the label is kept, and `wontfix`/closed cleanup leaves PRs watched
- **Evidence:** `plan-v4.md:185` (§1.12), `plan-v4.md:199` (§1.13).
- **Why it matters:**
  1. §1.12 line 185 removes `factory:hold` from PRs, and on issues removes `ready-for-agent` and adds `ready-for-human`, without explicitly removing `factory:hold` from those issues (leaving stale `factory:hold` labels if the user declines deleting the repo label).
  2. §1.13 line 199 settles a held coordinator directly when its ticket moves to `wontfix` or closes, without unwatching any open PR that thread was watching; later PR activity will wake the settled thread.
- **Fix:** In §1.12 line 185, remove `factory:hold` from each migrated issue before offering to delete the label. In `COORDINATOR.md`, add a turn-start guard: if the ticket is closed, `wontfix`, or no longer claimed by this thread, call `unwatch-pr` (if any) and `settle` immediately.

## Earlier fixes that fall short

Findings `S1`, `S4`, `S5`, `S7`, `S11`, `S13`, `S14` (except the minor label removal in **#12**), and `S15` are cleanly resolved in `plan-v4.md`. The following earlier fixes remain incomplete:

- **R1, R14 & S8 (`due` liveness & lease reclaim boundary):** Making `resources.mjs` never auto-reclaim by clock is right, but `DISPATCHER.md` still lacks activity-based detection for `blocked` workers, lacks a wake step for idle `running` coordinators whose `due` expired (e.g., `Unknown CI`), never clears `due` on `held`/`waiting`/`parked` (see **#1**), and introduces an undefined `maxParkTimeout` (see **#13**).
- **R3, R15 & S9 (Land state machine):** Adding `git fetch origin`, `git merge-tree --write-tree`, sequential Check on `Max workers: 1`, and broad Step 7 release fixes the earlier gaps, but Land still merges **red trunk** into healthy PRs (and wastes trunk updates on already-held PRs) and treats `PENDING` `Required checks` as a Step 7 Rework/Hold failure (see **#2**).
- **R9 & S10 (`revive`, partial claim, and `scout` quota):** Partial-claim adoption and existing-PR `branch`/fork handling are fixed, but `revive` runs before resource reclaim (causing self-deadlock on leaked resources) and omits re-attaching `link-pr`/`watch-pr` (see **#3**), while placing `lock` inside `DISPATCHER.md` prevents catching turn-1 `scout` quota crashes (see **#4**).
- **R5 & S6 (`scripts/comments.mjs`):** Split `fetch`/`ack`, namespaced IDs, `since` cutoff, triage filtering, and 404 handling for bots are right, but the script still specifies 3 endpoints instead of separating ticket issue comments from PR conversation comments (see **#5**) and adds an unnecessary dual-`since` rule (see **#15**).
- **S12 (Atomic `check-plan`):** Moving `check-plan` under a `resources.mjs` lock fixes the race, but `building` conflicts with §1.5's status enum and §1.6's `Max tickets` count and gets overwritten when a ticket parks or holds (see **#6**; see also **#14**).
- **R4 & S3 (`Close` without merge):** Switching `closed_unmerged` to full release + settle cleanly fixes the unhold contradiction, but the push check still fails when GitHub deletes the closed PR's remote branch (`review-2.md:34`; see **#7**).
- **S2 (`ready-for-human` unhold & `Max tickets`):** Tightening unhold conditions, excluding `held` from `Max tickets`, and reordering `DISPATCHER.md` are right, modulo the `building` status mismatch (**#6**), missing `To answer:` brief wording (**#11**), and unwatched PR on `wontfix` (**#12**).

## Over-building

### 13. [medium] Drop `maxParkTimeout` eviction for live parked coordinators
- **Evidence:** `plan-v4.md:71-72` (§1.4): *"hoặc coordinator đang park mà chưa quá thời hạn park tối đa ... quá thời hạn park, dispatcher mới gọi `reclaim <ticket>`."*
- **Why it is over-building:** Neither `brief.md`, the post-brief decisions, nor `SETUP.md` defines a max park timeout. Strict total ordering (`slot → sorted scarce → merge`) prevents deadlock between live coordinators; a parked ticket only stalls if an upstream *holder* dies or hangs, which liveness checks on that holder already reclaim. Evicting a live parked coordinator on an arbitrary timeout also desyncs its in-memory state from `resources.mjs` (especially under `Max workers: 1`, where legitimate waits can exceed an hour).
- **Fix:** Remove `maxParkTimeout`. Renew upstream leases of any live parked coordinator unconditionally, and reclaim only dead/failed coordinators (plus on `revive`).

### 14. [low] Drop the two-ticket tie-breaker in `check-plan` — the atomic lock already serializes plans
- **Evidence:** `plan-v4.md:157-161` (§1.10): *"Hai ticket cùng vừa plan xong thì số ticket nhỏ hơn chạy trước."*
- **Why it is over-building:** Because `resources.mjs check-plan` runs under a mutex, two tickets cannot execute `check-plan` simultaneously. Whichever enters first sees the other has `planCleared === false`, sets `planCleared = true`, and proceeds; the second enters next, sees `planCleared === true`, and waits on the first. Adding a lower-ticket-number tie-breaker over `waiting` tickets adds code and risks yielding to a lower-numbered ticket that is itself blocked on another PR.
- **Fix:** Simplify `check-plan` to one rule under the lock: check overlap only against `--open-prs` and claimed tickets with `planCleared === true`; if clear, set `planCleared = true` and proceed; otherwise record `waiting` on the blockers.

### 15. [low] Keep a single immutable `since = claimedAt` in `comments.mjs` instead of shifting `since` on Hold
- **Evidence:** `plan-v4.md:150` (§1.9): *"chỉ lấy comment mới hơn mốc `since` (giờ claim; với câu trả lời cho hold là giờ đăng brief) và chưa được ack"*
- **Why it is over-building:** `ackedIds` already filters out every comment handled prior to a hold. Shifting `since` to the brief's timestamp adds a second state transition with no benefit and can silently drop an unacked PR comment posted just before the hold.
- **Fix:** Set `since = claimedAt` once at claim time and never overwrite it; rely on `ackedIds` to exclude already-processed comments.

### 16. [low] Eliminate the separate `claims/` directory in favor of `tickets/<n>.json`
- **Evidence:** `plan-v4.md:89-94,100` (§1.5), `plan-v4.md:108` (§1.6), `plan-v4.md:180` (§1.12).
- **Why it is over-building:** All mutations to `tickets/<n>.json` and `claims/` already run through `scripts/resources.mjs` under a `mkdir` lock. Maintaining a separate `claims/` directory duplicates active-claim state that `tickets/<n>.json` already carries, creating two structures that must stay in sync across claim, partial-claim adoption, `closed_unmerged`, `wontfix`, and Close.
- **Fix:** Represent active claims directly inside `tickets/<n>.json` (e.g., `claimed: true|false`, or move runtime state files `tickets/*.json` into gitignored `state/tickets/<n>.json` while keeping durable human narratives `tickets/<n>.md` committed in memory git) and drop `claims/`.
