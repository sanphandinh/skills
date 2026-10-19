# 08: Oh My Pi harness adapter and the implementer and verifier agents

**What to build:** autopilot runs its roles through Oh My Pi in non-interactive mode, with role models resolved by OMP's role system, and the `implementer` and `verifier` agents exist for OMP and Claude Code. After this ticket and ticket 09, slice 1 runs for real.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The OMP adapter runs a role non-interactively with JSON output and maps it to the harness port's result
- [ ] `implementer` and `verifier` agents exist in the OMP plugin (typed output for the verifier) and the Claude plugin, with the same names
- [ ] `ROLES.md` gains a custom `verifier` role with an OMP fallback; implementer uses `worker`, reviewers use `reviewer`
- [ ] Agent prompts carry the always-pause list (force-push to shared branches, deploys, data deletion, customer messages)
- [ ] An opt-in smoke test runs a trivial role through a real `omp`; it is skipped in the default suite
- [ ] `npm run validate` and `npm test` pass
