# 14: Claude Code harness adapter

**What to build:** autopilot runs its roles through Claude Code in non-interactive mode, with the implementer and reviewers on different model aliases, so the same run works on either harness.

**Blocked by:** 08

**Status:** closed

- [x] The Claude Code adapter runs a role non-interactively with JSON output and maps it to the harness port's result
- [x] Each role runs as its Claude agent, and the implementer's alias differs from the reviewers'
- [x] A run chooses its harness by name; the orchestrator code does not branch on harness beyond selecting the adapter
- [x] An opt-in smoke test runs a trivial role through a real `claude`; it is skipped in the default suite
- [x] `npm run validate` and `npm test` pass

## Comments

Done. The parent session runs on `sonnet`, so the `inherit` implementer differs from the `opus` reviewers and verifier; it runs with permission prompts bypassed because nobody can answer them, always inside a disposable worktree. The stand-in executables in the adapter tests are plain sh: a node stand-in crashed with SIGSEGV now and then under parallel test load.
