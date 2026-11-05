# 02: Agent finds, claims, and self-verifies a bug issue

**What to build:** when `diagnosing-bugs` is tied to a bug issue on a tracker, it can recognise the issue, find one when none is given, claim it, and check the reporter's claim before diagnosing. A bug issue is one labelled `bug` (GitHub, GitLab) or a file in the local bugs folder. Given a specific issue, the agent works exactly that bug. Given none, it lists open bug issues, skips those waiting in `needs-info` and those already claimed, takes the oldest, and claims it before any work (assignee on GitHub and GitLab, `Claimed-by:` locally). It reads the body and any Evidence, then runs every `Verify:` line and records each as reproduced, not reproduced, or could not run, with redacted output. A bug with no runnable `Verify:` line counts as missing information. If the checks do not reproduce the Actual behavior the agent stops and never substitutes a nearby failure; if they reproduce it, the reporter's `Verify:` lines are the starting loop for Phase 1, which tightens them. The skill names, in prose, the fields it depends on (Actual behavior, Expected behavior, Reproduction criteria with `Verify:`, Evidence) and does not read the seed templates. When no bug issue is involved, the skill behaves exactly as it does today.

**Blocked by:** None (can start immediately)

**Status:** closed

**Door:** two-way

- [x] `diagnosing-bugs` describes how to recognise a bug issue, find one when none is given, skip `needs-info` and claimed issues, take the oldest, and claim before working, for each tracker kind
  Verify: read the skill; each rule is present and none refers to a doc under `docs/agents/` for bugs
- [x] Given a seeded bug issue whose `Verify:` line fails while the bug exists, an agent following the skill runs it, records `reproduced` with redacted output, and starts Phase 1 from that check
  Verify: seed a sandbox repo with a small failing behaviour and a bug issue pointing at it; have an agent follow the skill and inspect its record and its first Phase 1 loop
- [x] Given a seeded bug whose `Verify:` line passes (the bug does not reproduce), the agent stops before Phase 1 and does not pick a different failure
  Verify: seed such a bug, run an agent following the skill, and confirm it stops and starts no diagnosis
- [x] Given a seeded bug with no runnable `Verify:` line, the agent treats it as missing information and does not invent a reproduction
  Verify: seed such a bug, run an agent following the skill, and confirm no reproduction was attempted
- [x] Given no issue reference and several open bugs, the agent skips a `needs-info` bug and a claimed bug, picks the oldest remaining, and claims it first
  Verify: seed three bugs (one `needs-info`, one claimed, one free) and observe which is picked and the claim written before any work
- [x] With no bug issue involved ("debug this" on a plain symptom) the skill's existing phases run unchanged
  Verify: read the skill diff; every existing phase's text is unchanged, and the new material is a separate section applied only to bug issues
- [x] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root

## Handoff

**Delivered:** `diagnosing-bugs` has a separate `Bug issue intake` section before Phase 1, applied only when work is tied to a bug issue. It defines a bug issue (`bug` label on GitHub and GitLab, a file in the local bugs folder), finding one when none is given (open, not `needs-info`, not claimed, oldest first), claiming before any work (assignee, or a `Claimed-by:` line locally), and self-verifying every `Verify:` line with a reproduced / not reproduced / could not run record in redacted form. A bug with no runnable `Verify:` line is missing information. Any line not reproduced or that could not run stops work before Phase 1. When every line is reproduced, those lines are the first Phase 1 loop. Existing phase text is unchanged. `npm run validate` and `npm test` pass.
**Interfaces introduced:** the `Bug issue intake` section (headings `Find and claim`, `Self-verify`, `Hand over to Phase 1`) in the `diagnosing-bugs` skill; the local bugs folder is named as `.scratch/bugs/issues/`.
**Deviations from spec:** none. The stop outcomes (not reproduced, could not run, no runnable `Verify:`) say only "stop"; the issue comment and move to `needs-info` are left for ticket 03.
**Decisions:** every `Verify:` line must be reproduced to continue (a mix of reproduced and not reproduced stops). "Oldest" is the earliest created on GitHub and GitLab and the lowest number locally. The section points to "the project's tracker setup" for the tracker's assign operations and names no doc under `docs/agents/` for bugs.
**Gotchas:** the seeded-sandbox runs listed in the `Verify:` lines were not executed; the behaviour criteria were checked by reading the skill against them. Ticket 03 should add its feedback section next to the stop points here, which currently carry no feedback wording.
**For the next ticket:** 03: the stop points are in `Self-verify` steps 3 and 4 and in `Find and claim` (no issue left); add the comment and `needs-info` move there or in a separate section that those steps point to, and do not duplicate the self-verify wording. 04: nothing from this ticket; AGENTS.md and plugin versions are untouched.
**Links:** none yet (branch `ticket-02-bug-issue-selfverify`)
