# Review Round 2: Factory Coordinator-Per-Ticket Plan (v3)

## Verdict

approve with changes

All `file:line` citations in `plan-v3.md` check out against the repository, the plan faithfully incorporates the brief and post-brief decisions (including dropping `factory:active` and replacing `factory:hold` with `ready-for-human`), and most Round-1 findings are cleanly resolved. However, seven blocking issues remain—chiefly in the `ready-for-human` hold/unhold lifecycle, the `Close` (closed without merge) path, the Land fast path, watcher liveness under multi-slot FIFO, `comments.mjs` filtering, and `triage/SKILL.md`—that must be resolved before writing specs/tickets or implementing.

## Blocking issues

### 1. [high] `ready-for-human` on both ticket and PR deadlocks unhold at Merge guard and fails on Jira/local PR hosts
- **Evidence:** `plan-v3.md:158-164` (§1.13), `plan-v3.md:237` (Step 9), `plugins/software/skills/setup-software-context/SKILL.md:140`, `plugins/software/skills/setup-software-context/issue-tracker-jira.md:7`, `plugins/software/skills/setup-software-context/issue-tracker-local.md:18`.
- **Why it breaks:**
  1. **Infinite hold loop after human answers:** On Hold, the coordinator sets `ready-for-human` on the ticket **and** adds `ready-for-human` to the PR (`plan-v3.md:158-159`). The brief's `To answer` line tells the person to restore the **ticket** (`plan-v3.md:161`), and the dispatcher wakes the coordinator when the **ticket** loses `ready-for-human` (`plan-v3.md:162`). Nobody removes `ready-for-human` from the **PR**. When the coordinator resumes and reaches `Land`, Merge guard line 4 (`plan-v3.md:164`: *"cả ticket lẫn PR đều không có `ready-for-human`"*) fails because `ready-for-human` is still on the PR—sending the ticket straight back into hold.
  2. **Missing label on GitHub PR host for Jira/local trackers:** For Jira and local-markdown trackers, `setup-software-context` does not create triage labels on GitHub (`setup-software-context/SKILL.md:140`), and `plan-v3.md:237` only checks labels on the *tracker*. Calling `gh pr edit --add-label <ready-for-human>` fails when the PR host lacks that label (or when `triage-labels.md` maps `ready-for-human` to a custom string).
- **Fix:**
  1. Record in `tickets/<n>.json` whether the factory itself applied `ready-for-human` to the PR (and why: e.g., `holdReason: "protected-path" | "trunk-fix"` vs decision/rework hold). When the coordinator is woken from a non-human-merge hold, have it remove `ready-for-human` from the PR before continuing (while keeping `ready-for-human` on the PR for protected-path/trunk-fix holds that a person must merge, per `PLAYBOOK.md:56`). If a person manually added `ready-for-human` to the PR while the ticket was *not* held, Merge guard still blocks and triggers a hold.
  2. In `SETUP.md` (Step 9), verify/create the mapped `ready-for-human` label from `docs/agents/triage-labels.md` on the **PR host** (GitHub/GitLab) as well as on label-based trackers.

### 2. [high] Unhold condition falsely resumes `needs-info`/`needs-triage`/`wontfix` tickets, and `Max tickets` vs `held` + dispatcher order causes starvation
- **Evidence:** `plan-v3.md:32` (§1.1), `plan-v3.md:94` (§1.6), `plan-v3.md:161-162` (§1.13), `plan-v3.md:220` (Step 6).
- **Why it breaks:**
  1. **False unhold:** `plan-v3.md:162` defines unhold as *"ticket mà hồ sơ trong memory ghi `held` không còn `ready-for-human`"*. If a person moves a held ticket from `ready-for-human` to `needs-info`, `needs-triage`, or `wontfix` (especially on single-status trackers like Jira/local, or via `triage`), or removes `ready-for-human` on a standalone ticket without restoring `ready-for-agent`, the dispatcher sees `ready-for-human` absent and wakes the coordinator to keep building it.
  2. **Factory freeze under `Max tickets`:** `plan-v3.md:19,94` sets `Max tickets` (default = `Max workers`) without specifying whether `held` tickets count against it. Under the end-to-end test setup (`Max workers: 1`, `plan-v3.md:263`), a single held ticket freezes the entire factory if `held` counts toward `Max tickets`. Conversely, Step 6 (`plan-v3.md:220`) orders `DISPATCHER.md` as `claim, launch, gỡ hold, revive`—claiming new tickets *before* unholding or reviving in-flight ones, which contradicts `Finish before start` (`plan-v3.md:32`).
