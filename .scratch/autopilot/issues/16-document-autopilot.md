# 16: Document autopilot as the unattended path

**What to build:** a reader of this repo learns that `autopilot` is the main path for unattended builds, how the two human gates work, and how to set role models per project on each harness.

**Blocked by:** 11, 12, 13, 14, 15

**Status:** closed

- [x] `AGENTS.md` lists `autopilot`, `setup-verification`, and the new agents, and places `autopilot` beside `implement-spec`
- [x] `PLATFORMS.md` explains running autopilot on Claude Code and Oh My Pi, including role-model configuration per project
- [x] `templates/` gains example per-project role configuration for both harnesses
- [x] `README.md` describes the two gates and the merge policy in a few lines
- [x] `npm run validate` passes

## Comments

Done. Plugin versions bumped (core 0.3.0, software 0.4.0, software-claude 0.2.0, software-omp 0.2.0) so installed caches refresh. ROLES.md now maps `judge` to OMP's built-in `@judge`, the role judged rules actually call.
