# 04: Orchestrator tracer bullet: claim, implement, open a pull request

**What to build:** invoking the `autopilot` skill (or its CLI directly) on an approved one-ticket spec claims the ticket, runs a fresh implementer that builds it with `tdd`, writes the ticket's handoff and closing status on the ticket branch, and opens a pull request. The harness and the forge are ports, exercised here through scripted fakes.

**Blocked by:** 03

**Status:** closed

- [x] The `autopilot` skill is user-invoked on every platform and only checks preconditions and calls the CLI
- [x] The CLI's one public operation runs a spec; it refuses a spec whose status is not `ready-for-agent`
- [x] The ticket is claimed with a tracker-only commit before work starts
- [x] The ticket branch is cut from current trunk; the implementer prompt points at the spec and ticket rather than pasting them
- [x] The handoff section and the closing status are committed on the ticket branch, not on trunk
- [x] A pull request is opened on the fake forge with a body written by the `pr` skill, including Merge Danger
- [x] Tests drive one run through the public operation against a temporary git repository and `.scratch/` tracker, asserting only observable outcomes
- [x] `npm run validate` and `npm test` pass

## Comments

Done. The CLI also has `--dry-run` (frontier only, no writes). Harness and forge factories are stubs until tickets 08, 09, and 14 add real adapters.
