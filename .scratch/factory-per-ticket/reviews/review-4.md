# Review Round 4: Factory Coordinator-Per-Ticket Plan (v5)

## Verdict

approve with changes

Every `file:line` citation in `plan-v5.md` was verified against the repository and matches accurately. Plan v5 cleanly resolves Round 3's `revive` ordering and first-turn `link-pr`/`watch-pr` (`T3`), 4-endpoint `comments.mjs` (`T5`), `state`/`planCleared` split (`T6`), `refs/pull/<pr>/head` push check (`T7`), `factory run` resetting `status.json` (`T8`), `flag-human` unsnooze/snooze (`T9`), migration pre-claim removal (`T10`), and all four over-building simplifications (`T13`–`T16`). Five blocking issues remain (mostly regressions or incomplete boundaries introduced while fixing `T1`, `T2`, `T7`, `T8`, and `T12`), alongside six non-blocking consistency fixes.

## Blocking issues

### 1. [high] Expired resource leases were dropped from `due` in §1.3/§1.4 (contradicting Ticket B & §4), deadlocking dead `parked` holders
- **Evidence:** `plan-v5.md:52-56` (§1.3), `plan-v5.md:74-76` (§1.4) vs `plan-v5.md:268` (Ticket B: *"`due` với năm nguồn"*) and `plan-v5.md:347,349` (§4: *"nguồn due số 5"*, *"hạn giữ quá chỉ sinh due chứ không tự reclaim"*).
- **Why it breaks:** Rewriting §1.3 cleared `due = null` when a ticket enters `parked` (`plan-v5.md:54`), and dropped expired resource leases from both §1.3 (`plan-v5.md:55`) and §1.4 (`plan-v5.md:75`). If a `parked` coordinator dies while holding an upstream resource (e.g., it holds `slot` and parked waiting on `scarce` or `merge`), neither its ticket `due` nor any dispatcher `due` ever fires. While the board is quiet, the dispatcher never wakes to run `reclaim`, permanently deadlocking every ticket queued behind that resource. Ticket B and §4 still assume the 5-source `due` list including expired leases.
- **Fix:** Restore expired resource leases as a `due` source in §1.3 and §1.4, and restore the explicit 5-source enumeration in §1.3 so Ticket B (`plan-v5.md:268`) and §4 (`plan-v5.md:347,349`) match: an expired lease never auto-reclaims, and instead causes `resources.mjs due` to wake the dispatcher, which renews leases of live coordinators (including `parked`) and runs `reclaim` only on dead/failed ones.

### 2. [high] `DISPATCHER.md` ignores `paused` (claiming/launching tickets while paused), and `resume` never wakes coordinators stopped mid-chain
- **Evidence:** `plan-v5.md:58` (§1.3), `plan-v5.md:182-188` (§1.11), `plan-v5.md:292-301` (Step 6 `DISPATCHER.md`); `plugins/software/skills/factory/PLAYBOOK.md:122`.
- **Why it breaks:**
  1. While `state/status.json` is `paused` and at least one ticket still has a live worker, the watcher intentionally wakes the dispatcher (`plan-v5.md:58`). However, §1.11 only tells *coordinators* to read `state/status.json` (`plan-v5.md:188`), and `DISPATCHER.md` (`plan-v5.md:292-301`) has no `paused` guard—so on the next tick it executes `gỡ hold`, `đánh thức người chờ`, `claim và launch`, and `Stop the line`, claiming and launching brand-new tickets while the factory is paused.
  2. When a live worker finishes (or a watched PR goes green) while `paused`, the coordinator handles the event and stops without starting the next step (`PLAYBOOK.md:122`). Later, `factory resume` (`plan-v5.md:185`) writes `running` and runs the dispatcher once—but nothing wakes that idle `running` coordinator (its `due` is either cleared or not yet expired, and no further worker/PR event will arrive), leaving the ticket stalled.
