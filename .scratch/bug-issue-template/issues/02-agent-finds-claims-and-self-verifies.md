# 02: Agent finds, claims, and self-verifies a bug issue

**What to build:** when `diagnosing-bugs` is tied to a bug issue on a tracker, it can recognise the issue, find one when none is given, claim it, and check the reporter's claim before diagnosing. A bug issue is one labelled `bug` (GitHub, GitLab) or a file in the local bugs folder. Given a specific issue, the agent works exactly that bug. Given none, it lists open bug issues, skips those waiting in `needs-info` and those already claimed, takes the oldest, and claims it before any work (assignee on GitHub and GitLab, `Claimed-by:` locally). It reads the body and any Evidence, then runs every `Verify:` line and records each as reproduced, not reproduced, or could not run, with redacted output. A bug with no runnable `Verify:` line counts as missing information. If the checks do not reproduce the Actual behavior the agent stops and never substitutes a nearby failure; if they reproduce it, the reporter's `Verify:` lines are the starting loop for Phase 1, which tightens them. The skill names, in prose, the fields it depends on (Actual behavior, Expected behavior, Reproduction criteria with `Verify:`, Evidence) and does not read the seed templates. When no bug issue is involved, the skill behaves exactly as it does today.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] `diagnosing-bugs` describes how to recognise a bug issue, find one when none is given, skip `needs-info` and claimed issues, take the oldest, and claim before working, for each tracker kind
  Verify: read the skill; each rule is present and none refers to a doc under `docs/agents/` for bugs
- [ ] Given a seeded bug issue whose `Verify:` line fails while the bug exists, an agent following the skill runs it, records `reproduced` with redacted output, and starts Phase 1 from that check
  Verify: seed a sandbox repo with a small failing behaviour and a bug issue pointing at it; have an agent follow the skill and inspect its record and its first Phase 1 loop
- [ ] Given a seeded bug whose `Verify:` line passes (the bug does not reproduce), the agent stops before Phase 1 and does not pick a different failure
  Verify: seed such a bug, run an agent following the skill, and confirm it stops and starts no diagnosis
- [ ] Given a seeded bug with no runnable `Verify:` line, the agent treats it as missing information and does not invent a reproduction
  Verify: seed such a bug, run an agent following the skill, and confirm no reproduction was attempted
- [ ] Given no issue reference and several open bugs, the agent skips a `needs-info` bug and a claimed bug, picks the oldest remaining, and claims it first
  Verify: seed three bugs (one `needs-info`, one claimed, one free) and observe which is picked and the claim written before any work
- [ ] With no bug issue involved ("debug this" on a plain symptom) the skill's existing phases run unchanged
  Verify: read the skill diff; every existing phase's text is unchanged, and the new material is a separate section applied only to bug issues
- [ ] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root
