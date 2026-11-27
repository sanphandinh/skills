# Review Round 6: Factory Coordinator-Per-Ticket Plan (v7)

## Verdict

approve with changes

Every `file:line` citation in `plan-v7.md` was verified against the repository and matches accurately. Round 5's `V2` (`run`/`resume` transition to `running` and clearing `notifiedAt`), `V3` (releasing resources on all-candidates quota block), `V5` (`closed`/`wontfix` ahead of `revive` and sweeping by `claimed: false`), `V6` (`GLOSSARY.md` and `docs/agents/factory.md`), and `V7` (`git ls-remote origin` branch-suffix selection) are cleanly resolved. One blocking deadlock remains around `Max tickets` and trunk-fix tickets when trunk turns red, alongside three medium and one low non-blocking issues (two from incomplete parts of `V1` and `V4`).

## Blocking issues

### 1. [high] Trunk-fix deadlock: `Max tickets` counts `waitingOn: ["trunk"]` tickets and `DISPATCHER.md` runs `claim` before `Stop the line`
- **Evidence:** `plan-v7.md:85` (§1.4 Gate 4), `plan-v7.md:132` (§1.6), `plan-v7.md:328-329` (§3 Step 6 `DISPATCHER.md`); `plugins/software/skills/factory/PLAYBOOK.md:14,95,128`.
- **Why it breaks:**
  1. When trunk CI turns red while the factory is already running at `Max tickets` (for example `Max tickets: 1`, the default for `Max workers: 1` used in §4:394, or any full concurrency slot), every in-flight ticket reaches Land Gate 4, releases its worker slots, and transitions to `state: waiting`, `waitingOn: ["trunk"]`. Because `Max tickets` counts `running`, `parked`, **and `waiting`** (`plan-v7.md:132`), `active == Max tickets` remains full even though all worker slots are idle. When `Stop the line` opens the trunk-fix ticket (`Fix trunk: ...`), Step 7 (`Claim mới`) refuses to claim it because `Max tickets` is full. None of the waiting tickets can merge until trunk is fixed, and the fix ticket cannot be claimed while those tickets occupy `Max tickets` — deadlocking the factory until a human intervenes.
  2. Even when a `Max tickets` slot is free at the moment trunk turns red (after rerun), `DISPATCHER.md` (`plan-v7.md:328-329`) runs `claim và launch` **before** `Stop the line`. An ordinary frontier ticket claims the open slot before the fix ticket is even filed — violating `PLAYBOOK.md:14,128` ("apply Stop the line, then move the tickets ... fix tickets first") and walking straight into the same deadlock when it fills the last slot.
- **Fix:**
  1. Move `Stop the line` ahead of `claim và launch` in `DISPATCHER.md` (`plan-v7.md:328-329`, matching `PLAYBOOK.md:14`; still skipped while `paused` per `plan-v7.md:131`).
  2. Exempt the trunk-fix ticket (at most one is open at a time per `PLAYBOOK.md:95`) from the `Max tickets` cap in §1.6:132 so it is always claimed even when `Max tickets` is full of tickets waiting on red trunk.

## Non-blocking issues