- **Fix:**
  1. In `DISPATCHER.md`, read `state/status.json` right after confirming the lock: while `paused`, skip `gỡ hold`, `đánh thức người chờ`, `claim và launch`, and `Stop the line` (run only `revive`/due-wake for tickets with live workers, lease renewal, lessons/journal/fingerprint/commit, worktree sweep, release lock, archive).
  2. In `COORDINATOR.md`, when stopping mid-chain because `status == paused`, clear `due = null` (preventing empty wakes while paused). In `resources.mjs resume`, when switching `paused -> running`, set `due = now` on every `running` ticket with no live worker (and clear `notifiedAt` on resource queue heads) so the dispatcher run triggered by `resume` wakes them immediately.

### 3. [high] Retrying a `closed_unmerged` ticket orphans the old worktree, collides on the local branch, and halts at the Reset Gate on the leftover remote branch
- **Evidence:** `plan-v5.md:141-147` (§1.7), `plan-v5.md:154` (§1.8), `plan-v5.md:196` (§1.12), `plan-v5.md:298-301` (Step 6 `DISPATCHER.md`).
- **Why it breaks:** In ordinary use, when a person closes a PR without merging (GitHub keeps the remote branch unless the user manually clicks "Delete branch") and moves the ticket back to `ready-for-agent`:
  1. `DISPATCHER.md` runs `claim và launch` (`plan-v5.md:298`) **before** `quét worktree` (`plan-v5.md:301`). Claiming overwrites `state/tickets/<n>.json` with the new thread/worktree, permanently orphaning the unswept `closed_unmerged` worktree; and `t3_thread_launch` requesting `branch: factory/<n>-<slug>` fails because that local branch is still checked out in the unswept worktree.
  2. `Close (closed_unmerged)` (`plan-v5.md:141-147`) never deletes the remote branch `origin/factory/<n>-<slug>`. When a fresh coordinator launches from `origin/<trunk>` on `factory/<n>-<slug>`, Reset Gate step 2 (`plan-v5.md:154`: *"Nếu `origin/<branch>` đã có: HEAD phải bằng nó"*) immediately halts as unpushed work (and a later `git push` would fail non-fast-forward).
- **Fix:**
  1. Move `quét worktree` **before** `claim và launch` in `DISPATCHER.md`, and ensure `close-workspace` removes both the worktree and its local branch (`git branch -D <branch>`) before clearing the old worktree entry.
  2. In `Close (closed_unmerged)`, after confirming the closed PR's head is preserved in `refs/pull/<pr>/head`, delete the remote branch if it is a `factory/*` branch (`git push origin --delete <branch>`); if the remote branch is non-factory or kept, launch retries on a fresh branch name (e.g., `factory/<n>-<slug>-2`).

### 4. [high] Land pre-gate deadlocks trunk-fix PRs and red-trunk waiters, misses `Auto-merge: off` and post-Step-3 red trunk, and leaks `merge` on `Unknown CI`
- **Evidence:** `plan-v5.md:53` (§1.3), `plan-v5.md:77-91` (§1.4 Land), `plan-v5.md:292-301` (Step 6 `DISPATCHER.md`); `plugins/software/skills/factory/PLAYBOOK.md:56,89,96`, `docs/agents/merge-policy.md:3`.
- **Why it breaks:**
  1. **Trunk-fix PR trapped:** Cổng trước Land checks *"Trunk đỏ: chờ"* (`plan-v5.md:80`) before *"PR sửa trunk: hold ngay"* (`plan-v5.md:81`). A trunk-fix PR only exists while trunk is red (`PLAYBOOK.md:89`); waiting for trunk to turn green deadlocks the fix.
  2. **Red-trunk waiters never wake:** When an ordinary PR waits at `plan-v5.md:80` because trunk is red, nothing wakes it once trunk turns green: `watch-pr` only fires on PR events, `DISPATCHER.md` has no wake step for red-trunk waiters, and §1.3 (`plan-v5.md:53`) sets `due` only while waiting on a worker or `Required checks`.
  3. **Post-Step-3 red trunk, `Auto-merge: off`, and `Unknown CI`:** Cổng trước Land only re-runs *before* Step 3 (`plan-v5.md:77`), not after Step 3's `git fetch origin`; if trunk goes red while the ticket parks for `slot + scarce + merge`, Step 4 still merges the red trunk commit into the PR. Cổng trước Land also omits `Auto-merge: off` (`docs/agents/merge-policy.md:3`), wasting a trunk merge + re-check while holding `merge`. Finally, if Step 5 hits `Unknown CI` (`PLAYBOOK.md:96`) or trunk goes red before Step 6, Step 7 (`plan-v5.md:91`) either leaks `merge` indefinitely (`Unknown CI`) or misroutes red-trunk Merge guard failure to Rework/Hold instead of releasing resources and waiting for trunk.
