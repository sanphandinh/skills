# 10: Frontier and dependent tickets with handoff

**What to build:** a spec with several tickets runs in dependency order: a ticket starts only after every blocker has merged to trunk, and its implementer reads its blockers' handoffs before starting.

**Blocked by:** 05

**Status:** closed

- [x] The frontier is computed from merged state on trunk, not from closed flags alone
- [x] A dependent ticket's branch is cut from trunk after its blockers merged; no stacked pull requests
- [x] The implementer prompt points at every blocker's handoff
- [x] A handoff that contradicts the ticket is followed and recorded; one that touches the ticket's acceptance criteria makes the ticket `ready-for-human`
- [x] A ticket whose blocker went to `ready-for-human` stays blocked and is reported as such
- [x] Tests cover A then B, a contradiction, and a blocker handed to the human
- [x] `npm run validate` and `npm test` pass

## Comments

Done. A followed divergence is posted on the pull request as "Handoff divergence"; ticket 13 also writes it to the decision trail.
