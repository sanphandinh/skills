# 10: Frontier and dependent tickets with handoff

**What to build:** a spec with several tickets runs in dependency order: a ticket starts only after every blocker has merged to trunk, and its implementer reads its blockers' handoffs before starting.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The frontier is computed from merged state on trunk, not from closed flags alone
- [ ] A dependent ticket's branch is cut from trunk after its blockers merged; no stacked pull requests
- [ ] The implementer prompt points at every blocker's handoff
- [ ] A handoff that contradicts the ticket is followed and recorded; one that touches the ticket's acceptance criteria makes the ticket `ready-for-human`
- [ ] A ticket whose blocker went to `ready-for-human` stays blocked and is reported as such
- [ ] Tests cover A then B, a contradiction, and a blocker handed to the human
- [ ] `npm run validate` and `npm test` pass