- **Fix:**
  1. In Cổng trước Land, check all human-merge holds (`ready-for-human`, `Auto-merge: off`, `one-way`, disallowed blast radius, protected path, trunk-fix PR) **before** checking *"Trunk đỏ: chờ"*.
  2. Re-check trunk green after Step 3's `git fetch origin` (before Step 4); if trunk is red there or in Step 6, release all held resources and wait for trunk (not Rework/Hold). On `Unknown CI` in Step 5, release `merge` before posting the Unknown CI brief.
  3. Wake red-trunk waiters cleanly: either record `waitingOn: ["trunk"]` (woken by the dispatcher when `Trunk checks` turn green in `Stop the line`) or set `due = now + Wake timeout` while waiting on red trunk.

### 5. [high] `wontfix`/closed cleanup leaves coordinators pinned, unsettled, watching PRs, and holding worktrees/resources
- **Evidence:** `plan-v5.md:132` (§1.6), `plan-v5.md:196` (§1.12), `plan-v5.md:224` (§1.13), `plan-v5.md:295` (Step 6 `DISPATCHER.md`).
- **Why it breaks:**
  1. When a person closes or marks `wontfix` a `held` (or `waiting`/`parked`) ticket, the dispatcher releases the claim (`plan-v5.md:224`) and expects *"coordinator tự settle ở đầu turn kế tiếp"* without **sending a wake** to that coordinator. Because `held`/`waiting`/`parked` tickets have `due = null` (`plan-v5.md:54`) and may have no PR (or an untouched PR), the coordinator never gets another turn—it stays pinned (`⏸ #<n>`), unsettled, watching any open PR, and its worktree is never swept (`plan-v5.md:196` requires the thread to be settled).
  2. `DISPATCHER.md` only checks `wontfix`/closed under `gỡ hold` (`plan-v5.md:295`), missing tickets closed or marked `wontfix` while `running`, `parked`, or `waiting`.
  3. The coordinator's turn-start guard (`plan-v5.md:132`) only calls `unwatch-pr` and `settle`, omitting clearing `flag-human` (unpin + rename), stopping any live worker, and releasing any held resources.
- **Fix:**
  1. In `DISPATCHER.md`, check closed/`wontfix` across **all** claimed tickets (not only `held`), release claim and resources, and **send a wake** (`send`) to any live coordinator thread so it runs its shutdown guard.
  2. Expand `COORDINATOR.md`'s turn-start guard (`plan-v5.md:132`) to: stop any live worker, release any remaining resources/claim, clear `flag-human` (unpin + rename), call `unwatch-pr`, and `settle`.

## Non-blocking issues

### 6. [medium] `INTERFACE.md` omits `launch-dispatcher`, creating a validator/archiving conflict for `factory once` and `factory resume`
- **Evidence:** `plan-v5.md:43` (§1.2), `plan-v5.md:61-63` (§1.3), `plan-v5.md:183-185` (§1.11), `plan-v5.md:192` (§1.12), `plan-v5.md:280-290` (Step 4 `INTERFACE.md`), `plan-v5.md:293,301` (Step 6 `DISPATCHER.md`); `cli/lib.mjs:140-141,257`.
- **Why it matters:** §1.3 groups watcher, `once`, and `resume` as callers that acquire the `dispatcher` lock, launch a dispatcher thread, and record its `threadId`, while `DISPATCHER.md` confirms that lock and archives its own thread on exit. Yet Step 4's `INTERFACE.md` only defines `launch-coordinator` (ticket worktree + snooze) and omits `launch-dispatcher` (stateless project-root session). Because `cli/lib.mjs:141,257` forbids naming `t3_thread_launch` in `SKILL.md`, Ticket C would either invent an unspecified operation or run `DISPATCHER.md` inline inside the user's chat thread and archive it.
- **Fix:** Add `launch-dispatcher` (project root, `scout` candidate, returns `threadId`, unsnoozed) to `INTERFACE.md` (Step 4) and `references/t3.md` (Step 10), and have `SKILL.md`'s `once` and `resume` modes (and the watcher) call it through the same lock-before-launch flow.

