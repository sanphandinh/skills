# 12: Unattended ticket split with a large-spec stop

**What to build:** autopilot can start from a spec that has no tickets yet: `to-tickets` splits it without quizzing, records why, and orders low-risk foundation work first, unless the spec is large, in which case the tickets wait for the human's approval.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `to-tickets` has an unattended mode with no quiz; its breakdown reasoning goes to the decision trail
- [ ] Tickets are ordered with foundation and low-risk work first and one-way-door work last
- [ ] A spec is large when it has more than five tickets, any one-way-door ticket, or a ticket blocking three or more others; then tickets are written with `Status: needs-triage` and the run stops with a message saying what to approve
- [ ] Re-running after the human sets the tickets to `ready-for-agent` proceeds without re-splitting
- [ ] The interactive mode of `to-tickets` is unchanged
- [ ] Tests cover a small spec split and run, and a large spec stopping then resuming
- [ ] `npm run validate` and `npm test` pass
