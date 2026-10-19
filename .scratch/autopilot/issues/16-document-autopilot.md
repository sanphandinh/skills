# 16: Document autopilot as the unattended path

**What to build:** a reader of this repo learns that `autopilot` is the main path for unattended builds, how the two human gates work, and how to set role models per project on each harness.

**Blocked by:** 11, 12, 13, 14, 15

**Status:** ready-for-agent

- [ ] `AGENTS.md` lists `autopilot`, `setup-verification`, and the new agents, and places `autopilot` beside `implement-spec`
- [ ] `PLATFORMS.md` explains running autopilot on Claude Code and Oh My Pi, including role-model configuration per project
- [ ] `templates/` gains example per-project role configuration for both harnesses
- [ ] `README.md` describes the two gates and the merge policy in a few lines
- [ ] `npm run validate` passes