### 7. [medium] Reset Gate step 2 (`HEAD == origin/<branch>`) falsely halts when a human pushes a commit to a held PR
- **Evidence:** `plan-v5.md:154-155` (§1.8).
- **Why it matters:** Step 2 requires `HEAD` to equal `origin/<branch>` whenever `origin/<branch>` exists, halting otherwise as unpushed local work. When a person pushes a commit directly to a PR branch during a hold (or on an existing PR), local `HEAD` is strictly behind `origin/<branch>` with zero unpushed commits, yet the Reset Gate refuses to continue.
- **Fix:** Change Step 2 to check that `git log origin/<branch>..HEAD` is empty (still halting on any unpushed local commit or divergence), then have Step 3 reset to `origin/<branch>` (`git reset --hard origin/<branch>`), fast-forwarding cleanly to commits pushed by a person.

### 8. [medium] `comments.mjs ack` contradicts §1.5's single-writer rule for `state/tickets/<n>.json`
- **Evidence:** `plan-v5.md:96,104` (§1.5: *"Hồ sơ máy đọc `state/tickets/<n>.json`, chỉ ghi qua `resources.mjs`"*), `plan-v5.md:161` (§1.9: *"`scripts/comments.mjs` có hai lệnh, `fetch` (chỉ đọc) và `ack <ids>`"*).
- **Why it matters:** Both the dispatcher (renewing leases, updating `due`) and the coordinator (acking comments) write `state/tickets/<n>.json`. An unlocked read-modify-write inside `comments.mjs ack` races with `resources.mjs` and can clobber `due`, `state`, or `liveTask`.
- **Fix:** Either move `ack` into `resources.mjs` (`resources.mjs ack-comments <n> <ids...>`), or specify in Ticket B that `comments.mjs ack` imports and uses `resources.mjs`'s `mkdir`-locked ticket-update helper so every mutation of `state/tickets/<n>.json` shares one lock.

### 9. [medium] Watcher lock check (`plan-v5.md:58`) contradicts turn-1 failed-dispatcher recovery (`plan-v5.md:64`), and partial-claim adoption (`plan-v5.md:124`) can match old settled threads
- **Evidence:** `plan-v5.md:58` vs `plan-v5.md:64` (§1.3); `plan-v5.md:124` (§1.6).
- **Why it matters:**
  1. Line 58 says the watcher skips whenever the `dispatcher` lock is unexpired, contradicting line 64's rule to recover when *"lock quá hạn hoặc thread trong lock đã fail"* (needed to catch turn-1 `scout` quota failures before TTL expiry).
  2. Line 124 adopts any thread titled `factory #<n>` during partial-claim recovery, which can match an old settled/archived thread from an earlier `closed_unmerged` attempt on the same ticket, and leaves unspecified what happens when no matching thread exists (crash between writing `claimed` and calling `launch`).
- **Fix:**
  1. Align line 58 with line 64: when the `dispatcher` lock exists, skip only if it is unexpired **and** its recorded thread is still running/idle; otherwise run line 64's quota check and reclaim.
  2. In line 124, match only an unsettled, non-archived thread created at or after `claimedAt`; if none exists, clear the orphan claim (or proceed to launch).

