# 05: Orchestrator tracer bullet: independent verify, review, merge

**What to build:** after the pull request opens, a verifier that did not write the code checks the pull request head and returns a typed verdict tied to the patch it checked, the Spec and Standards reviewers review the diff independently, and a ticket that passes every gate is merged and its pull request reads merged on trunk.

**Blocked by:** 04

**Status:** closed

- [x] The verifier runs as a separate role from the implementer and returns `PASS`, `PASS+NOTES`, or `FAIL` with evidence and the patch identity it checked
- [x] The verdict and the review findings are posted on the pull request so another machine can read them
- [x] `review-spec` and `review-standards` run as separate roles; neither is the implementer
- [x] The implementer never runs `code-review` on its own work inside autopilot
- [x] A ticket with a passing verdict, no hard findings, and green CI is merged; its handoff and closing status are on trunk after the merge
- [x] Tests cover the happy path through the public operation with fake harness and forge
- [x] `npm run validate` and `npm test` pass

## Comments

Done. The verifier and both reviewers share one fresh read-only checkout of the pushed head, separate from the implementer's. Patch identity excludes `.scratch/`, so tracker edits never invalidate a verdict. Failures hand the ticket to the human for now; ticket 07 adds the fix rounds that the loop already counts.