- **Fix:**
  1. Tighten the unhold condition in `DISPATCHER.md`:
     - Standalone ticket (and Jira/local tickets): `ready-for-human` absent **and** `ready-for-agent` present (and none of `needs-triage`, `needs-info`, `wontfix`).
     - Spec child ticket on a label tracker: `ready-for-human` absent, none of `needs-triage`/`needs-info`/`wontfix` present, **and** parent spec is still open and approved.
     - If the ticket moved to `wontfix` or closed, clean up the coordinator/claim instead of waking it.
  2. State explicitly that `Max tickets` counts only active (non-`held`) claimed tickets (`running`, `parked`, `waiting`), that Hold keeps the claim lock while freeing the `Max tickets` slot, and reorder `DISPATCHER.md` to run `revive` → `gỡ hold` → wake waiters → `claim & launch` (honoring `Finish before start`).

### 3. [high] `Close` (PR closed without merge) sets `held` and `settle` together, contradicting §1.13 unhold (Round-1 R4 shortfall)
- **Evidence:** `plan-v3.md:105` (§1.7) vs `plan-v3.md:162` (§1.13), `plan-v3.md:140` (§1.12).
- **Why it breaks:** `plan-v3.md:105` says that when a PR is closed without merge, the coordinator holds the ticket (`ready-for-human` + brief), releases resources, notifies waiters, unwatches the PR, **and calls `settle`**, without releasing the claim lock or closing the worktree. Under §1.13 (`plan-v3.md:162`), when the person later replies "retry" and returns the ticket to `ready-for-agent`, the dispatcher tries to wake the **settled** coordinator thread (which already unwatched the PR). Conversely, if the person closes the ticket and deletes the closed PR's remote branch, the stray worktree sweep (`plan-v3.md:140`) fails its push check (`origin/<branch>` is gone while `origin/<trunk>..HEAD` is non-empty) and leaves the worktree orphaned.
- **Fix:** Pick one consistent lifecycle for "PR closed without merge" (recommended: **full release & settle**):
  - Post the brief asking whether to close or redo, set `ready-for-human`, release resources, notify collision waiters, unwatch PR, **release the claim lock**, set `tickets/<n>.json` status to `closed_unmerged` (not `held`, so the dispatcher does not try to `send` to a settled thread), remove the worktree (its commits live on the closed PR ref, or after checking `git status` is clean), and `settle`. If the person later moves the ticket back to `ready-for-agent`, the dispatcher claims it fresh with a new coordinator.