### 2. [medium] Dispatcher Step 5's pre-wake state write breaks `parked` resource queue heads and leaves `notifiedAt` stale
- **Evidence:** `plan-v7.md:57` (§1.3), `plan-v7.md:125-127` (§1.6, `[V4]`), `plan-v7.md:155` (§1.6, `[V2]`), `plan-v7.md:324-326` (§3 Step 6 `DISPATCHER.md`).
- **Why it matters:**
  1. `plan-v7.md:127` specifies a single pre-wake update (`state = running`, clear `waitingOn`, `due = now + Wake timeout`) for every wake in Steps 4 and 5. Step 5 wakes `waiting` tickets (collision/trunk cleared), `running` tickets with expired `due`, **and `parked` resource queue heads** (`due` source #5, `plan-v7.md:57`, including immediately after `resume`/`run` clears `notifiedAt` per `plan-v7.md:155`).
  2. Applying that write to a `parked` queue head flips `state` to `running` while the ticket is still parked in `queue[0]` (only the coordinator calls `acquire`) and leaves `queue[0].notifiedAt` unset or stale (> 5 min). Until the woken coordinator calls `acquire`, `resources.mjs due` source #5 stays triggered on any subsequent dispatcher run and sends duplicate wakes.
  3. For a `waiting` ticket with multiple blockers in `waitingOn` (`plan-v7.md:205`), Step 5 should clear only resolved blockers and flip to `running` + wake only once `waitingOn` is empty.
- **Fix:** Split the pre-wake updates in §1.6:125-127 and §3 Step 6 (`plan-v7.md:326`):
  - For `held` (Step 4), `waiting` whose `waitingOn` is now empty (removing resolved blockers first), and `running` with expired `due`: atomically set `state: running`, clear `waitingOn`, and set `due = now + Wake timeout` before `send`.
  - For a `parked` resource queue head (`due` source #5): atomically set `queue[0].notifiedAt = now` (leaving `state: parked` and `due: null` until the coordinator acquires the resource) before `send`.

### 3. [medium] Cổng trước Land Gate 1 (`ready-for-human` present → stop) leaves `state: running` and `due` active, causing a 15-minute wake loop
- **Evidence:** `plan-v7.md:53-54` (§1.3), `plan-v7.md:78-79` (§1.4, `[V1]`), `plan-v7.md:248-249` (§1.13).
- **Why it matters:** When a maintainer manually applies `ready-for-human` to a `running` ticket (or its PR) to hold it before merge, Gate 1 (`plan-v7.md:79`) releases held resources and stops without moving `state` from `running` to `held`. Because `due` is only cleared on `held`/`waiting`/`parked`/Close (`plan-v7.md:54`), `due` remains `now + Wake timeout`, so the dispatcher wakes the coordinator every 15 minutes indefinitely. Furthermore, if the maintainer applied `ready-for-human` only to the PR (not the ticket), merely setting `state: held` without adding `ready-for-human` to the ticket causes `gỡ hold` (`plan-v7.md:248-249`, which inspects only the ticket) to immediately unhold and re-wake it on the next dispatcher tick.
- **Fix:** In Gate 1 (`plan-v7.md:79`), after releasing held resources, set `state: held` (which clears `due = null`) and `flag-human` (without posting a duplicate brief if one already exists); if only the PR carries `ready-for-human` while the ticket does not, also apply `ready-for-human` to the ticket (normal Hold) so `gỡ hold` waits until a person hands the ticket back.

### 4. [medium] `check-plan` compares against `planCleared` tickets without requiring `claimed: true`, causing false collisions with released tickets
- **Evidence:** `plan-v7.md:105,110` (§1.5), `plan-v7.md:200-201,205` (§1.10).
- **Why it matters:** `plan-v7.md:110` decouples `planCleared` from `state` so `parked` and `held` tickets still participate in collision checks, and `plan-v7.md:201` checks against *"các PR đang mở và các ticket có `planCleared`"*. Neither claim release (`Close`, `wontfix`) clears `planCleared` nor does `plan-v7.md:201` filter on `claimed: true`. Any released ticket (`claimed: false`: merged, `closed_unmerged`, or `wontfix`) whose `state/tickets/<n>.json` still exists on disk continues to block later tickets touching those files. Relatedly, `plan-v7.md:205` only says the dispatcher wakes collision waiters when their blocker *"đã merge"*, missing blockers closed without merge or marked `wontfix`.
- **Fix:** Specify in §1.5 / §1.10 (and Ticket B) that releasing a claim clears `planCleared` and `check-plan` compares only against tickets with `claimed: true && planCleared: true`; in §1.10:205, specify that the dispatcher clears a collision blocker from `waitingOn` whenever that PR or ticket is no longer open/claimed (merged, closed, or `claimed: false`).

### 5. [low] Land Step 7 still refers to red trunk as `"cổng 3"` (now Gate 4 after V1) and omits Step 2's fast-path Merge guard
- **Evidence:** `plan-v7.md:84-85,88,95` (§1.4, `[V1]`).
- **Why it matters:** `V1` moved red trunk from Gate 3 to Gate 4 (`plan-v7.md:85`) and made Gate 3 policy holds (`plan-v7.md:84`), but Land Step 7 (`plan-v7.md:95`) still reads *"Riêng trunk đỏ ở bước 6 thì nhả hết và chờ trunk như cổng 3"*. In addition, Step 2 (`plan-v7.md:88`, the fast path) also runs Merge guard where trunk can turn red after Cổng trước Land; Step 7 should apply the red-trunk wait to both Step 2 and Step 6 rather than treating a fast-path red trunk as Rework/Hold.
- **Fix:** Change `plan-v7.md:95` to `"Riêng trunk đỏ khi kiểm Merge guard (bước 2 hoặc bước 6) thì nhả hết và chờ trunk như cổng 4, không Rework, không Hold."`

## Earlier fixes that fall short

Findings `V2`, `V3`, `V5`, `V6`, and `V7` are cleanly resolved in `plan-v7.md`. Two Round 5 fixes are incomplete:

- **V1 (Cổng trước Land reorder):** Reordering `Required checks` ahead of policy holds, releasing held resources on every exit, respecting approved one-way/blast-radius merges, and aligning red-trunk wakes are all right, but Gate 1 stops without transitioning `state` to `held` / clearing `due` (causing a 15-minute wake loop when a human manually labels an in-flight ticket/PR `ready-for-human`; see **#3**), and Land Step 7 still cites `"cổng 3"` instead of `"cổng 4"` (see **#5**).
- **V4 (Pre-wake state update in `DISPATCHER.md`):** Atomically setting `state: running` and `due = now + Wake timeout` before waking `held` or `waiting` tickets fixes `Max tickets` overshoot and duplicate unhold wakes, but applying that same write across all of Step 5 mishandles `parked` resource queue heads (`due` source #5), leaving `notifiedAt` unset/stale and `state: running` while still in `queue[0]` (see **#2**).

## Over-building

None. Every change in v7 addresses a concrete failure mode with minimal mechanism.
