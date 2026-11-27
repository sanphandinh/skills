# Review Round 5: Factory Coordinator-Per-Ticket Plan (v6)

## Verdict

approve with changes

Every `file:line` citation in `plan-v6.md` was verified against the repository and matches accurately. Plan v6 cleanly resolves Round 4's expired resource leases as a `due` source (`U1`), `launch-dispatcher` in `INTERFACE.md` (`U6`), the `origin/<branch>..HEAD` Reset Gate (`U7`), locked `comments.mjs ack` (`U8`), watcher lock & partial-claim matching (`U9`), and human-merge brief variant 3 + PR label removal on unhold (`U10`). Two blocking regressions/gaps remain from the `U2` and `U4` fixes, alongside three medium and two low non-blocking issues.

## Blocking issues

### 1. [high] Cổng trước Land runs policy/human-merge holds before `Required checks`, handing unbuilt or failing PRs to humans without waiting or reworking
- **Evidence:** `plan-v6.md:78-81` (§1.4, `[U4]`) vs `plugins/software/skills/factory/PLAYBOOK.md:55,85-89` and `docs/agents/merge-policy.md:10-14`.
- **Why it breaks:**
  1. When `verify` and `review` pass on a PR's head, GitHub Actions `Required checks` are routinely still `PENDING` or have already `FAILURE`d. Because Gate 1 (`Auto-merge: off`, `one-way`, disallowed blast radius, protected path, trunk-fix PR) runs **before** Gate 2 (`Required checks`), every trunk-fix PR, every protected-path PR, and every PR in a repo with `Auto-merge: off` is immediately put on hold and handed to a human to merge while CI is still running or actively failing—skipping both `PENDING` wait and `FAILURE` Rework.
  2. Gate 1 also holds `one-way` doors and disallowed blast radii unconditionally, conflicting with `PLAYBOOK.md:55` (once a person approves a `one-way` door or disallowed blast radius and unholds the ticket, the coordinator merges it rather than re-holding it in a loop).
  3. When Cổng trước Land re-runs after Step 3's `git fetch origin` (while `slot`, `scarce`, and `merge` are already held), Gate 2 says *"chưa xin `merge`"* without releasing those already-held resources before waiting or reworking.
- **Fix:** Reorder Cổng trước Land as:
  1. Ticket or PR already carries `ready-for-human`: stop (do not rework or merge).
  2. `Required checks` on head: `PENDING` → release any held resources, set `due`, wait for `watch-pr`; `FAILURE` → release any held resources and go to Rework; `Unknown CI` → release any held resources and post the Unknown CI brief.
  3. Policy/human-merge holds (`Auto-merge: off`, unapproved `one-way` door or disallowed blast radius, protected path, trunk-fix PR): hold immediately (which releases any held resources), without updating the branch or waiting on red trunk. (Trunk-fix PRs still precede Gate 4.)
  4. Trunk red: release all held resources, set `state: waiting`, `waitingOn: ["trunk"]`, wait. Also align Gate 4's wake note with `plan-v6.md:121,316` (woken in the dispatcher's waiter-wake step—not `Stop the line`—whenever trunk is no longer red, i.e., green, running, or unknown per `PLAYBOOK.md:89,96`).

