# Feature

New or changed behaviour. You own the design: plan, review and verify; delegate the building.

1. Read the subsystem the feature touches, `GLOSSARY.md` and the ADRs in the area.
2. When the request is unclear, run the `grilling` skill until the behaviour and its edges are agreed. New or fuzzy domain terms go through the `domain-modeling` skill.
3. When the work needs more than one ticket, run the `spec` playbook instead and stop here.
4. When a design fork can be settled by building something cheap, run the `prototype` skill before planning.
5. For a module whose interface is new or changing shape, run the `codebase-design` skill.
6. Run the `ticket` playbook for the feature. It plans with the `plan-ticket` playbook, builds test-first, self-checks, and sends the change to the `verify` and `review` playbooks in fresh workers.
7. When the design is contested after review, take it back to the user with the options and your recommendation.

**Reply:** what now works for the user, the decisions and why, the verify and review verdicts with their commit, open decisions, and the pull request link. Tables for design alternatives.
