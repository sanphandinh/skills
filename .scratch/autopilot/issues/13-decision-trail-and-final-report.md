# 13: Decision trail and final report

**What to build:** every ticket keeps an auditable record of what the agents decided and why, committed with the ticket, and every run ends with a report of what merged, what waits for the human and why, and what is still blocked.

**Blocked by:** 05

**Status:** closed

- [x] Each ticket has a TSV decision trail committed on its branch, with a row per decision and its reason
- [x] Implementer, verifier, and reviewers append to it through the orchestrator, not by free-form edits
- [x] The final report lists merged tickets with pull request links, `ready-for-human` tickets with reasons, and blocked tickets with their blockers
- [x] Tests assert the trail rows and the report content for a mixed run
- [x] `npm run validate` and `npm test` pass

## Comments

Done. The trail lands once per ticket, right before the merge or the hand-off, as a tracker-only commit rebased onto the branch head and pushed without force, so it can never overwrite another push. The split writes `trail/split.tsv` with the tickets.