### 4. [high] Land fast path skips `git fetch origin`, allowing stale merges past trunk updates (Round-1 R3/R15 shortfall)
- **Evidence:** `plan-v3.md:67-69` (§1.4): *"1. Xin `merge`. 2. Nhánh đã chứa `origin/<trunk>` (`git merge-base --is-ancestor`) thì kiểm Merge guard, merge, rồi nhả."*
- **Why it breaks:** If Ticket #1 merges to trunk while Ticket #2 is waiting in the `merge` queue, Ticket #2's local ref `origin/<trunk>` is still at the old commit from its earlier `Check`. Running `git merge-base --is-ancestor origin/<trunk> HEAD` without first fetching `origin` returns `0` (ancestor) on the stale ref, so Ticket #2 takes the fast path and merges without updating from trunk or re-running `verify`/`review`—defeating the merge queue invariant.
- **Fix:** Require `git fetch origin` immediately after acquiring `merge` in Land Step 2, before evaluating `git merge-base --is-ancestor origin/<trunk> HEAD` (and before Step 4's trunk merge).

### 5. [high] Watcher `wake-fingerprint` write timing and Source-5 `due` condition break liveness and recreate empty wakes (Round-1 R1/R11 shortfall)
- **Evidence:** `plan-v3.md:57-60` (§1.3), `plan-v3.md:65` (§1.4), `plugins/software/skills/factory/references/t3.md:40`.
- **Why it breaks:**
  1. **Empty-wake storm under 2-slot head-of-line FIFO:** §1.3 Source 5 (`plan-v3.md:57`) treats a resource as immediately due whenever *"một tài nguyên còn chỗ trống mà hàng đợi vẫn có người"* (`free > 0 && queue.length > 0`). Under head-of-line FIFO blocking (`plan-v3.md:65`), if `Max workers: 3`, two tickets hold 1 slot each (`free = 1`), and the queue head requests `2` slots for Land, the head cannot be granted—yet Source 5 reports `due` on every 15-minute watcher tick, launching empty dispatchers until a slot frees. Likewise, with no short grant-ack grace window after `release`, a watcher tick seconds after handoff wakes a dispatcher while the woken coordinator is still starting its turn.
  2. **Dropped board changes on dispatcher failure or lock contention:** `plan-v3.md:58-60` keeps `wake-check.sh` comparing/writing `<memory>/wake-fingerprint` (as in `references/t3.md:40`). If `wake-check.sh` overwrites `wake-fingerprint` before the dispatcher runs, and either an existing `dispatcher` lock blocks launch or the launched dispatcher crashes on turn 1, the next watcher tick sees an unchanged fingerprint and exits `1` (`quiet`), permanently dropping that board change.
- **Fix:**
  1. Change Source 5 in `scripts/resources.mjs` to trigger only when `free >= queue[0].count` **and** either the queue head has not been notified yet or its short grant-ack deadline (e.g., `notifiedAt + 5 minutes`) has expired.
  2. Make `wake-check.sh` **read-only** on `<memory>/wake-fingerprint`: it prints/compares the live board hash against `<memory>/wake-fingerprint` (and checks `resources.mjs due`) without overwriting it, and exits `1` when an unexpired `dispatcher` lock is held. Have the **dispatcher** capture the board hash at the start of its board read and write `<memory>/wake-fingerprint` only as it finishes its run (just before releasing the `dispatcher` lock).

### 6. [high] `scripts/comments.mjs` lacks a baseline cutoff, collides across GitHub's three ID spaces, and drops comments on crash (Round-1 R5 shortfall)
- **Evidence:** `plan-v3.md:116-122` (§1.9), `plan-v3.md:204` (Step 2), `plan-v3.md:261` (§4).
- **Why it breaks:**
  1. **Historical comments fed as new commands:** `plan-v3.md:117-121` filters only by permission and `## Factory …` heading. Pre-claim maintainer comments on the issue (including `## Agent Brief`, `## Triage Notes`, or old discussion) have `admin`/`write` permission, are not headed `## Factory …`, and are absent from a fresh ticket's processed-ID list—so they are delivered to the coordinator as new human instructions.
  2. **ID-space collision:** GitHub issue comments (`/issues/<n>/comments`), PR reviews (`/pulls/<n>/reviews`), and PR inline review comments (`/pulls/<n>/comments`) have **independent** numeric ID sequences. Storing bare numeric IDs in `tickets/<n>.json` causes collisions that silently drop real comments.
  3. **Crash loss:** Recording processed IDs during the read step (`plan-v3.md:121`) loses human comments permanently if the coordinator crashes before acting on them. Also, `/collaborators/<login>/permission` returns HTTP 404 for bot accounts (`dependabot[bot]`, etc.); if unhandled, the script fails instead of treating bots as untrusted.
- **Fix:**
  1. Seed a `since` timestamp (claim time for issue comments; brief timestamp for hold answers) or snapshot existing issue comment IDs at claim time, and also exclude triage disclaimer comments (`> *This was generated by AI during triage.*`).
  2. Namespace IDs by endpoint: `issue:<id>`, `review:<id>`, `inline:<id>`.
  3. Split `comments.mjs` into read-only `fetch` and explicit `ack <ids>` (called only after the coordinator acts), and treat any non-200 HTTP response from `/collaborators/<login>/permission` as untrusted (covered by a unit test in `comments.test.mjs`).

### 7. [high] `triage/SKILL.md` directly contradicts using `ready-for-human` to hold PRs and issues
- **Evidence:** `plan-v3.md:159,164,166` (§1.13), `plugins/software/skills/triage/SKILL.md:37,40,46,81`.
- **Why it breaks:** `plan-v3.md:166` leaves `triage` as a tentative check (*"kiểm tra skill này ... Nếu skill vẫn coi như vậy, sửa câu tương ứng"*). Inspecting `plugins/software/skills/triage/SKILL.md` shows concrete contradictions already in place:
  - Line 40: *"`ready-for-human` means it's ready for a human to merge."* Using `ready-for-human` to hold a PR whose `Fix rounds` exhausted or whose `verify` failed directly inverts this meaning, inviting an agent or human running `triage` to treat a broken held PR as ready to merge.
  - Line 37 & 81: define `ready-for-human` exclusively as *"needs human implementation"* / *"why it can't be delegated"*.
  - Line 46: defines normal transitions only from `needs-triage` and instructs the agent to *"flag transitions that look unusual"*, which fires on factory holds (`ready-for-agent` → `ready-for-human` → `ready-for-agent`).
- **Fix:** Make updating `plugins/software/skills/triage/SKILL.md` (lines 37, 40, 46, 81) an explicit deliverable in Ticket D Step 13: broaden `ready-for-human` on issues and PRs to mean waiting on a person (to implement, to merge, or to answer a `## Factory brief` and hand back), note that a `## Factory brief` comment distinguishes a factory hold from a human-implementation or ready-to-merge item, and allow `ready-for-agent ↔ ready-for-human` transitions without flagging them as unusual.

## Non-blocking issues

### 8. [medium] Lease `reclaim` boundary between `resources.mjs` and `DISPATCHER.md` risks evicting healthy long-running workers (Round-1 R3 shortfall)
- **Evidence:** `plan-v3.md:66` (§1.4), `plan-v3.md:200` (Ticket B Step 1).
- **Why it matters:** A healthy `build` or `verify` worker commonly runs longer than `Wake timeout` (15 min), during which the coordinator gets no turn to renew its `slot`/`scarce` lease. `plan-v3.md:66` explicitly protects a live holder parked in a downstream queue, but does not protect a live holder whose child worker is actively running, nor clarify that `scripts/resources.mjs` (which has no T3 access) cannot determine thread liveness on its own. If `resources.mjs` auto-reclaims expired leases by clock alone, it will evict active workers.
- **Fix:** Specify in §1.4 and Ticket B that `resources.mjs` never auto-reclaims by clock: `resources.mjs due` reports expired holder leases to wake the dispatcher; `DISPATCHER.md` runs `inspect` on the coordinator and its live worker, renews the lease if the worker is active or the coordinator is parked within max park timeout, and calls `resources.mjs reclaim <ticket>` (releasing all of `<ticket>`'s resources atomically) only when the thread is dead/failed or past max park timeout.

### 9. [medium] Land Steps 4–7 omit diff-free conflict detection, sequential Check when `Max workers: 1`, and resource release on non-Check failures (Round-1 R3 shortfall)
- **Evidence:** `plan-v3.md:70-74` (§1.4), `plugins/software/skills/factory/PLAYBOOK.md:5`, `plugins/software/skills/smode/RESULTS.md:26-34`, `cli/lib.mjs:361-378`.
- **Why it matters:**
  1. Step 4 says *"Một worker `build` merge trunk vào nhánh. Nếu có conflict, tính thêm một vòng vào `Conflict rounds`."* Because the coordinator never reads diffs (`PLAYBOOK.md:5`) and `smode/RESULTS.md` has no `had_conflict` key (any unlisted `result's \`key\`` fails `npm run validate` per `cli/lib.mjs:372-374`), the coordinator has no way to tell whether the merge conflicted or to stop before spawning `build` when `Conflict rounds` is already at its limit.
  2. Step 5 says *"verify ‖ review"* unconditionally, even though Step 3 acquires only `1` slot when `Max workers: 1`.
  3. Step 7 only releases resources when *"bất kỳ bước check nào fail"*, omitting exits from Step 4 (conflict limit exceeded, `build` failed, or `build` returned `questions` for a protected-path/semantic conflict) and from Step 2/6 Merge guard failures (e.g., red trunk, one-way door hold).
- **Fix:**
  1. Before Step 4 spawns `build`, run read-only `git merge-tree --write-tree HEAD origin/<trunk>` (touches neither working tree nor diffs): exit `0` = clean trunk update (do not increment `Conflict rounds`); exit `1` = conflict (if `conflictRounds >= Conflict rounds`, release all resources and Hold without spawning `build`; else increment `conflictRounds` and send the conflict-resolution `build` work order).
  2. In Step 5, run `verify` and `review` sequentially when `Max workers == 1`.
  3. Broaden Step 7 so **any** non-merge exit across Steps 2–6 (Merge guard fail, Step 4 fail/question/limit, `verify` `FAIL` or repeated `UNVERIFIED`, `review` `fail`, `Required checks` fail/unknown) immediately releases `merge`, `scarce`, and `slot`.

### 10. [medium] Partial-claim crash window, missing `branch` on existing PRs, and missing quota handling for dead coordinators/dispatchers (Round-1 R4/R9/R14 shortfall)
- **Evidence:** `plan-v3.md:60` (§1.3), `plan-v3.md:89-96` (§1.6).
- **Why it matters:**
  1. **Duplicate coordinator on crash:** If a dispatcher crashes *after* Step 2 (`launch-coordinator`, `plan-v3.md:90`) and *before* Step 3 (`write threadId`, `plan-v3.md:91`), the next dispatcher sees a claim lock with no `threadId`, cleans up the claim (`plan-v3.md:93`), and launches a second live coordinator for the same ticket.
  2. **Existing PR checkout:** `plan-v3.md:95` sets `baseRef: origin/<pr_branch>` without also setting `branch: "<pr_branch>"` (so T3 creates a generated branch name instead of the PR's branch), and does not handle cross-repo fork PRs where `origin/<pr_branch>` does not exist.
  3. **Quota crash loop on coordinator/dispatcher:** Neither `DISPATCHER.md` (when reviving a dead coordinator) nor the watcher (when reclaiming an expired/dead `dispatcher` lock) checks the dead thread's `error` items for quota words and blocks that candidate in `quota.md`. A `coordinator` or `scout` quota error will therefore relaunch on the exact same exhausted candidate.
- **Fix:**
  1. Before deleting a partial claim (lock without `threadId`), list existing sessions matching the ticket title (`factory #<n>`) and adopt an existing thread if found (and pass a deterministic `clientRequestId` on launch). Also check `coordinator` route availability *before* writing the claim lock.
  2. For existing open PRs, pass both `baseRef: "origin/<pr_branch>"` and `branch: "<pr_branch>"`; if `origin/<pr_branch>` does not exist (fork PR), hold with a brief.
  3. On `revive` (in `DISPATCHER.md`) and on expired `dispatcher` lock reclaim (in the watcher), inspect the dead thread's `error` items and call `resources.mjs quota-block` when quota words match before picking the next candidate.

### 11. [medium] Memory multi-writer gaps: `<memory>/evidence/` unignored, two-writer races on `tickets/<n>.md` and `index.md`, and watcher ticks while paused (Round-1 R6/R19 shortfall)
- **Evidence:** `plan-v3.md:80-83` (§1.5), `plan-v3.md:114` (§1.8), `plan-v3.md:131-135` (§1.11), `plugins/software/skills/factory/MEMORY.md:7`.
- **Why it matters:**
  1. `<memory>/evidence/` (`plan-v3.md:114`) is omitted from `.gitignore` (`plan-v3.md:83`). Verifiers writing Playwright screenshots/traces there concurrently with dispatcher `git commit` will bloat the memory repo and trigger vanishing-file git errors.
  2. `plan-v3.md:80,82` has coordinators write un-ingested lessons into `tickets/<n>.md` while the dispatcher ingests them, without specifying how the dispatcher tracks what was already ingested without writing back to `tickets/<n>.md` (a two-writer race).
  3. `pause`/`resume`/`stop` (`plan-v3.md:131-135`) run from any user thread and mutate `Status:`, which currently lives in `index.md` (`MEMORY.md:7`) alongside dispatcher-written wiki index entries and lint dates. Also, if any `due` is expired while `Status: paused`, the watcher will spawn an empty dispatcher every 15 minutes unless `wake-check.sh` / `due` accounts for paused state.
- **Fix:**
  1. Add `evidence/` to `<memory>/.gitignore` (and prune a ticket's evidence on Close/sweep).
  2. Have the dispatcher ingest lessons from immutable `results/*.json` (plus a dispatcher-owned watermark/offset for any coordinator notes in `tickets/<n>.md`) so the dispatcher never edits `tickets/<n>.md`.
  3. Move `Status: running|paused` into a locked `resources.mjs` field (or dedicated file written through `resources.mjs`), and have `wake-check.sh` exit `1` while paused when no ticket has an active worker (since `resume` triggers a dispatcher run immediately per `plan-v3.md:133`).

### 12. [medium] Post-plan collision check is not atomic in `scripts/resources.mjs` (Round-1 R11 shortfall)
- **Evidence:** `plan-v3.md:124-128` (§1.10), `plan-v3.md:198-203` (Ticket B Step 1).
- **Why it matters:** §1.10's tie-breaker (past-plan beats just-planned; lower ticket number beats higher) fails if two coordinators finish `Plan` concurrently and read/write `tickets/<n>.json` in separate steps—both can read before the other transitions to `building` and start modifying overlapping files simultaneously. `files_to_change` and collision checking are also omitted from `tickets/<n>.json` (`plan-v3.md:79`) and `scripts/resources.mjs` (`plan-v3.md:198-203`).
- **Fix:** Store `files_to_change` in `tickets/<n>.json` and add an atomic `resources.mjs` subcommand (e.g., `check-plan <ticket> --files … --open-prs …`) that records `files_to_change`, evaluates overlaps under the lock, and atomically transitions the ticket either to `building` or to `waiting on […]`. Also clarify that updating the branch after a collision wait (`plan-v3.md:128`) runs `git fetch origin && git reset --hard origin/<trunk>` (safe since no commits have been pushed yet).

### 13. [medium] Reset gate omits tracked-file restoration, and `references/t3.md:74` conflicts with parallel `verify ‖ review` (Round-1 R7 shortfall)
- **Evidence:** `plan-v3.md:110-114` (§1.8), `plugins/software/skills/factory/references/t3.md:74`.
- **Why it matters:** `git clean -fdx` (`plan-v3.md:113`) only deletes untracked files; tracked files dirtied by a crashed or misbehaving `verify`/`plan` worker remain modified and can be committed by a subsequent rework `build`. Separately, `references/t3.md:74` instructs checking `git status` after every worker finishes, which will flag transient files if `review` completes while `verify` is still running in the same worktree.
- **Fix:** In §1.8 Step 3, run `git reset --hard <expected_head>` (after Step 2 confirms zero unpushed commits) before `git clean -fdx`. In Step 10 (`references/t3.md:74`), limit the post-worker `git status` check to when no sibling worker is still running in the worktree (or check after both `verify` and `review` complete).

### 14. [medium] Missing `docs/agents/issue-tracker.md:26`, `ready-for-agent` cleanup in migration, and `SETUP.md:10` v1 detection (Round-1 R12/R13/R18 shortfall)
- **Evidence:** `docs/agents/issue-tracker.md:26`, `plugins/software/skills/factory/SETUP.md:10`, `plan-v3.md:150` (§1.12), `plan-v3.md:234-249` (Ticket D Steps 9 & 13).
- **Why it matters:**
  1. This repository's own `docs/agents/issue-tracker.md:26` contains `factory:hold` (*"when a pull request exists, also add the `factory:hold` label on GitHub"*), but Step 13 (`plan-v3.md:243-248`) omits it—so plan v3's own gate `grep -rn "factory:hold" plugins docs` (`plan-v3.md:249`) will fail.
  2. Migrating `factory:hold` → `ready-for-human` (`plan-v3.md:150`) does not mention removing `ready-for-agent` from migrated issues, leaving them with conflicting state labels (`triage/SKILL.md:42`).
  3. `SETUP.md:10` still detects version 1 (Orca) settings by checking for *"an `Agent:` line and no `Coordinator:` line"*; once `Coordinator:` is dropped from current `factory.md`, this check must change to *"an `Agent:` line and no `Manager:` line"* (matching the `smode/playbooks/factory.md:5` fix).
- **Fix:** Add `docs/agents/issue-tracker.md:26` to Step 13 (also adding the `## Factory claim` note), update migration in §1.12/Step 9 to remove `ready-for-agent` when converting `factory:hold` → `ready-for-human`, and update `SETUP.md:10` to detect v1 via `Agent:` without `Manager:`.

### 15. [low] Clarify Spike-before-spec ordering and 3-manifest patch bump in Ticket A
- **Evidence:** `plan-v3.md:193-195,255` (§3), `cli/lib.mjs:304-311`.
- **Why it matters:** `plan-v3.md:255` states each ticket goes through `smode spec` + `to-tickets` before code, without stating that Ticket A's Spike must run and record findings in `.scratch/factory-per-ticket/research/` *before* writing specs/tickets for B–D (otherwise Spike failures force rewriting specs B–D). Also, Ticket A's patch bump (`plan-v3.md:195`) must update all three `plugins/software/.{claude,cursor,antigravity}-plugin/plugin.json` manifests together (`0.12.1` → `0.12.2`) or `npm run validate` fails (`cli/lib.mjs:310`).
- **Fix:** State in §3 that Ticket A runs first (with all three `plugin.json` bumped for the `thought_level` patch), and `smode spec` + `to-tickets` for Tickets B–D are written after Spike A's results land.

## Round-1 fixes that fall short

All other Round-1 findings (`R2`, `R8`, `R10` except the minor note in #15, `R16`, `R17`, `R20`, `R21`) are adequately resolved in `plan-v3.md`. The following Round-1 fixes remain incomplete:

- **R1 & R11 (Liveness / `due` / wake loss):** Dropping `due` from the fingerprint and adding the 5 `due` sources is right, but Source 5 (`free > 0 && queue non-empty`) causes empty-wake storms under 2-slot head-of-line FIFO blocking and races with recent handoffs, and keeping `wake-check.sh` as the writer of `wake-fingerprint` drops board changes when a dispatcher crashes or is locked out (see **#5**). Collision tie-breaking is still non-atomic outside `resources.mjs` (see **#12**).
- **R3 & R15 (Land resource bundle & fast path):** Total ordering, `min(2, Max workers)`, and the fast path are right, but Step 2 lacks `git fetch origin` before `git merge-base` (see **#4**), `reclaim` lacks a live-worker guard and `resources.mjs`-vs-dispatcher boundary (see **#8**), and Steps 4–7 omit diff-free conflict detection, sequential Check when `Max workers == 1`, and resource release on non-Check failures (see **#9**).
- **R4 (Claim & PR closed without merge):** Dropping `factory:active` matches the user's later decision, but "PR closed without merge" combines `held` with `settle`, contradicting §1.13 unhold (see **#3**), and partial-claim recovery misses the crash window after `launch-coordinator` (see **#10**).
- **R5 (Comments filter):** Creating `scripts/comments.mjs` is the right architecture, but it still misses a pre-claim baseline/`since` cutoff, namespaced IDs across GitHub's 3 comment/review ID spaces, split fetch/ack to prevent crash loss, and graceful handling of 404s for bots (see **#6**).
- **R6 (Multi-writer memory races):** Splitting `tickets/<n>.json` and locking `quota.md` fixes the main races, but `<memory>/evidence/` is missing from `.gitignore`, `tickets/<n>.md` lesson ingestion has no single-writer watermark, and `index.md` still has a two-writer race on `Status:` (see **#11**).
- **R7 (Reset gate & parallel Check):** Handling unpushed branches and moving verify evidence out of the worktree fixes the main issues, but tracked-file reset (`git reset --hard`) is omitted and `references/t3.md:74` still assumes `git status` is clean after every single worker (see **#13**).
- **R9 (Revive & existing PR):** Checking the old child worker and passing `origin/<pr_branch>` fixes the core hazards, but existing PR launch still omits `branch: "<pr_branch>"` (and fork PRs), and `revive` does not check/block quota errors on dead coordinators (see **#10**).
- **R12, R13, R18 (Accuracy, migration, missing files):** Most citations and files are fixed, but `SETUP.md:10` v1 detection still checks for absent `Coordinator:`, `factory:hold` migration omits removing `ready-for-agent`, and `docs/agents/issue-tracker.md:26` still contains `factory:hold` (see **#14**).
- **R14 (Dispatcher lock & `scout` quota):** Adding lock TTL and `scout` candidate selection helps, but reclaiming an expired/failed dispatcher lock never inspects its error for quota words to block the exhausted `scout` candidate (see **#10**).
- **R19 (`pause`/`resume`/`stop`):** Adding explicit modes to `SKILL.md` fixes the UX, but leaves the `index.md` write race and watcher behavior while `Status: paused` unspecified (see **#11**).
