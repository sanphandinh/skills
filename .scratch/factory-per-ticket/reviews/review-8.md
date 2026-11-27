# Review Round 8: Factory Coordinator-Per-Ticket Plan (v9)

## Verdict

approve with changes

Round 7's fixes (`X1` and `X2`) are cleanly integrated and consistent with the rest of `plan-v9.md`: removing `ready-for-human` from the PR is now a general unhold rule (`§1.13:253`), standalone unhold on label trackers matches Frontier (`§1.13:255`), the label-tracker brief explicitly instructs removing `ready-for-human` and adding `ready-for-agent` (`§1.13:249`), and `§1.7` Close delegates all collision-waiter wakeup to dispatcher Step 5 (`§1.7:167,174`). All 43 `file:line` citations in `plan-v9.md` were re-verified against the repository and match accurately, and no repo rules or validator checks (`cli/lib.mjs`) are broken. One medium internal-consistency issue remains in `§1.10` Collision: a ticket waking from a collision wait never re-runs `check-plan`, so `planCleared` stays `false` throughout Build and multiple waiters woken from the same blocker can build overlapping files concurrently.

## Blocking issues

None.

## Non-blocking issues

### 1. [medium] Collision waiters waking from `waiting` skip `check-plan`, leaving `planCleared: false` during Build and allowing concurrent colliding builds
- **Evidence:** `plan-v9.md:105,110` (§1.5), `plan-v9.md:127-128` (§1.6), `plan-v9.md:205-211` (§1.10), `plan-v9.md:304` (§3 Ticket B), `plan-v9.md:393` (§4 tests).
- **Why it matters:** When `resources.mjs check-plan` detects an overlap (`plan-v9.md:208`), it sets `state: waiting` and `waitingOn`, leaving `planCleared` as `false`. When the blocker finishes and dispatcher Step 5 empties `waitingOn` (`plan-v9.md:128,210`), the dispatcher sets `state: running`, clears `waitingOn`, sets `due`, and wakes the coordinator—still with `planCleared: false`. `§1.10:211` then tells the woken coordinator to go straight to Build (`"Hết chờ, chưa push gì: git fetch origin && git reset --hard origin/<trunk>, rồi mới build"`) without re-running `check-plan`. Under ordinary use this breaks collision protection in three cases:
  1. **Single waiter:** the woken ticket runs Build with `planCleared: false`. Because `check-plan` compares only against open PRs and tickets with `claimed && planCleared` (`plan-v9.md:206`), any new ticket planning on the same files before the woken ticket opens its PR clears immediately and builds concurrently.
  2. **Two waiters on the same blocker:** if tickets B and C both waited on ticket A (overlapping on the same file), dispatcher Step 5 empties `waitingOn` and wakes both B and C in the same run; neither re-runs `check-plan`, so both build overlapping files concurrently.
  3. **Human PR opened while waiting:** if a human opened a PR touching the same files while ticket B waited on A, dispatcher Step 5 only checks A's closure/unclaim and wakes B straight into Build against the human PR's files.
- **Fix:** In `§1.10:211` (and `COORDINATOR.md`), require the coordinator to run `resources.mjs check-plan` again before starting Build whenever `planCleared` is still `false` (including when waking from a collision wait; red-trunk waiters already have `planCleared: true` and an open PR):
  - if clear, `check-plan` atomically sets `planCleared: true`, and the coordinator runs `git fetch origin && git reset --hard origin/<trunk>` (when nothing is pushed yet) before starting Build;
  - if another woken waiter cleared first or a new open PR now overlaps, `check-plan` returns the ticket to `state: waiting` (and clears `due`) with the new `waitingOn`.
  Add a `resources.mjs` test case in `§4:393` covering two waiters woken after their shared blocker releases its claim, verifying that the first sets `planCleared: true` and the second transitions back to `waiting` on the first.

### 2. [low] `§1.13:252` human-merge brief variant still says "two variants above" after `X1` split the variants into three
- **Evidence:** `plan-v9.md:248-252` (§1.13).
- **Why it matters:** `X1` split the first `"To answer"` bullet into label-tracker standalone (`:249`) and Jira/local (`:250`), leaving three variants above `:252`, but `:252` still refers to `"(theo một trong hai biến thể trên)"`.
- **Fix:** Change `"hai biến thể trên"` to `"ba biến thể trên"` in `plan-v9.md:252`.

## Earlier fixes that fall short

None. Round 7's `X1` and `X2` are both implemented completely and consistently (aside from the minor count wording in **#2**).

## Over-building

None.
