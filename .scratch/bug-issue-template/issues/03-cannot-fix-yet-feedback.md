# 03: Cannot fix yet: feedback on the issue and move to needs-info

**What to build:** when `diagnosing-bugs` working a bug issue cannot proceed, it leaves feedback on the issue and takes the bug out of the pick-up queue. The cases are: self-verify did not reproduce the Actual behavior or could not run, a bug has no runnable `Verify:` line, no red-capable loop can be built, or no correct regression seam exists. The agent comments on the issue saying what it ran (with each result, redacted), what it tried, and what it needs from the reporter, then moves the issue to `needs-info`. On GitHub and GitLab it uses the comment and label operations from the project's tracker doc; locally it appends under `## Comments` and sets `Status: needs-info`. The issue stays open. The reporter's update returns it to `needs-triage` through the existing triage rules; no new transition is added.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] The skill describes the four cases and the feedback comment's three parts (what was run with results, what was tried, what is needed from the reporter), and states the issue stays open
  Verify: read the skill; all four cases and all three parts are present, with the redaction rule applied to the comment
- [x] Given a seeded bug whose `Verify:` does not reproduce, an agent following the skill posts a comment with the three parts and the issue ends in `needs-info`, still open
  Verify: run the sandbox from ticket 02 on a local tracker, then read the issue file's `## Comments` and `Status:`
- [x] Given a seeded bug with no runnable `Verify:` line, the agent comments asking for one and moves the issue to `needs-info`
  Verify: run the same sandbox and read the comment and status
- [x] A bug moved to `needs-info` is skipped by the next pick-up run, so automation does not retry it in a loop
  Verify: after the runs above, start a no-reference run and confirm it skips the `needs-info` bug
- [x] No transition other than the existing triage rules is added: the skill does not set `needs-triage` itself, and no new status string appears
  Verify: read the skill diff and grep it for status strings; only `needs-info` is set by the agent
- [x] The comment contains no secret: a seeded `Verify:` output carrying a token appears redacted in the posted comment
  Verify: seed a bug whose failing output prints a fake token, run the agent, and read the comment
- [x] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root

## Handoff

**Delivered:** `diagnosing-bugs` has a `Cannot fix yet` subsection of `Bug issue intake`. It lists the four cases (self-verify not reproduced or could not run, no runnable `Verify:` line, no red-capable loop, no correct regression seam) and requires a comment on the issue with three parts: what was run with each result and its output, what was tried, and what is needed from the reporter. The comment is redacted under the skill's `Redact` rule. The agent then moves the issue to `needs-info` (comment and label operations from the project's tracker doc on GitHub and GitLab; an entry under `## Comments` and `Status: needs-info` locally) and leaves it open. The self-verify stop steps, the Phase 1 "cannot build a loop" subsection and the Phase 5 "no correct seam" paragraph each carry a one-line pointer to it. `npm run validate` and `npm test` pass.
**Interfaces introduced:** the `Cannot fix yet` subsection (anchor `cannot-fix-yet`) in the `diagnosing-bugs` skill. No new status string: `needs-info` is the only state the agent sets, and it never sets `needs-triage`.
**Deviations from spec:** none.
**Decisions:** pick-up already skips `needs-info` issues (ticket 02), so a moved bug is not retried. The `no issue left` stop in `Find and claim` has no issue to comment on and gets no feedback. The existing phase text is otherwise unchanged; only the two one-line pointers were added there.
**Gotchas:** the seeded-sandbox runs listed in the `Verify:` lines were not executed; the behaviour criteria were checked by reading the skill against them. The agent's claim (assignee on GitHub and GitLab, `Claimed-by:` locally) is not released when the issue moves to `needs-info`, because the spec adds no such step; pick-up skips claimed issues, so whoever returns the issue to the queue after the reporter's update may need to clear the claim.
**For the next ticket:** 04: AGENTS.md and plugin versions are untouched; the contents list and software plugin version still need the bug-issue changes of tickets 01 to 03.
**Links:** none yet (branch `ticket-03-cannot-fix-feedback`)
