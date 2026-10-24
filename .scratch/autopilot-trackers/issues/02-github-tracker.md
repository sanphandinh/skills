# 02: GitHub tracker adapter

**What to build:** autopilot builds a spec issue's sub-issues on GitHub: blockers from native dependencies (body fallback), status from labels, a claim comment lock, handoff comment and close after merge, Closes #N in the pull request.

**Blocked by:** 01

**Status:** closed

**Door:** two-way

- [x] Adapter tests against an in-memory GitHub API: listing, claim race, hand to human, close
- [x] One orchestrator run on a fake GitHub reaches merged with the handoff posted

## Handoff

**Delivered:** `githubTracker` over an injected REST transport (`ghApi` in production); `createTracker` picks the adapter from the `Tracker:` line.
**Interfaces introduced:** `claims.mjs` (`holder`, `claimWith`, `claimBody`, `releaseBody`) and `labels.mjs` (`labelMap`, `roleOf`) for every remote adapter; `fakeGitHub()` in the test helpers.
**Deviations from spec:** claims do not set an assignee: one `gh` login cannot tell machines apart, so the comment lock alone decides.
**Decisions:** a sub-issue closed as not planned reads as `wontfix`, not `closed`, so it never unblocks a dependent.
**Gotchas:** branch names use the spec key (`autopilot/gh-<spec>/<issue>`).
**For the next ticket:** 03: copy the shape, swap REST paths for GitLab; 04: same claim and label helpers, statuses come from Jira workflow names instead of labels.
