# 03: Take one ticket from plan to automatic merge

**What to build:** on a sandbox GitHub repository with an approved spec holding one ticket, the factory skill's `once` mode, repeated, takes the ticket from plan to merge with no human. A planner worker writes the plan and the coordinator posts it; an implementer worker pushes the branch and the coordinator opens the pull request that closes the ticket; the verifier and reviewer workers check the head and the coordinator records their verdicts as commit statuses on it; the coordinator merges through the merge guard, closes the ticket with its handoff, and closes the workspace. Each wake leaves one journal line.

**Blocked by:** 01, 02

**Status:** closed

**Door:** two-way

- [x] The ticket ends merged and closed with a handoff, and every step shows on GitHub.
  Verify: run `once` until the ticket closes; the ticket has a plan comment and a handoff; the pull request has `factory/verify` and `factory/review` successes on its merged head and was squash-merged.
- [x] Every step runs as a fresh worker in a worktree the manager created and later removed, and no worker commit is lost.
  Verify: Orca shows one worker per step during the run; `git worktree list` shows none of them afterwards; every worker commit is in the merged pull request.
- [x] A push after the verdicts blocks the merge until new verdicts exist on the new head.
  Verify: after both statuses pass, push one more commit to the branch; the next wake does not merge; it merges after the new head is checked.
- [x] A failing review sends the ticket to a fresh implementer with the findings, a design finding goes back to the planner, and after the configured rounds the ticket goes to the developer with a brief.
  Verify: seed a ticket the reviewer must fail once and then pass; observe one rework worker; set fix rounds to 0 and observe a brief instead of a rework.
- [ ] Pending required checks are looked at again on later wakes, never awaited in a blocking way, and a required check that has not reported is not green.
  Verify: name a required check that takes several minutes; the coordinator handles other events meanwhile and merges only after the check passes; name a check that never reports; the pull request does not merge.

## Handoff

**Delivered:** on sanphandinh/factory-sandbox, `once` wakes took #2 (spec #1), #4 and #5 from plan to automatic squash merge. A commit pushed after both verdicts (PR #6, 88769d5) left the new head without `factory/verify`/`factory/review`; the next wake re-checked instead of merging. A sabotage commit (PR #15, `+ 1` in `vowels`) got FAIL from the verifier and fail from the reviewer, both naming the exact line; rework round 1 reverted it with a new commit and the re-checked head merged. With `Fix rounds: 0`, a broken head (PR #16) went to a brief instead of rework. A 10-minute CI check stayed pending across wakes and PR #6 merged only after it passed.
**Interfaces introduced:** `## Factory plan`, `## Factory verify`, `## Factory review`, `## Factory rework <n>`, `## Factory brief` comments; verdict statuses `factory/verify`, `factory/review`; merge with `--match-head-commit`.
**Deviations from spec:** the coordinator, not the workers, opens pull requests and sets statuses (Orca's worker contract forbids workers posting to GitHub). A ticket's pull request is any open one that closes it.
**Not verified here:** a required check that never reports (the second half of the last criterion); ticket 08's silent Xcode Cloud is that case.
**Gotchas:** a replayed `done` can belong to a wake cut off mid-handling; read GitHub before repeating a step. `gh pr checks` states are uppercase (`SUCCESS`, `IN_PROGRESS`).
**For the next ticket:** 04: scheduled wakes replace "never end the turn".