### 10. [low] Human-merge PR hold (`To answer:` variant 3) does not specify clearing PR `ready-for-human` on reply/unhold
- **Evidence:** `plan-v5.md:215,220,226` (§1.13).
- **Why it matters:** Variant 3 says *"merge the pull request, or reply and remove `<ready-for-human>`"* without distinguishing the ticket label from the PR label. Removing `ready-for-human` only from the PR never triggers unhold (ticket still carries it); updating only the ticket leaves `ready-for-human` on the PR, keeping Merge guard line 4 (`plan-v5.md:226`) permanently blocked even if rework removes the protected-path edit.
- **Fix:** In variant 3, tell the person to merge the PR, or reply and unhold the ticket (using the ticket's standalone vs spec-child instruction); on unhold, have the coordinator remove `ready-for-human` from the PR before continuing (Land will re-apply it if a human merge is still required).

### 11. [low] All-candidates quota-blocked step lacks a dedicated `due` rule, causing 15-minute empty wakes during multi-hour quota blocks
- **Evidence:** `plan-v5.md:53,55` (§1.3); `plugins/software/skills/factory/PLAYBOOK.md:69,75`.
- **Why it matters:** When every candidate of a step's route is blocked in `quota.md` (e.g., a 24-hour weekly limit), keeping `due = now + Wake timeout` wakes the dispatcher and coordinator every 15 minutes for 24 hours; clearing `due` stalls the ticket after the quota expires because the dispatcher lifts `quota.md` without knowing which coordinator waited on that route.
- **Fix:** When a coordinator cannot start a step because every candidate of its route is blocked in `quota.md`, set the ticket's `due` to the earliest `blocked until` timestamp of that route instead of `now + Wake timeout`.

## Earlier fixes that fall short

Findings `T3`, `T5` (modulo the shared lock in **#8**), `T6`, `T9`, `T10`, and `T13`–`T16` are cleanly resolved in `plan-v5.md`. The following earlier fixes remain incomplete or introduced regressions:

- **T1 (`due` liveness):** Clearing `due` on `held`/`waiting`/`parked` and waking live coordinators on expired `due` are right, but rewriting §1.3/§1.4 accidentally dropped expired resource leases from `due` (contradicting Ticket B and §4, and deadlocking dead `parked` holders; see **#1**), and left all-candidates quota blocks without a matching `due` timestamp (see **#11**).
- **T2 (Land pre-gate & `PENDING` CI):** Adding Cổng trước Land and keeping `PENDING` CI out of Rework/Hold fixes the earlier bugs, but ordering red-trunk wait ahead of trunk-fix PRs deadlocks trunk fixes, red-trunk waiters have no wake mechanism, post-Step-3 red trunk and `Auto-merge: off` are still unchecked before trunk merge, and Step 5 `Unknown CI` leaks `merge` (see **#4**).
- **T4 (Caller-held `dispatcher` lock):** Moving lock acquisition to the launcher catches turn-1 `scout` quota crashes, but line 58 still contradicts line 64 on unexpired failed locks (see **#9**) and `INTERFACE.md` still lacks `launch-dispatcher` for `once`/`resume` (see **#6**).
- **T7 (`Close (closed_unmerged)` & push check):** Extending the push check to `refs/pull/<pr>/head` and sweeping from project root are right, but retrying a `closed_unmerged` ticket still breaks because `DISPATCHER.md` runs `claim` before `quét worktree` and `closed_unmerged` leaves the remote `factory/*` branch behind for the Reset Gate to halt on (see **#3**).
- **T8 (`pause`/`resume`/`run` state):** Having `run` write `running` fixes `stop -> run`, but `DISPATCHER.md` still ignores `paused` while a worker is live and `resume` fails to wake coordinators that paused mid-chain (see **#2**).
- **T11 (Three `To answer:` brief variants):** Separating standalone, spec-child, and human-merge briefs is right, modulo clarifying ticket vs PR label removal and coordinator clearing PR `ready-for-human` on unhold (see **#10**).
- **T12 (`wontfix`/closed cleanup & migration `factory:hold` removal):** Migration label cleanup is fixed, but `wontfix`/closed cleanup still omits waking the coordinator (leaving it pinned, unsettled, watching the PR, and its worktree unswept), skips non-`held` tickets in `DISPATCHER.md`, and omits clearing `flag-human`/stopping workers/releasing resources in the turn-start guard (see **#5**).

## Over-building

None. Round 3's simplifications (`T13`–`T16`) removed the remaining over-building; the remaining scripts (`resources.mjs`, `comments.mjs`) and document split in v5 are justified by atomicity, security, and progressive disclosure.
