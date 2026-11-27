# Review Round 9: Factory Coordinator-Per-Ticket Plan (v10)

## Verdict

approve with changes

Round 8's fixes (`Y1` and `Y2`) address the multi-waiter collision gap and the brief variant wording, and all `file:line` citations in `plan-v10.md` were re-verified against the repository with no broken repo rules or `cli/lib.mjs` violations. However, a full internal-consistency pass surfaced one high-severity blocking conflict introduced by earlier fixes `U5`/`V5`: on GitHub, every factory PR ends with `Closes #<n>` (`WORK-ORDERS.md:31`), so merging a held PR (protected path, trunk fix, `Auto-merge: off`, or manual merge) closes the ticket synchronously—causing both Dispatcher Step 2 (`§1.6:122`) and Coordinator start-of-turn (`§1.6:152`) to take the abandoned-ticket abort path instead of `§1.7` Close (skipping `## Handoff` and remote branch deletion). One low-severity ordering note also remains on `Y1` (`§1.10:211`).

## Blocking issues

### 1. [high] Closed-ticket abort path (`U5`/`V5`) intercepts GitHub's `Closes #<n>` auto-close on every human-merged PR, skipping `§1.7` Close (`## Handoff`, branch delete, and `flag-human` clear)
- **Evidence:** `plan-v10.md:122` (§1.6 Dispatcher Step 2, `[U5, V5]`), `plan-v10.md:152-157` (§1.6 Coordinator start-of-turn, `[T12, U5]`), `plan-v10.md:165-176` (§1.7 Close), `plan-v10.md:252` (§1.13 human-merge brief), `plan-v10.md:330` (§3 Ticket C #6 `DISPATCHER.md`); `plugins/software/skills/factory/WORK-ORDERS.md:31` (`Closes #<number>`); `plugins/software/skills/factory/PLAYBOOK.md:56,58`.
- **Why it breaks:** Under ordinary use (no failures required), every PR the factory opens ends with `Closes #<number>` (`WORK-ORDERS.md:31`). Whenever a person merges a PR on GitHub—every protected-path PR, every trunk-fix PR (`PLAYBOOK.md:56`), every `Auto-merge: off` PR, or any manual merge—GitHub synchronously closes issue `#<number>` at the moment of merge. That breaks `§1.7` Close in three ways:
  1. **Coordinator aborts before Close:** When `watch_pull_request` wakes the coordinator on merge, `§1.6:152` (*"Đầu mỗi turn: nếu ticket đã đóng, đã `wontfix`, hoặc không còn claim của thread này, coordinator tự dọn rồi settle"*) sees the ticket is closed and immediately aborts and settles—never reaching `§1.7` Close, never posting `## Handoff` (so downstream blocked tickets lose their handoff), and never deleting the remote branch.
  2. **Dispatcher releases claim and blocks Close/revive:** When the dispatcher runs on the merge fingerprint change (either racing ahead of `watch_pull_request`, or if the coordinator died while `held` or right after `gh pr merge`), Step 2 (`§1.6:122`: *"Ticket đã đóng hoặc `wontfix`, ở bất kỳ `state` nào: nhả claim và tài nguyên... Bước này chạy trước revive"*) sees the closed ticket, sets `claimed: false`, skips `revive` if dead, and wakes any live coordinator to abort—so even if the coordinator checked for a merged PR first, `"không còn claim của thread này"` (`§1.6:152`) still forces abort instead of Close.
  3. **Stale `flag-human` on Close from `held` (and missed merges on Jira/local):** When a person merges or closes a held PR directly (Brief variant 4, `§1.13:252`), the coordinator enters `§1.7` Close without going through unhold, but `§1.7:165-176` never calls `clear flag-human` before `settle`, leaving a pinned `⏸ #<n>` thread in the sidebar. Additionally, on Jira/local trackers (where GitHub merge does not close the ticket), if `watch_pull_request` misses a merge on a `held` PR, nothing in `DISPATCHER.md` wakes the held coordinator to run Close.
- **Fix:**
  1. **Dispatcher Step 2 (`§1.6:122`, `§3:330`):** Distinguish **abandoned/cancelled** from **merged PR awaiting Close**:
     - Treat a closed ticket as abandoned (release claim & resources, wake live coordinator to abort, skip revive) **only** when its PR is **not** `merged` (or `## Handoff` is already posted on the ticket).
     - When a claimed ticket's PR is `merged` and `## Handoff` is not yet posted (whether GitHub already closed the ticket via `Closes #<n>` or the ticket is still open/`held` on Jira/local): **keep the claim**; if the coordinator is alive and not already `running` with an active `due` (e.g., it was `held` with `due: null`), write `state: running` + `due = now + Wake timeout` and wake it so it completes `§1.7` Close; if the coordinator is dead, let Step 3 (`revive`) launch a replacement on `existing_worktree` to finish `§1.7` Close.
  2. **Coordinator start-of-turn (`§1.6:152`):** Check for a **merged PR without `## Handoff`** *before* checking `"ticket đã đóng"`. Take the abort-and-settle path only when the ticket is `wontfix`, closed *without* a merged PR (or already has `## Handoff`), or no longer claimed by this thread.
  3. **`§1.7` Close (`plan-v10.md:165-176`):** Add `clear flag-human` before `settle` in both the merged and `closed_unmerged` branches.
  4. **`§4` E2E verification:** Add a case where a person merges a held PR (protected path or trunk fix) whose body has `Closes #<n>`, verifying `## Handoff` is posted, remote branch deleted, `flag-human` cleared, and thread settled.

## Non-blocking issues

### 2. [low] `§1.10:211` (`[Y1]`) scopes `check-plan` after `"chưa push gì: git fetch … && git reset …"`
- **Evidence:** `plan-v10.md:211` (§1.10, `[Y1]`), `plan-v10.md:145` (§1.6 existing open PR).
- **Why it matters:** `§1.10:211` reads *"Hết chờ, chưa push gì: `git fetch origin && git reset --hard origin/<trunk>`, rồi **chạy lại `check-plan`** trước khi build."* That phrasing reads as gating `check-plan` on `"chưa push gì"` (which is false if a ticket claimed on an existing open PR without a plan in `§1.6:145`, or a rework `design` revision, entered collision `waiting` with `planCleared: false`), and in the common unpushed case it performs a redundant `git fetch && git reset` even when another woken waiter cleared first and `check-plan` immediately returns this ticket to `waiting`.
- **Fix:** Reorder `§1.10:211` to match `review-8.md:21-23`: *"Hết chờ collision (khi `planCleared` là `false`): **chạy lại `check-plan`** trước khi build (bỏ qua chính PR của ticket này nếu đã có); trùng lần nữa thì quay lại `waiting` (và xoá due). Chỉ khi đặt được `planCleared` mới đi tiếp: nếu chưa push gì thì `git fetch origin && git reset --hard origin/<trunk>`, rồi mới build."*

## Earlier fixes that fall short

- **U5 / V5 (closed/`wontfix` handling before `revive` in `§1.6:122,152`):** Treating every closed ticket in any state as abandoned without checking whether its PR was `merged` (and `## Handoff` posted) breaks `§1.7` Close on every human-merged PR on GitHub because `Closes #<n>` (`WORK-ORDERS.md:31`) closes the issue synchronously on merge (see **#1**).
- **Y1 (collision waiter re-running `check-plan` in `§1.10:211`):** Core behavior and test (`§4:394`) are in place; only the ordering relative to `"chưa push gì: git fetch && git reset"` should be flipped so `check-plan` runs first for any `planCleared: false` collision waiter (see **#2**).
- **Y2 (`§1.13:252`):** Cleanly resolved.

## Over-building

None.
