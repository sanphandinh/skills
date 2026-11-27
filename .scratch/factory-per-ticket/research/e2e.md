# End-to-end run on the sandbox

`factory run` on `sanphandinh/factory-ticket-sandbox` from 2026-11-27 06:45Z, skill from branch `refactor/factory-per-ticket` (read live from this worktree, so fixes made during the run apply from the next turn that reads them). Settings: `Max workers: 1`, `Max tickets: 2`, `Wake timeout: 5 minutes`, `Required checks: test`, `Trunk checks: test`. Watcher: schedule `factory watch: factory-ticket-sandbox` (every 5 min), thread `0a080121…` on Haiku 5.5 low after its first run.

## Timeline and findings

- 06:45:46Z watcher run 1 (Opus, the environment's default until reconfigured): fingerprint changed → lock → launched dispatcher `f1a75c94…`.
- 06:46:36Z **FAIL → fixed**: that dispatcher (Haiku) declined its first message ("labeled as coming from another T3 agent … not from you"). Fix `5b2da6b`: setup writes a `### Factory` sub-block into the project's `AGENTS.md`; first messages name the automation that sent them. Sandbox `AGENTS.md` got the block (commit `f1f03b9`).
- 06:51:10Z watcher run 2: lock held by the ended dispatcher; **FAIL → fixed**: the watcher read "then reclaim" as part of the quota branch and stopped. Fix `68e2d75` (step 3 split into three cases).
- 06:56:21Z watcher run 3: reclaimed the lock, launched dispatcher `a83d40e4…` (Haiku). **PASS: a failed dispatcher run is retried by the next watcher run.**
- 06:56–06:57Z dispatcher `a83d40e4…`: claimed #4 and #5 (claim tokens, `## Factory claim` comments), launched coordinators `factory #4 upper-command` (`efa604ac…`) and `factory #5 readme-commands` (`0b3bc0bf…`), each in its own worktree (`factory-4-upper-command-…`, `factory-5-readme-comman-…`), journal line, lock released. **PASS: one worktree per ticket.** Two defects: it wrote a prose `wake-fingerprint` instead of the hash (every later watcher run would see a change), and archiving its own thread ended its run with "provider event stream closed". Fix `6215e9e`.
- 06:58Z **FAIL → fixed**: coordinator #5 started its plan worker without `res acquire slot` while #4 held the only slot: two workers at once with `Max workers: 1`. Fix (this commit): every worker start goes through **Starting a worker**.
- 06:57–07:04Z ticket #5 (README): plan (Sonnet medium) → collisions cleared → build parked on `slot` (#4 held it) → granted → build `f8d5f4e`, PR #7 → verify on `gemini-4-hydrogen` failed on quota ("Individual quota reached. Resets in 1h2m9s"), blocked in `quota.md` until 08:03Z, restarted on `xai/grok-4.7 via=cursor` → verify PASS, review pass (grok) → Land fast path → squash merge `ba2e91d` at 07:04:34Z (statuses `factory/verify`, `factory/review`, `test` all success on `f8d5f4e`) → Close: handoff, ticket closed, unclaimed, slot notice to #4 (`notified`), unwatch, settle. **PASS: plan → build → check → land fast path → close; quota failover; FIFO slot with Max workers 1.** Two defects in Close: `gh -R … api -X DELETE …` (gh api takes no `-R`) failed silently, so the remote branch stayed; the handoff got its heading twice. Fix `this commit` in COORDINATOR.md.
- 07:06–07:12Z ticket #4: review on `gemini-4-hydrogen` hit quota → restarted on grok-4.7 (no round cost) → review PASS on `254ff07` → trunk had moved (#7), so **Land update** under `slot`+`merge`: trunk merged, new head `f62ba2b`, re-verify started (grok-4.7). **PASS so far: Land always updates from trunk while holding `merge`.** Dispatcher 07:12Z claimed #8 (`factory/8-lower-command`, coordinator `49dbeb77…`) and swept #5's workspace and branch. **PASS: Max tickets 2 (#4 + #8 active, #9 waits).**
- 07:12–08:05Z **STALL (known limit)**: the Claude account hit its 5-hour limit ("You've hit your 5-hour limit · resets 5:40pm (Asia/Saigon)", 10:40Z). Coordinators #4 and #8 (both `claude-sonnet-5-5`) failed mid-turn; the watcher (on `claude-haiku-5-5`) failed every 5 minutes from 07:15Z to 08:00Z (runs 9–16), so no dispatcher ran to revive them. DISPATCHER.md already names "the watcher's own model out of quota" as a known limit. The sandbox's routes made it worse: its `coordinator` line had only Claude candidates, against SETUP.md's "different providers where possible" (the earlier setup run wrote it).
- 08:05Z owner fix, as `factory setup override` would: provider session check for `google/gemini-4-neon via=antigravity` (PASS, thread `b9daac28…`, `providers.md` now "worker and session checks"); sandbox `71a07a8` "Override factory roles: scout, worker, thinker, coordinator" (Antigravity first on `scout`, `thinker`, `coordinator`; `cursor/composer-2.5` first on `worker`); watcher thread moved to `gemini-3.8-flash` (`t3_thread_configure`). 08:06:55Z watcher launched dispatcher `mcp:2b546d5d…` on gemini-3.8-flash; the expected next step is **Revive** of #4 and #8 on `gemini-4-neon`, with the Claude candidates blocked in `quota.md`.

## Resume after pause (2026-11-27 09:26Z–09:43Z)

Measured this session, after Antigravity returned "Individual quota reached" (reset about 13:03Z).

- 09:26Z dispatcher claimed #15. Plan on `google/gemini-4-neon via=antigravity` finished at 09:29Z. Coordinator saw `factoryStatus: paused`, posted `## Factory plan`, released `slot`, cleared `tasks` and `due`, and did not start Collisions or Build. **PASS: pause mid-ticket** (recorded on the ticket story before this session).
- 09:31Z status set back to `running`; due for #15 set to now. Watcher schedule recreated as `factory-watch-sandbox-v2`, bound to [factory watch: factory-ticket-sandbox](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/thread:project:mcp%3Aeeb06939-7caa-4269-942e-7a0e5a76a23b:837a8002-870a-4ac1-81e3-c742f5e93d76).
- 09:32Z watcher run 1 on `gemini-4-neon` **failed**: "Individual quota reached".
- 09:37Z watcher run 2 on `gemini-3.8-flash` launched [factory dispatch 2026-11-27 16:37:26](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:e19f4b74-f052-4a53-8727-754bcf448116), which **failed** on the same quota line and left the lock held.
- 09:38Z owner switch to Cursor, as asked: sandbox `1af74b6` puts `xai/grok-4.7 effort=low via=cursor` first on `scout`, `thinker`, `reviewer` and `coordinator` (`worker` stays `cursor/composer-2.5`). Antigravity candidates blocked in `quota.md` until `2026-11-27T13:10Z`. Watcher thread and coordinator #15 reconfigured to `cursor` / `grok-4.7` / `reasoning_effort=low`.
- 09:39Z watcher run 3 on Grok reclaimed the dead lock and launched [factory dispatch 2026-11-27 16:40:18](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:90d2a18c07bbbd2cf62b9cb021feb35f30481ea36a846c469d53cb2da57be39b). **PASS: a dispatcher that died on quota is replaced by the next scout candidate.** Journal `09:41Z`: woke #15 (due passed); lock released; trunk `test` green on `1af74b6`.
- 09:41Z [factory #15 add-license-line-to-readme](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:6b334e73a36547a24f6c2365165e663b30145c1d444863d57ae28d33d5dd3a09) received "Factory wake #15: your due passed" and continued on Grok: collisions cleared (`planCleared: true`, `files_to_change: ["README.md"]`), reset to `origin/main` `1af74b6`, acquired `slot`, started [15 build](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/thread:delegated-task:command%3Amcp%3A0c6e6bde-022c-4912-aeac-b153687f0d23%3Adelegate-task%3A15-build-1-2026-11-27T09%253A43Z) on `cursor/composer-2.5`. Due `2026-11-27T09:48:25.924Z`. **PASS: resume wakes a ticket that stopped mid-way, and that coordinator continues into Build.**

## wontfix while held (2026-11-27 10:04Z–10:10Z)

Ticket [#17](https://github.com/sanphandinh/factory-ticket-sandbox/issues/17).

- 10:04Z [factory dispatch 2026-11-27T10:03Z](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:00416887c3860bbe2c181a9a51881c19b06bd81ad9a47a5c8781c8869ac8b5a7) claimed #17. Coordinator [factory #17 add-a-sandbox-marker-line-to-readme](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:093453e02d34693c42a3f274419c1a3ca7b619ba4bef28b500e45997ae9a5aee) started a plan worker.
- 10:05Z `ready-for-human` added, `ready-for-agent` removed.
- 10:07Z [factory dispatch 2026-11-27T10:05:41Z](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:64f57eab3b192d0eeb28462ef48ae86a08aaaada607bfd98aee8ba481e45a7ec) woke the coordinator to hold. It stopped the plan worker, released `slot`, posted [the brief](https://github.com/sanphandinh/factory-ticket-sandbox/issues/17#issuecomment-7215513882), set `state: held`, and flagged the thread. **PASS: a person label holds the ticket.**
- 10:08Z `wontfix` added while the ticket was held.
- 10:10Z [factory dispatch 2026-11-27T10:09Z](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:8c433e0953594c7440c0f9a1fcbc3e0a8f61b9add71def137f994db83756be72) unclaimed #17 and told the coordinator to clean up. The coordinator cleared the flag and settled. The next dispatcher swept the workspace. **PASS: wontfix while held, the coordinator cleans up and settles.** The issue stays open with `wontfix`.

## Red trunk (started 2026-11-27 10:13Z)

- 10:14Z dispatcher claimed #18 and #19, so `active` is 2 of `Max tickets` 2. Journal `10:14Z`.
- 10:15Z sandbox `a215a26` breaks the slugify test. CI run [45980411400](https://github.com/sanphandinh/factory-ticket-sandbox/actions/runs/45980411400) failed.
- 10:17Z [factory dispatch 2026-11-27T10:15:18Z](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:4e3140c4dd6cf17fd62a590380a4bae52ed92844ad942f2a3d6e121d6affeb0d) saw `test` red at `a215a267` and reran the failed run. Attempt 2 also failed. #19's plan worker stayed live.
- 10:26Z [factory dispatch 2026-11-27T17:23+07](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:4532506f2e81f6b2abcf6379ff238f7707c23fbf1137ebdbfa52bbd310e1229a) filed [#20](https://github.com/sanphandinh/factory-ticket-sandbox/issues/20) `Fix trunk: test is red at a215a267` and claimed it on `factory/20-fix-trunk-test-is-red-at-a215a267` while #18 and #19 were already claimed (`active` 2 of `Max tickets` 2). Coordinator [factory #20](t3-thread://v2/4dc3b97b-8dd5-4793-95fb-7b6d756f3d6d/mcp:launch:24b58a717032e0a98db39146cd3bf282f4f938b4a8eaec9d4ed385347822e1f9). **PASS: red trunk is detected, a fix ticket is filed, and it is claimed even when Max tickets is full.** The fix pull request is still ahead of this note: the coordinator has just started, and a person merges that pull request.

## Recorded from the ticket stories (memory `tickets/<n>.md`, 2026-11-27 08:09Z–09:19Z)

- #4: coordinator died at 07:12Z during Land update, holding `slot` and `merge` (Claude limit). Revived 08:09Z: linked and watched [PR #6](https://github.com/sanphandinh/factory-ticket-sandbox/pull/6) again and parked on `slot`. **PASS: a coordinator that died holding `merge` is revived, rewatches its pull request, and goes on.**
- #4, 08:13Z: the owner's [comment](https://github.com/sanphandinh/factory-ticket-sandbox/pull/6#issuecomment-7213276593) asked for JSDoc. The coordinator ran a build for it (`db6dcee`), replied, verified and reviewed again, ran Land update under `slot`+`merge` (trunk moved to `71a07a8`), checked again on `3e15e86`, and merged at 08:28Z. **PASS: a person's comment asking for a change is built; Land checks again after trunk moves.**
- #9: [PR #11](https://github.com/sanphandinh/factory-ticket-sandbox/pull/11) closed without merging at 08:44Z. **Close, unmerged** posted a brief, set `ready-for-human`, and the claim was released. The ticket was handed back, and at 08:52Z a new coordinator claimed it on `factory/9-add-a-contributing-note` and opened [PR #13](https://github.com/sanphandinh/factory-ticket-sandbox/pull/13). **PASS: closed without merge, then retried by a new coordinator.**
- #9, 08:58Z: a person put `ready-for-human` on PR #13 while it ran. The coordinator mirrored the label to the ticket, posted the brief, released `slot` and flagged the thread. No wake followed until 09:02Z, when the hold was released and the same coordinator was woken. It merged at 09:19Z after Land update (`ff6a406`). **PASS: a person label on a running pull request holds it without repeated wakes; unhold wakes that coordinator; the pull request merges.**
- #12: plan, build and checks passed on [PR #14](https://github.com/sanphandinh/factory-ticket-sandbox/pull/14). It touches `.github/workflows/ci.yml`, a protected path, so it was held for a person at 09:09Z. A person merged it at 09:11Z, and Close ran once: handoff, branch deleted, unclaimed, flag cleared. **PASS: a person merges a protected-path pull request and Close runs once.**

## Red trunk, continued (2026-11-27 10:39Z–11:05Z)

- 10:25Z and 10:39Z: the plan workers of #19 and #18 (Grok, which cannot ask) reported `failed` with one question: a criterion cannot pass while trunk is red. Both coordinators held their tickets with `ready-for-human`. **FAIL → fixed** in `ac192de`: a question whose only cause is a red trunk makes the ticket wait on `trunk`. Before the fix, a green trunk never resumed them.
- 10:50Z: #20's [PR #21](https://github.com/sanphandinh/factory-ticket-sandbox/pull/21) passed verify and review, then stopped at the red-trunk policy gate and waited for a person. **PASS: a trunk-fix pull request gets through on a red trunk, to a person.**
- 11:03:58Z: the owner merged PR #21 (`9cb5ab5`), and trunk `test` turned green.
- 11:05Z: the owner handed #18 and #19 back (`ready-for-agent`, comment "trunk is green again").
- 11:10Z: [dispatcher](https://github.com/sanphandinh/factory-ticket-sandbox) woke #18 and #19 ("hold released; new comments"). **PASS: unhold wakes the right coordinators.** #19 then waited on `ticket:18` (both edit README); #18 merged as [PR #22](https://github.com/sanphandinh/factory-ticket-sandbox/pull/22) at 11:31Z and #19 went on. **PASS: collision wait.**

## Red trunk while a ticket builds (2026-11-27 11:35Z–11:53Z)

- 11:35Z: owner broke trunk again (`9abfc5e`). #19's collision cleared and its branch reset to the red trunk; build `e3fe1f5`, [PR #23](https://github.com/sanphandinh/factory-ticket-sandbox/pull/23). 11:40Z dispatcher saw trunk red and reran the failed run.
- 11:42Z: verify FAIL only because `npm test` fails on trunk's own test. **FAIL:** the coordinator set `factory/verify` failure and started Rework 1. It had read COORDINATOR.md before `ae6ec45` landed (11:37Z) and a coordinator rereads the skill only on its first turn. Owner told it to reread. Lesson: a skill change reaches a running coordinator only when it rereads.
- 11:43Z: after rereading, the rework build failed only on the red trunk. The coordinator set `factory/verify` `pending` "waits on red trunk", released `slot`, `state: waiting`, `waitingOn: ["trunk"]`. **PASS: red-trunk rule, no hold, no further rework.** (One rework round was already spent under the old rule.)
- 11:44Z: owner reverted the break (`da8ccea`); trunk `test` green. 11:45Z dispatcher: "woke #19 (trunk is no longer red)". **PASS: a ticket waiting on trunk is woken when trunk is no longer red.**
- 11:45Z: #19 saw its branch lacked trunk, `git merge-tree` clean, ran `build: update from trunk` → `4071866`; verify PASS, review pass, squash merge at 11:53Z. **PASS: update from trunk before checking again.**

## Every worker candidate out of quota (2026-11-27 11:52Z–)

- 11:52Z: owner blocked `cursor/composer-2.5` and `anthropic/claude-sonnet-5-5 effort=low` (the whole `worker` route) until 12:10Z in `quota.md`.
- 11:59Z: #24's plan done; build has no candidate. The coordinator released `slot`, started no worker, `state: running`, `due: 12:10:00Z`, `holdings: []`. **PASS: every candidate out of quota at a step: resources released, due at the earliest unblock.**

## Stop, then run (2026-11-27 12:01Z–)

- 12:01Z: `factory stop`: watcher schedule deleted, `status set paused`. #24 is mid-ticket (plan posted, build not started, due 12:10Z).
- 12:12Z: `factory run`: `status set running`, watcher schedule recreated. Nothing ran while stopped, though #24's due (12:10Z) had passed. 12:18Z the first dispatcher woke #24 ("due passed"); it built at 12:19Z, verified, reviewed and merged [PR #25](https://github.com/sanphandinh/factory-ticket-sandbox/pull/25) through Land's fast path. **PASS: stop then run; a ticket stopped mid-way is woken.** Operator slip: the new watcher thread ran on the environment default (`claude-opus-5-5`) for six runs because `references/t3.md` **Before the first wake** step 3 (move it to the `scout` candidate) was skipped; moved to `cursor/grok-4.7` at 12:45Z.
- 12:37Z and 12:42Z: with the board still, the watcher replied `quiet` and launched no dispatcher. **PASS: no empty wake.**

## Section 4 of the plan: status (2026-11-27 12:45Z)

| Item | Status | Evidence |
|---|---|---|
| one worktree per ticket | PASS | 06:57Z #4, #5 |
| no empty wake on a still board | PASS | 12:37Z, 12:42Z `quiet` |
| red trunk after a merge is detected | PASS | 10:17Z, 11:40Z |
| unhold wakes the right coordinator | PASS | 09:02Z #9; 11:10Z #18, #19 |
| Land fast path / check again when trunk moved | PASS | #5, #24 / #4, #9 |
| PR closed without merge → claim released; handed back → new coordinator | PASS | #9, PR #11 → PR #13 |
| hold puts nothing on the PR; merges after unhold | PASS | #9 |
| dispatcher failure retried; quota death → next `scout` candidate | PASS | 06:56Z; 09:39Z |
| PR CI `PENDING` waits, no rework; red trunk → no trunk merge into the branch | PASS | #26 14:10Z waited on `IN_PROGRESS`, merged PR #29 at 14:13Z, `reworkRounds` 0; red trunk part: #19 |
| stuck worker → due wakes the coordinator | PASS | #15 09:41Z, #19 10:26Z |
| coordinator died holding `merge`: released on revive, PR watched again | PASS | #4 08:09Z |
| parked holder dies: overdue holding wakes the dispatcher, resources reclaimed | UNVERIFIED | not staged; `resources.test.mjs` "renew extends every holding…", "reclaim releases every resource…" |
| `pause` claims nothing; `resume` wakes a ticket stopped mid-way | PASS | #15; `d8c96f1` test |
| retry after closed PR does not touch the old worktree or branch | PASS | #9 new branch run, PR #13 |
| trunk-fix PR gets through on a red trunk; ticket waiting on trunk woken when green | PASS | PR #21 (person merged), #19 11:45Z |
| protected path with CI `PENDING`: wait for CI, then hold | PASS | #27 14:06Z waited on `IN_PROGRESS`; 14:11Z held at the policy gate after CI passed (PR #28) |
| `stop` then `run`: a ticket stopped mid-way is woken | PASS | #24 12:18Z |
| every candidate out of quota at a step: resources released | PASS | #24 11:59Z |
| red trunk with `Max tickets` full: trunk-fix ticket still claimed | PASS | #20 10:26Z |
| person adds `ready-for-human` to a running PR: hold, no wake every 15 minutes | PASS | #9 08:58Z–09:02Z |
| `wontfix` while held: coordinator cleans up and settles | PASS | #17 |
| person merges a protected-path PR: Close runs once | PASS | #12, PR #14 |
| hold → `ready-for-human`; handed back → that coordinator woken | PASS | #18, #19 |
| worktree swept after merge | PASS | every merged ticket |
| `tickets/<n>.md` tells the whole story | PASS | memory `tickets/*.md` |

Found and fixed during this pass: a question caused only by a red trunk held the ticket (`ac192de`); review rounds 1–6 of the e2e fixes (`9cf6e07`, `ae6ec45`, `f2e5e72`, `c854be0`, `caf6f61`, `06fed2f`, `ef17e57`), round 6 approved.

## CI PENDING (2026-11-27 13:32Z–14:13Z)

- 13:32Z: owner pushed `test/slow-ci.test.js` to sandbox `main` (`1539956`): it sleeps 8 minutes only when `CI` is set, so the PR `test` check stays `IN_PROGRESS` while local workers run fast. Created [#26](https://github.com/sanphandinh/factory-ticket-sandbox/issues/26) (`docs/NOTES.md`) and [#27](https://github.com/sanphandinh/factory-ticket-sandbox/issues/27) (`.github/workflows/ci.yml`, a protected path). The owner reran each PR's CI right after its first run ended, so the check was still pending at Land.
- 13:41Z: **FAIL → fixed** (`14e0cbf`): the dispatcher revived #26's coordinator because its thread was settled after parking; a settled thread whose run completed is live. Same as #18 at 10:17Z.
- 14:06Z: #27 review pass; Land gate 1 saw `test` `IN_PROGRESS`, set `running` with a due, released `slot`. No hold yet. 14:11Z: `test` success; the policy gate held it for a person (`ready-for-human` on the ticket and [PR #28](https://github.com/sanphandinh/factory-ticket-sandbox/pull/28), brief posted). **PASS: a protected-path PR with CI pending waits for CI, then holds.**
- 14:10Z: #26 review pass; `test` `IN_PROGRESS`, Land waited, no rework. 14:13Z squash-merged [PR #29](https://github.com/sanphandinh/factory-ticket-sandbox/pull/29). **PASS: pending CI waits, no rework.**
- 14:14Z: slow test removed from sandbox `main`; watcher deleted; `status paused`. #27 stays held with PR #28 open for a person.
