# Review Round 7: Factory Coordinator-Per-Ticket Plan (v8)

## Verdict

approve with changes

Every `file:line` citation in `plan-v8.md` (46 citations across the factory skill, `smode`, `triage`, `setup-software-context`, `docs/agents/`, `PLATFORMS.md`, and `README.md`) was verified against the repository and matches accurately. There are no blocking issues and no repo-rule violations. Round 6's `W1` (`Stop the line` ahead of claim and `Max tickets` exemption for the trunk-fix ticket), `W2` (split pre-wake writes for `held`/`waiting`/`running` vs `parked` queue heads), `W4` (`claimed && planCleared` collision filter, clearing `planCleared` on claim release, and pruning any closed/unclaimed blocker from `waitingOn`), and `W5` (Land Step 7 citing Gate 4 and covering Merge guard at both Step 2 and Step 6) are cleanly resolved. Two medium non-blocking issues remain: one gap in `W3`'s unhold path for manual PR holds (and standalone unhold on label trackers), and one internal inconsistency between `§1.7` Close and `§1.10`/`§1.6` over who wakes collision waiters.

## Blocking issues

None.

## Non-blocking issues

### 1. [medium] Unholding after a manual PR `ready-for-human` (`W3`) re-triggers Gate 1, and standalone `gỡ hold` on label trackers does not require `ready-for-human` to be removed
- **Evidence:** `plan-v8.md:79` (§1.4 Gate 1, `[W3]`), `plan-v8.md:249,251,253-254,256-257` (§1.13), `plan-v8.md:421` (§4 E2E test).
- **Why it matters:**
  1. When a maintainer manually adds `ready-for-human` to a running PR (the exact scenario in `plan-v8.md:421`), Gate 1 (`plan-v8.md:79`) performs a normal Hold on the ticket (mirroring `ready-for-human` onto the ticket and removing `ready-for-agent`) while leaving `ready-for-human` on the PR. Later, the maintainer replies and hands the ticket back as instructed (`"để bước gỡ hold chờ người trả ticket về"`), and dispatcher Step 4 wakes the coordinator. However, stripping `ready-for-human` from the PR on unhold (`[U10]`) is currently stated only inside the `"PR phải do người merge"` bullet (`plan-v8.md:251`, protected path / trunk fix). If implemented as scoped there, `ready-for-human` remains on the PR after unhold, so the next Land check immediately hits Gate 1 (`plan-v8.md:79`) and re-holds the ticket in a loop.
  2. On label trackers (GitHub/GitLab), `gỡ hold` for standalone tickets (`plan-v8.md:253`) only checks that the ticket carries `ready-for-agent`, unlike spec children (`plan-v8.md:254`) and Frontier (`plan-v8.md:256`) which also require `ready-for-human` (and `needs-*`/`wontfix`) to be absent. Because the `"To answer"` brief (`plan-v8.md:249`) says `"reply, then move it back to <ready-for-agent>"` without mentioning removing `<ready-for-human>`, a person who adds `ready-for-agent` on GitHub without unchecking `ready-for-human` triggers dispatcher Step 4 unhold, and Gate 1 (`plan-v8.md:79`) then silently re-holds the ticket (removing `ready-for-agent` again without posting a brief).
- **Fix:**
  1. Promote the `[U10]` PR-label cleanup out of the `"PR phải do người merge"` bullet (`plan-v8.md:251`) into the general unhold rule in `§1.13` / `COORDINATOR.md`: on **any** unhold, if the ticket's open PR carries `ready-for-human`, the coordinator removes `ready-for-human` from the PR before continuing (Land Gate 3 re-applies it if the PR still requires a human merge).
  2. In `§1.13:253`, require standalone tickets on label trackers to have `ready-for-agent`, no `ready-for-human`, and no `needs-*`/`wontfix` (matching Frontier at `plan-v8.md:256`), and in `§1.13:249` word the label-tracker brief as `"reply, then remove <ready-for-human> and add <ready-for-agent>"` (keeping `"move it back to <ready-for-agent>"` for Jira/local).

### 2. [medium] `§1.7` Close still instructs the closing coordinator to notify collision waiters, conflicting with `§1.10` / `§1.6` (`[V4, W2, W4]`) where the dispatcher owns `waitingOn` pruning and pre-wake state transitions
- **Evidence:** `plan-v8.md:167,174` (§1.7 Close: `"báo những người đang chờ ticket này"`, `"báo người chờ"`), vs `plan-v8.md:127-128` (§1.6 `[V4, W2]`), `plan-v8.md:210` (§1.10 `[W4]`), and `plan-v8.md:295-304` (§3 Ticket B `resources.mjs`).
- **Why it matters:** `§1.7:167,174` still reflects an older design where the closing coordinator directly wakes tickets waiting on it. Meanwhile `§1.10:210` allows multi-blocker `waitingOn` lists (including non-factory PRs) and assigns pruning `waitingOn` and waking emptied waiters to the dispatcher, `§1.6:127-128` requires atomically writing `state: running` + `due` under lock before waking a `waiting` ticket, and `§3 Ticket B` specifies no `waitingOn` pruning inside `resources.mjs` claim release. Implementing `§1.7:167,174` as written will either wake a multi-blocker waiter prematurely (while another blocker in `waitingOn` is still open) or wake a single-blocker waiter without updating its `state`/`waitingOn`, causing the next dispatcher run (triggered by the merge/close fingerprint change) to wake it a second time.
- **Fix:** Align `§1.7`, `§1.10`, and `§3 Ticket B` on a single owner:
  - **Simpler (recommended):** Remove `"báo những người đang chờ ticket này"` / `"báo người chờ"` from `§1.7:167,174` (releasing resources still wakes resource queue heads per `§1.4:97`), leaving all `waitingOn` pruning and collision-waiter wakes to dispatcher Step 5 (which already runs on the next tick because the merge/close changes the board fingerprint).
  - **Alternative (zero-delay wake):** If immediate wakeup on Close is desired, specify in `§1.7`, `§1.10`, and `§3 Ticket B` that `resources.mjs` claim release atomically removes `<n>` (and its PR) from every other ticket's `waitingOn`, transitions any waiter whose `waitingOn` becomes empty to `state: running` and `due = now + Wake timeout`, and returns those thread ids for the closing coordinator to wake, with dispatcher Step 5 as the safety net.

## Earlier fixes that fall short

Findings `W1`, `W2`, `W4`, and `W5` are cleanly resolved in `plan-v8.md`. One Round 6 fix is incomplete:

- **W3 (Gate 1 normal hold and mirroring `ready-for-human` from PR to ticket):** Transitioning `state` to `held`, clearing `due`, flagging human without duplicate briefs, and mirroring `ready-for-human` onto the ticket stop the 15-minute wake loop, but because stripping `ready-for-human` from the PR on unhold remains scoped only to human-merge holds (`plan-v8.md:251`), unholding a manually PR-labelled ticket leaves `ready-for-human` on the PR and immediately re-triggers Gate 1 (see **#1**).

## Over-building

None. Every change in v8 is minimal and directly addresses a concrete failure mode.
