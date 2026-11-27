# Review Round 11: Factory Coordinator-Per-Ticket Plan (v12)

## Verdict

approve

Nothing in `plan-v12.md` meets the bar for blocking or medium-severity rework. All three round-10 findings (`[AA1]`, `[AA2]`, `[AA3]`) are resolved completely and consistently across `§1.6`, `§1.7`, `§1.10`, `§3`, and `§4`; all `file:line` citations in `plan-v12.md` were re-verified against the repository checkout with no mismatches; every repo rule in `AGENTS.md`, `cli/lib.mjs`, `docs/adr/0002-factory-coordinator-agent.md`, and `plugins/core/skills/writing-for-agents/SKILL.md` is respected; and a full end-to-end pass found no remaining internal contradictions or over-building. One low-severity implementation note is recorded below for Ticket C after Spike #4/#8.

## Blocking issues

None.

## Non-blocking issues

### 1. [low] Reviving a dead coordinator for a merged PR (`§1.6:122,150`) if T3's "after merging" cleanup already removed its worktree
- **Evidence:** `plan-v12.md:122` (§1.6 Dispatcher Step 2, *"coordinator đã chết thì revive để chạy Close"*), `plan-v12.md:150` (§1.6 Revive step 4, *"Launch coordinator mới trên `existing_worktree`"*), `plan-v12.md:173` (§1.7 Close, *"Mọi lệnh sau khi merge chạy bằng `gh -R <owner>/<repo>` từ memory folder"*), `plan-v12.md:278,282` (§2 Spike #4 and #8).
- **Why it matters:** If a coordinator died while `held` (or right after `gh pr merge`) and T3's "after merging" cleanup deletes the worktree as soon as the linked PR merges (tested in Spike #4/#8), reviving via `existing_worktree` would fail because the path no longer exists—even though merged Close (`§1.7:169-173`) runs `gh -R <owner>/<repo>` from the memory folder and needs no worktree.
- **Fix:** When writing `DISPATCHER.md` in Ticket C (guided by Spike #4/#8 results), note that if Step 2 needs to revive a dead coordinator solely to finish merged Close and its worktree is already gone, either run the idempotent Close steps directly or launch the replacement at project root (no worktree needed).

## Earlier fixes that fall short

None. Round-10 fixes verified:
- **AA1 (`§1.6:122,127-131,152-160`, `§3:333`, `§4:430`):** Coordinator start-of-turn now checks claim ownership first (settle immediately if unclaimed or owned by another thread), then merged PR with idempotent `## Handoff`, then closed-without-merge/`wontfix` cleanup. Dispatcher Step 2 skips a live coordinator already `running` with an unexpired `due`, and otherwise writes `state: running` + `due` via `resources.mjs` before waking.
- **AA2 (`§1.7:171,179`):** Both the merged and `closed_unmerged` branches of `§1.7` Close now run `clear flag-human` before `settle`, matching `§4:430`.
- **AA3 (`§1.10:209`, `§3:307`, `§4:398`):** `check-plan <n>` now excludes ticket `<n>` itself and its own PR, with a unit test covering `design`-rework self-PR non-collision.

## Over-building

None.