### 2. [high] `factory stop` → `factory run` permanently stalls coordinators stopped mid-chain while paused, and `resume` omits clearing `notifiedAt` on resource queue heads
- **Evidence:** `plan-v6.md:147` (§1.6, `[U2]`), `plan-v6.md:199-203` (§1.11, `[T8]`), `plan-v6.md:57` (§1.3).
- **Why it breaks:**
  1. `factory stop` writes `paused` (`plan-v6.md:202`). If an in-flight worker finishes while `paused`, its coordinator handles `done`, stops mid-chain, and clears `due = null` (`plan-v6.md:147`). When the user later restarts the factory with `factory run` (`plan-v6.md:203`, the normal counterpart to `stop`), `run` writes `running` and schedules the watcher without running `resume`'s `due = now` reset. Because `due` is `null`, neither the watcher nor any later dispatcher tick wakes that coordinator—the ticket stays permanently stalled.
  2. `plan-v6.md:147` dropped clearing `notifiedAt` on resource queue heads during `resume` (requested in `review-4.md` #2). If a finishing worker released a resource and notified a `parked` queue head while `paused`, the head saw `paused` and slept without taking the resource; a `resume` within 5 minutes skips waking it on the immediate dispatcher run.
  3. Setting `due = now` unconditionally on *every* `running` ticket with no live worker would also prematurely wake tickets whose `due` is a future `blocked until` timestamp from an all-candidates quota block (`plan-v6.md:55`).
- **Fix:** Have `resources.mjs`'s transition to `running`—called by **both** `factory resume` and `factory run`—set `due = now` on every `running` ticket with no live worker **and `due == null`** (preserving future quota-block `due` timestamps), and clear `notifiedAt` on resource queue heads so the next dispatcher run wakes them immediately.

## Non-blocking issues

### 3. [medium] All-candidates quota exhaustion does not release held resources (`slot`, `scarce`, `merge`), starving other routes for up to 24 hours
- **Evidence:** `plan-v6.md:55` (§1.3, `[U11]`), `plan-v6.md:75-76,89-91` (§1.4); `plugins/software/skills/factory/PLAYBOOK.md:69,75`.
- **Why it matters:** When a worker fails with a usage limit during `Build`, `Check`, or Land Step 4/5 and every remaining candidate of that step's route is also blocked in `quota.md` (up to 24 hours on weekly allowances), the coordinator holds `slot`—and during Land Step 4/5, `slot + scarce + merge`. Neither §1.3:55 nor Land Step 7 (`plan-v6.md:91`) releases held resources on an all-candidates quota block. Because `resources.mjs` never auto-reclaims live coordinators and the dispatcher renews their leases, that ticket holds `slot`/`scarce`/`merge` for up to 24 hours, blocking all other tickets on unblocked routes (e.g., `plan` on `thinker`, `verify`/`review` on `reviewer`, or fast-path `merge`).
- **Fix:** Specify in §1.3:55 and §1.4:91 that whenever a step cannot start or restart because every candidate of its route is blocked in `quota.md`, the coordinator releases all held resources (`slot`, `scarce`, `merge`) before setting `due = earliest blocked until` and ending its turn (and checks route availability before acquiring resources).

### 4. [medium] `gỡ hold` does not flip `state: held → running` before Step 7 `claim`, allowing `Max tickets` overshoot and duplicate unhold wakes
- **Evidence:** `plan-v6.md:120,123,126` (§1.6), `plan-v6.md:314,318` (Step 6 `DISPATCHER.md`).
- **Why it matters:** `DISPATCHER.md` orders `gỡ hold` before `claim mới` so unheld tickets count against `Max tickets` before new claims, yet `Max tickets` counts only `running`, `parked`, and `waiting` (`plan-v6.md:126`). Because the woken coordinator runs asynchronously in another thread, leaving `state` as `held` during `gỡ hold` means Step 7 in the same dispatcher turn still sees the ticket as `held` and can claim past `Max tickets`; another dispatcher run before the coordinator updates `state` can also send a duplicate unhold wake.
- **Fix:** In `DISPATCHER.md`'s `gỡ hold` step, atomically update `state: running` and `due = now + Wake timeout` in `state/tickets/<n>.json` via `resources.mjs` before calling `send` to wake the coordinator (and likewise when waking a `waiting` coordinator whose blocker/trunk cleared, set `state: running`, clear `waitingOn`, and set `due = now + Wake timeout` before `send`).

### 5. [medium] `Quét worktree` omits open `wontfix` tickets, and `DISPATCHER.md` runs `revive` before `closed`/`wontfix`
- **Evidence:** `plan-v6.md:118-119` (§1.6, `[U5]`), `plan-v6.md:212` (§1.12), `plan-v6.md:312-313` (Step 6 `DISPATCHER.md`).
- **Why it matters:**
  1. Under `U5`, when a human adds `wontfix` without closing the issue, the dispatcher releases the claim and wakes the coordinator to settle. However, `Quét worktree` (`plan-v6.md:212`) only sweeps worktrees with *"ticket đã đóng, `closed_unmerged` hoặc PR đã merge"*, so an open `wontfix` ticket's worktree and local branch are never swept.
  2. Running `revive` (`plan-v6.md:118,312`) before `closed`/`wontfix` (`plan-v6.md:119,313`) needlessly launches a new coordinator on `existing_worktree` if a ticket's coordinator died and the ticket was then closed/`wontfix`'d, only to release and wake it to settle in the next step.
- **Fix:**
  1. Have `Quét worktree` (`plan-v6.md:212`) sweep any factory-tracked worktree whose claim is released (`claimed: false` — covering closed, `wontfix`, `closed_unmerged`, and merged PRs), whose thread is settled, and that passes the push check.
  2. Move `ticket đã đóng hoặc wontfix` ahead of `revive` in §1.6 and `DISPATCHER.md`, sending the cleanup wake only if the coordinator thread is still alive (otherwise stop any leftover worker, release claim/resources, and let `Quét worktree` sweep it).

### 6. [low] `GLOSSARY.md` still defines `Hold` with `factory:hold`, forbids `park`, and describes the single long-lived coordinator
- **Evidence:** `plan-v6.md:270,354-358` (§3 Steps 13–14); `GLOSSARY.md:3,8,28,36-37`.
- **Why it matters:** `GLOSSARY.md` is read by agents working in this repository (`AGENTS.md`, `triage`, `plan-ticket`, `code-review`). Line 36 still cites `factory:hold`, line 37 says `_Avoid_: block, park` (contradicting §3's leading word *park*), and lines 3, 8, and 28 describe the old single-coordinator ten-operation design. (This repo's `docs/agents/factory.md:6` also still carries `Coordinator:`.)
- **Fix:** Add `GLOSSARY.md` to Step 14 (Ticket D): update **Hold** (`ready-for-human` + brief, drop `park` from `_Avoid_`), add **Park** and **Dispatcher**, and update **Coordinator** and **Interface**; note updating `docs/agents/factory.md` after Ticket D.

### 7. [low] `closed_unmerged` retry branch suffix `-2` is tied to non-`factory/*` branches instead of checking remote branch existence
- **Evidence:** `plan-v6.md:134` (§1.6), `plan-v6.md:160` (§1.7, `[U3]`).
- **Why it matters:** Line 160 ties the `-2` suffix to non-`factory/*` branches (even though `factory/<n>-<slug>` was never used on a non-`factory/*` PR), while line 134 does not check whether `origin/factory/<n>-<slug>` still exists (e.g., if remote deletion failed or a second retry occurs), which would hit the Reset Gate.
- **Fix:** In §1.6:134, when launching a new branch from `origin/<trunk>`, check `git ls-remote origin` for `factory/<n>-<slug>` and pick the first unused suffix (`-2`, `-3`, …) if taken; simplify §1.7:160 accordingly.

## Earlier fixes that fall short

Findings `U1`, `U6`, `U7`, `U8`, `U9`, and `U10` are cleanly resolved in `plan-v6.md`. The following Round 4 fixes remain incomplete or introduced regressions:

- **U2 (`pause`/`resume`/`run` state):** Adding the `paused` guard to `DISPATCHER.md` and clearing `due` on paused coordinators are right, but `factory run` does not share `resume`'s wake-up of idle `running` tickets (stalling `stop → run`) and `resume` dropped clearing `notifiedAt` on resource queue heads (see **#2**).
- **U3 (`closed_unmerged` retry):** Moving `quét worktree` before `claim`, deleting local branches in `close-workspace`, and deleting remote `factory/*` branches are right, modulo tying the `-2` branch suffix to non-`factory/*` branches instead of checking remote existence at launch (see **#7**).
- **U4 (Cổng trước Land & red-trunk waiters):** Adding `waitingOn: [trunk]`, re-checking after Step 3's fetch, and releasing `merge` on `Unknown CI` are right, but placing policy/human-merge holds ahead of `Required checks` skips waiting on `PENDING` CI and reworking `FAILURE` CI on trunk-fix PRs, protected-path PRs, and `Auto-merge: off` repos (see **#1**).
- **U5 (`wontfix`/closed cleanup):** Handling all states, waking the coordinator, and expanding the turn-start shutdown guard are right, but `Quét worktree` still omits open `wontfix` tickets and `revive` runs before `closed`/`wontfix` (see **#5**).
- **U11 (All-candidates quota-blocked `due`):** Setting `due` to the earliest `blocked until` stops 15-minute empty wakes, but omitting resource release leaks `slot`/`scarce`/`merge` for up to 24 hours when quota runs out mid-step or mid-Land (see **#3**).

## Over-building

None. Every addition in v6 addresses a concrete failure mode with minimal mechanism.
