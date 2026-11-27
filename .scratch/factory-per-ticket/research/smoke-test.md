# Setup smoke test on the sandbox

`factory setup` (the new `SETUP.md`) on `sanphandinh/factory-ticket-sandbox`, 2026-11-27, T3 Code 0.1.12. Skill from branch `refactor/factory-per-ticket` (paths under this worktree). Settings committed to the sandbox's `main`: `docs/agents/factory.md` (`Max workers: 1`, `Max tickets: 2`, `Wake timeout: 5 minutes`, `Required checks: test`, `Trunk checks: test`, `Reset keeps: none`) and `docs/agents/roles.md` (5 roles). Memory: `~/.local/share/factory/factory-ticket-sandbox`.

Before the first wake: the T3 project's only setup script has `runOnWorktreeCreate: true, async: false`; the project's worktree cleanup is custom (written for the spike; for the real recommendation see `references/t3.md`); every thread was launched `full-access`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | launch-coordinator | PASS | thread `factory #0 smoke` (`mcp:launch:bd4f8dd9…44e1`), Sonnet 5.5 low; `smoke-coordinator.json`: `pwd` = `…/factory-smoke-27921ceec2183adf`, branch `factory/smoke`, `.setup-ran` 06:29:36Z before its first command at 06:29:43Z; snoozed at once |
| 2 | start-worker, send, inspect | PASS | `smoke.json`: model `claude-sonnet-5-5`, `pwd` = the coordinator's workspace, answer `beta`, follow-ups `["Record the word gamma."]`; inspect `running/working` while it waited |
| 3 | send from another session | PASS | "factory smoke: reply pong" → run 12 answered `pong` (06:39:12Z) |
| 4 | flag-human and clear | PASS | `pin` + rename `⏸ #0 smoke` → `pinned: true`, title shown; clear: `unpin`, rename `factory #0 smoke`, `snooze` |
| 5 | link-pr, watch-pr, unwatch-pr | PASS | draft PR #3 opened and watched by the coordinator; closed from this session 06:39:54Z; the coordinator's run 14 started 06:40:08Z with "#3: closed, stopped watching", then `unwatch_pull_request`. T3 then marked the thread settled (06:40:11Z); the next message unsettled it |
| 6 | revive, stop-worker | PASS | coordinator started `0 smoke sleeper` (Haiku, 5-minute `until` loop); thread `factory #0 smoke revive` (`existing_worktree`) saw `pwd` and branch `factory/smoke`, `task_status` → `task_not_found`, the sleeper's thread `running`, `t3_thread_interrupt stop` → `interrupted` |
| 7 | launch-dispatcher with the lock | PASS after a fix | first try: the dispatcher read `res lock show` before the launcher wrote its id (`thread: null`), which would have made a real dispatcher stop; fixed with a lock token (commit `c983a8d`). Second try (`mcp:launch:6b32f7d0…182a`): it saw `thread` empty and its token, wrote its id; the launcher wrote the same id |
| 8 | schedule-wakes | PASS | schedule `factory smoke wake` every minute; run at 06:31:06Z on thread `a343887e…` answered `pong`; schedule deleted |
| 9 | providers | PASS for all 7 candidates | `providers.md` below; files in `results/` |
| 10 | close-workspace | PASS | scratch commit `2214cc5` unpushed → push check refused; after `reset --hard origin/factory/smoke` it passed; `git worktree remove`, `git branch -D factory/smoke`, remote branch deleted; sessions archived |

`providers.md` written:

```
anthropic/claude-sonnet-5-5 | asks: yes (by message) | files: tool | result: PASS 2026-11-27 | worker and session checks
cursor/composer-2.5 | asks: yes (by message) | files: tool | result: PASS 2026-11-27 | worker check
google/gemini-4-neon via=antigravity | asks: yes (question tool, answer by option value) | files: shell | result: PASS 2026-11-27 | worker check
google/gemini-4-hydrogen via=antigravity | asks: yes (question tool, answer by option value) | files: shell | result: PASS 2026-11-27 | worker check
xai/grok-4.7 via=cursor | asks: no | files: tool | result: PASS 2026-11-27 | worker check
anthropic/claude-haiku-5-5 | asks: n/a | files: tool | result: PASS 2026-11-27 | session check
google/gemini-3.8-flash via=antigravity | asks: n/a | files: shell | result: PASS 2026-11-27 | session check
```

Found while running it, and fixed in the skill:

- **The dispatcher lock raced its launcher** (check 7): fixed with a lock token (`resources.mjs lock acquire` prints it, the first message carries it). Also: an expired lock is no longer taken without `--reclaim`, so a dispatcher still running past `Wake timeout` is not doubled.
- **Antigravity questions need the option's `value`**: the coordinator answered `{"q1": "alpha"}` and the workers read "User Skipped"; a direct test answered `{"q1": "1"}` and the worker read `alpha` (thread `ag question format test`). Written into `references/t3.md`, **Events**.
- **Claude and Cursor workers ask by message** (they send their coordinator a message instead of a question tool); the coordinator answers with send.
