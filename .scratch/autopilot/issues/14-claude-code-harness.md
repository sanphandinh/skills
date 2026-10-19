# 14: Claude Code harness adapter

**What to build:** autopilot runs its roles through Claude Code in non-interactive mode, with the implementer and reviewers on different model aliases, so the same run works on either harness.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The Claude Code adapter runs a role non-interactively with JSON output and maps it to the harness port's result
- [ ] Each role runs as its Claude agent, and the implementer's alias differs from the reviewers'
- [ ] A run chooses its harness by name; the orchestrator code does not branch on harness beyond selecting the adapter
- [ ] An opt-in smoke test runs a trivial role through a real `claude`; it is skipped in the default suite
- [ ] `npm run validate` and `npm test` pass
