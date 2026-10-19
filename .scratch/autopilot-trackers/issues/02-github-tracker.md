# 02: GitHub tracker adapter

**What to build:** autopilot builds a spec issue's sub-issues on GitHub: blockers from native dependencies (body fallback), status from labels, a claim comment lock, handoff comment and close after merge, Closes #N in the pull request.

**Blocked by:** 01

**Status:** ready-for-agent

**Door:** two-way

- [ ] Adapter tests against an in-memory GitHub API: listing, claim race, hand to human, close
- [ ] One orchestrator run on a fake GitHub reaches merged with the handoff posted
