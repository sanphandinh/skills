# 09: GitHub forge adapter pinned to the configured repository

**What to build:** autopilot opens, reads, comments on, and merges real GitHub pull requests through `gh`, always against the repository recorded in the tracker config, never a second remote such as `upstream`.

**Blocked by:** 05

**Status:** closed

- [x] Every forge operation passes the configured repository explicitly
- [x] The tracker config records the repository pull requests go to
- [x] CI status and pull request head are read from GitHub; a merge is confirmed by reading the pull request back, not by the command's exit code
- [x] Force-push touches only the run's own ticket branch, with a lease pinned to the last pushed head
- [x] An opt-in smoke test exercises read-only calls against the configured repository; it is skipped in the default suite
- [x] Tests prove a forge call can never target an unconfigured repository
- [x] `npm run validate` and `npm test` pass

## Comments

Done. A repository with no CI checks reads as passing CI; every other gate still applies. The smoke test runs only with `AUTOPILOT_SMOKE_GH=1` and makes read-only calls.
