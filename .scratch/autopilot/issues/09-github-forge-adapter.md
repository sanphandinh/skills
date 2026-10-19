# 09: GitHub forge adapter pinned to the configured repository

**What to build:** autopilot opens, reads, comments on, and merges real GitHub pull requests through `gh`, always against the repository recorded in the tracker config, never a second remote such as `upstream`.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Every forge operation passes the configured repository explicitly
- [ ] The tracker config records the repository pull requests go to
- [ ] CI status and pull request head are read from GitHub; a merge is confirmed by reading the pull request back, not by the command's exit code
- [ ] Force-push touches only the run's own ticket branch, with a lease pinned to the last pushed head
- [ ] An opt-in smoke test exercises read-only calls against the configured repository; it is skipped in the default suite
- [ ] Tests prove a forge call can never target an unconfigured repository
- [ ] `npm run validate` and `npm test` pass
