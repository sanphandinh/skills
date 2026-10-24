# 05: Tracker configuration in setup and docs

**What to build:** setup-software-context writes the structured Tracker line (and Jira statuses) and the docs explain running autopilot on each tracker.

**Blocked by:** 02, 03, 04

**Status:** closed

**Door:** two-way

- [x] The tracker templates carry the structured lines
- [x] PLATFORMS.md and the autopilot skill describe all four trackers

## Handoff

**Delivered:** every tracker template carries a `Tracker:` line (a test reads each one); a new Jira template adds `Pull requests:` and `Jira statuses:`; setup, the autopilot skill, PLATFORMS.md, and AGENTS.md describe all four trackers.
**Interfaces introduced:** `issue-tracker-jira.md` seed template.
**Deviations from spec:** none.
**Decisions:** plugin versions bumped (software 0.5.0, software-claude and software-omp 0.3.0).
**Gotchas:** projects set up before this change have no `Tracker:` line and keep working as local.
**For the next ticket:** none; the spec is done.
