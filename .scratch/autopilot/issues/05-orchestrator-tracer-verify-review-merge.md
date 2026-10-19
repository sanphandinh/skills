# 05: Orchestrator tracer bullet: independent verify, review, merge

**What to build:** after the pull request opens, a verifier that did not write the code checks the pull request head and returns a typed verdict tied to the patch it checked, the Spec and Standards reviewers review the diff independently, and a ticket that passes every gate is merged and its pull request reads merged on trunk.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The verifier runs as a separate role from the implementer and returns `PASS`, `PASS+NOTES`, or `FAIL` with evidence and the patch identity it checked
- [ ] The verdict and the review findings are posted on the pull request so another machine can read them
- [ ] `review-spec` and `review-standards` run as separate roles; neither is the implementer
- [ ] The implementer never runs `code-review` on its own work inside autopilot
- [ ] A ticket with a passing verdict, no hard findings, and green CI is merged; its handoff and closing status are on trunk after the merge
- [ ] Tests cover the happy path through the public operation with fake harness and forge
- [ ] `npm run validate` and `npm test` pass
