# Review Round 10: Factory Coordinator-Per-Ticket Plan (v11)

## Verdict

approve with changes

Round 9's core direction on `[Z1]` and `[Z2]` is right, every `file:line` citation in `plan-v11.md` (48 citations) and every `cli/lib.mjs` / `AGENTS.md` / `ADR-0002` rule was re-verified with no violations, and the rest of the plan is internally consistent with no over-building. However, `[Z1]` was applied incompletely in two places—creating a duplicate-Close / unguarded-wake race under ordinary use and leaving `clear flag-human` missing from `§1.7` even though `§4:426` tests for it—and `[Z2]` dropped the own-PR exclusion in `§1.10`, leaving a self-collision deadlock on `design`-finding rework or existing-open-PR claims.

## Blocking issues

### 1. [high] `[Z1]` turn-start check order and unguarded Dispatcher Step 2 wake cause duplicate Close / duplicate `## Handoff` under ordinary use
- **Evidence:** `plan-v11.md:122` (§1.6 Dispatcher Step 2, `[Z1]`), `plan-v11.md:127-130` (§1.6 pre-wake state write), `plan-v11.md:152-157` (§1.6 Coordinator start-of-turn, `[Z1]`), `plan-v11.md:330` (§3 Ticket C #6 `DISPATCHER.md`); `review-9.md:20-21`.
- **Why it breaks:**
  1. **Duplicate Close on ordinary merges:** On any human merge of a held PR (or any auto-merge coinciding with a watcher tick), `watch_pull_request` (or the coordinator's own `gh pr merge` turn) runs `§1.7` Close while the merge also flips the board fingerprint and launches a dispatcher. Because Dispatcher Step 2 (`§1.6:122`) unconditionally wakes the coordinator whenever the PR is merged (without checking whether it is already `running` with an unexpired `due`), Step 2 queues a `t3_thread_send` while Close is in flight. Once Close finishes, releases the claim (`claimed: false`), and settles, that queued message starts a new turn on the coordinator. At start-of-turn (`§1.6:152`), `"nếu PR của ticket đã merge thì chạy Close nhánh đã merge (mục 1.7)"` runs **before** `"không còn claim của thread này"` (and without checking whether `## Handoff` is already posted), so the coordinator runs `§1.7` Close a second time and posts a duplicate `## Handoff`.
  2. **Missing pre-wake state/due write on Step 2:** `§1.6:127` writes `state: running` + `due = now + Wake timeout` only for Steps 4 and 5, not Step 2. When Step 2 wakes a `held` coordinator (`due: null`) to run Close (for example on Jira/local, or if `watch_pull_request` missed the merge), `state` stays `held` and `due` stays `null`: if Close stalls, `resources.mjs due` will never fire, and on any unrelated board change Step 2 will wake it repeatedly.
- **Fix:**
  1. **Coordinator start-of-turn (`§1.6:152`):** Check claim ownership **first**:
     - If `!claimed` or `thread != this thread`: abort & settle immediately (do not run Close, and do not release another thread's claim/resources).
     - Else if the PR is `merged`: run `§1.7` Close (merged branch) — idempotently skipping `## Handoff` if already posted on the ticket — even when GitHub auto-closed the ticket via `Closes #<n>`.
     - Else if the ticket is closed or `wontfix`: run the abandon cleanup (`stop-worker`, release resources, `clear flag-human`, `unwatch-pr`, `settle`).
  2. **Dispatcher Step 2 (`§1.6:122`, `§1.6:127-130`, `§3:330`):** When a claimed ticket's PR is `merged` and its coordinator is alive, wake it **only** if it is not already `running` with an unexpired `due` (e.g., it is `held`/`waiting`/`parked` with `due: null`, or `running` with an expired `due`), and extend `§1.6:127` so Step 2 writes `state: running` + `due = now + Wake timeout` via `resources.mjs` before sending the wake.

### 2. [medium] `[Z1]` omitted `clear flag-human` from both branches of `§1.7` Close, contradicting `§4:426`
- **Evidence:** `plan-v11.md:165-168` (§1.7 merged Close), `plan-v11.md:171-176` (§1.7 `closed_unmerged` Close), `plan-v11.md:155` (§1.6 abort cleanup), `plan-v11.md:225-226` (§1.12 `flag-human`), `plan-v11.md:426` (§4 E2E check: *"Close nhánh đã merge vẫn chạy (handoff, xoá nhánh, clear flag-human)"*); `review-9.md:22`.
- **Why it breaks:** Every protected-path PR, trunk-fix PR, and `Auto-merge: off` PR is `held` (pinned and renamed `⏸ #<n>`, `§1.12:225`) when a person merges or closes it directly. Because those transitions enter `§1.7` Close without passing through unhold, omitting `clear flag-human` in `§1.7` leaves the settled coordinator thread permanently pinned as `⏸ #<n>` in T3's sidebar (and on `closed_unmerged`, leaves the old dead thread pinned even after a new coordinator claims the retry). `§4:426` explicitly expects `clear flag-human` during merged Close, while `§1.7` does not specify it.
- **Fix:** Add `clear flag-human` before `settle` in both branches of `§1.7`:
  - `§1.7:168`: `clear flag-human, unwatch, rồi settle.`
  - `§1.7:176`: `ghi closed_unmerged, clear flag-human, rồi settle.`

## Non-blocking issues

### 3. [medium] `§1.10` `check-plan` does not exclude the ticket's own PR (and own prior `planCleared`), causing self-collision on `design`-finding rework or existing-PR claims
- **Evidence:** `plan-v11.md:205-211` (§1.10 Collision, `[Y1, Z2]`), `plan-v11.md:145` (§1.6 existing open PR), `plan-v11.md:304` (§3 Ticket B #1 `check-plan`); `plugins/software/skills/factory/PLAYBOOK.md:32,51`; `review-9.md:30`.
- **Why it matters:** Under ordinary use, `check-plan` runs when a ticket already has an open PR in two cases: (a) a rework round with a `design` finding runs a revised `plan` worker (`PLAYBOOK.md:51`), and (b) a ticket claimed on an existing open PR without a `## Factory plan` (`§1.6:145`, `PLAYBOOK.md:32`) runs `plan` first. Because `§1.10:206` compares against all `--open-prs` and all `claimed && planCleared` tickets without excluding ticket `<n>` itself and ticket `<n>`'s own PR, `check-plan` collides with the ticket's own PR, transitions to `waiting` on its own PR, clears `due`, and deadlocks. (`review-9.md:30` included *"bỏ qua chính PR của ticket này nếu đã có"* in its Z2 fix, which was dropped in `plan-v11.md:211`.)
- **Fix:** State in `§1.10:206` and `§3:304` that `check-plan <n>` ignores ticket `<n>` itself and ticket `<n>`'s own PR (if any), and add a unit test case for it in `§4`.

## Earlier fixes that fall short

- **Z1 (`§1.6:122,127,152`, `§1.7:168,176`, `§3:330`):** Distinguishing merged PRs from abandoned closed tickets is in place, but three parts of `review-9.md:18-22` were missed: (1) `§1.6:152` checks `"PR đã merge"` *before* `"không còn claim của thread này"` and without idempotency on `## Handoff`, (2) `§1.6:122` wakes a live coordinator unconditionally without the `running + unexpired due` guard or the `§1.6:127` pre-wake write, and (3) `§1.7:168,176` still lack `clear flag-human` before `settle` (see **#1** and **#2**).
- **Z2 (`§1.10:211`):** The `check-plan`-before-reset ordering is fixed cleanly, but the own-PR exclusion from `review-9.md:30` was dropped (see **#3**).

## Over-building

None.
