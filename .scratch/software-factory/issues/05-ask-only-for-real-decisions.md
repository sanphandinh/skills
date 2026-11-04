# 05: Ask the developer only for real decisions

**What to build:** the developer is asked only for decisions and can answer on GitHub or in Orca. A plan with a product question holds its ticket; one-way doors and protected paths get `factory:hold` and wait; a worker that blocks on a permission prompt or a question reaches the coordinator at once and is either answered from the brief and the plan or turned into a brief for the developer; a red trunk stops merges with at most one fix task; a required check that never reports is raised as unknown and files nothing.

**Blocked by:** 03

**Status:** closed

**Door:** two-way

- [x] A plan with a product question holds its ticket with a brief on the ticket and an unread mark in Orca, and the answer releases it, while other tickets keep moving.
  Verify: a sandbox ticket with an open product choice beside an ordinary ticket; the ordinary one merges; the held one shows a brief and an unread mark; answer on the ticket; the next wake builds it.
- [x] A one-way door or a change to a protected path never merges automatically.
  Verify: one sandbox ticket planned as one-way and one touching a protected path; after green checks both carry `factory:hold` and stay open; removing the label lets the next wake merge.
- [ ] A worker blocked on a permission prompt or a question is handled within one wake.
  Verify: start a worker that hits a permission prompt; the coordinator receives a `blocked` event and answers it or flags the developer before the next timeout.
- [x] While trunk is red nothing merges and at most one fix task runs.
  Verify: break trunk in the sandbox; green pull requests stay open; exactly one fix ticket exists; after the fix merges, the waiting pull requests merge.
- [x] A required check that never reports produces one brief saying CI is unknown, and no fix ticket.
  Verify: name a required check that never runs; after the wait the playbook allows, one brief exists and no fix ticket was filed.

## Handoff

**Delivered:** sandbox #12 (spec #11) held before any code with a brief on two product questions while #13 and #14 kept moving; after the answer it was built and merged (PR #20). #13 (one-way door) and #14 (`.github/`, protected) passed every check and still waited with a brief; #13 merged after its hold was released, #14's pull request was merged by the person, as the playbook now requires for protected paths. A trunk broken on purpose (80c3b5f) got one rerun, then exactly one fix ticket (#22); its pull request passed every check and waited for the person, and merges resumed after it landed. On Ody-drive, Xcode Cloud queued on trunk with no result produced one "unknown CI" brief on the existing #75 and no fix ticket. Workers stuck on provider rate limits (no report) were found on the next wake, stopped and restarted once.
**Interfaces introduced:** `## Factory brief` (Decision needed, Why, Options, Recommendation, To answer); trunk check states green, red, running, unknown.
**Deviations from spec:** a worker stuck at its own question dialog was unstuck by hand in the sandbox (the coordinator had just hit a rate limit), so that one branch is proven by the Orca spike's commands, not by a coordinator.
**Gotchas:** GitHub reports Xcode Cloud as a check suite that stays `queued`; count that as no result.
**For the next ticket:** 08: Ody has no pull request CI, so `Required checks: none` and only the verdict statuses gate its merges.
