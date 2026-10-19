# 03: GitLab tracker and forge adapters

**What to build:** the same on GitLab issues and merge requests through glab api.

**Blocked by:** 01

**Status:** closed

**Door:** two-way

- [x] Adapter tests against an in-memory GitLab API
- [x] The GitLab forge opens, checks, and merges a merge request pinned to the configured project

## Handoff

**Delivered:** `gitlabTracker` and `gitlabForge` over an injected REST v4 transport (`glabApi` in production); `Pull requests: gitlab <group>/<project>` and a GitHub or GitLab `Tracker:` line both select the forge.
**Interfaces introduced:** `fakeGitLab()` in the test helpers.
**Deviations from spec:** none.
**Decisions:** a merge request with no pipeline reads as passing CI, like a GitHub repo with no checks.
**Gotchas:** `glabApi` sends flat bodies as fields; nested bodies are not supported.
**For the next ticket:** 04: Jira needs its own transport (fetch) and a Pull requests line, since Jira is never the forge.
