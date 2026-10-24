# 07: Fix-round cap and per-ticket budgets

**What to build:** a failed verification or a hard review finding sends the ticket back to a fresh implementer as one consolidated fix round, at most twice, and a ticket that exceeds its time or token ceiling stops, so a run can never loop for hours.

**Blocked by:** 05

**Status:** closed

- [x] Each fix round spawns a fresh implementer whose prompt points at the original ticket, every earlier finding, and the prior branch
- [x] After two fix rounds the ticket becomes `ready-for-human` with the outstanding findings listed; no third round starts
- [x] Time and token ceilings are configurable per run with sensible defaults; exceeding one makes the ticket `ready-for-human`
- [x] Per-machine counters live in a state directory outside the repository
- [x] Tests cover two failed rounds, a fix that passes on round two, and a budget breach
- [x] `npm run validate` and `npm test` pass

## Comments

Done. Defaults: 2 fix rounds, 3M tokens and 2 hours per ticket, overridable with `--max-tokens` and `--max-minutes`. An attempt with no handoff, or one the implementer reports as failed, gets a fix round before any reviewer runs.
