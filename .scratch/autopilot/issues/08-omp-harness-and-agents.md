# 08: Oh My Pi harness adapter and the implementer and verifier agents

**What to build:** autopilot runs its roles through Oh My Pi in non-interactive mode, with role models resolved by OMP's role system, and the `implementer` and `verifier` agents exist for OMP and Claude Code. After this ticket and ticket 09, slice 1 runs for real.

**Blocked by:** 05

**Status:** closed

- [x] The OMP adapter runs a role non-interactively with JSON output and maps it to the harness port's result
- [x] `implementer` and `verifier` agents exist in the OMP plugin (typed output for the verifier) and the Claude plugin, with the same names
- [x] `ROLES.md` gains a custom `verifier` role with an OMP fallback; implementer uses `worker`, reviewers use `reviewer`
- [x] Agent prompts carry the always-pause list (force-push to shared branches, deploys, data deletion, customer messages)
- [x] An opt-in smoke test runs a trivial role through a real `omp`; it is skipped in the default suite
- [x] `npm run validate` and `npm test` pass

## Comments

Done. The adapter runs one `omp -p --mode json --auto-approve` session per role and asks it to delegate to the named agent, so the agent definition picks the model through its role. Adapter tests run against a stand-in executable; the real-omp smoke test runs only with `AUTOPILOT_SMOKE_OMP=1`. On Claude Code the verifier is `opus` and the implementer `inherit`; ticket 14 runs the parent session on a different alias so the implementer never shares the reviewers' model.
