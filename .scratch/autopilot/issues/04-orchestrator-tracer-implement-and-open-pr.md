# 04: Orchestrator tracer bullet: claim, implement, open a pull request

**What to build:** invoking the `autopilot` skill (or its CLI directly) on an approved one-ticket spec claims the ticket, runs a fresh implementer that builds it with `tdd`, writes the ticket's handoff and closing status on the ticket branch, and opens a pull request. The harness and the forge are ports, exercised here through scripted fakes.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The `autopilot` skill is user-invoked on every platform and only checks preconditions and calls the CLI
- [ ] The CLI's one public operation runs a spec; it refuses a spec whose status is not `ready-for-agent`
- [ ] The ticket is claimed with a tracker-only commit before work starts
- [ ] The ticket branch is cut from current trunk; the implementer prompt points at the spec and ticket rather than pasting them
- [ ] The handoff section and the closing status are committed on the ticket branch, not on trunk
- [ ] A pull request is opened on the fake forge with a body written by the `pr` skill, including Merge Danger
- [ ] Tests drive one run through the public operation against a temporary git repository and `.scratch/` tracker, asserting only observable outcomes
- [ ] `npm run validate` and `npm test` pass
