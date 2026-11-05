# 03: Cannot fix yet: feedback on the issue and move to needs-info

**What to build:** when `diagnosing-bugs` working a bug issue cannot proceed, it leaves feedback on the issue and takes the bug out of the pick-up queue. The cases are: self-verify did not reproduce the Actual behavior or could not run, a bug has no runnable `Verify:` line, no red-capable loop can be built, or no correct regression seam exists. The agent comments on the issue saying what it ran (with each result, redacted), what it tried, and what it needs from the reporter, then moves the issue to `needs-info`. On GitHub and GitLab it uses the comment and label operations from the project's tracker doc; locally it appends under `## Comments` and sets `Status: needs-info`. The issue stays open. The reporter's update returns it to `needs-triage` through the existing triage rules; no new transition is added.

**Blocked by:** 02

**Status:** ready-for-agent

**Door:** two-way

- [ ] The skill describes the four cases and the feedback comment's three parts (what was run with results, what was tried, what is needed from the reporter), and states the issue stays open
  Verify: read the skill; all four cases and all three parts are present, with the redaction rule applied to the comment
- [ ] Given a seeded bug whose `Verify:` does not reproduce, an agent following the skill posts a comment with the three parts and the issue ends in `needs-info`, still open
  Verify: run the sandbox from ticket 02 on a local tracker, then read the issue file's `## Comments` and `Status:`
- [ ] Given a seeded bug with no runnable `Verify:` line, the agent comments asking for one and moves the issue to `needs-info`
  Verify: run the same sandbox and read the comment and status
- [ ] A bug moved to `needs-info` is skipped by the next pick-up run, so automation does not retry it in a loop
  Verify: after the runs above, start a no-reference run and confirm it skips the `needs-info` bug
- [ ] No transition other than the existing triage rules is added: the skill does not set `needs-triage` itself, and no new status string appears
  Verify: read the skill diff and grep it for status strings; only `needs-info` is set by the agent
- [ ] The comment contains no secret: a seeded `Verify:` output carrying a token appears redacted in the posted comment
  Verify: seed a bug whose failing output prints a fake token, run the agent, and read the comment
- [ ] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root
