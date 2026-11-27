# End-to-end run on the sandbox

`factory run` on `sanphandinh/factory-ticket-sandbox` from 2026-11-27 06:45Z, skill from branch `refactor/factory-per-ticket` (read live from this worktree, so fixes made during the run apply from the next turn that reads them). Settings: `Max workers: 1`, `Max tickets: 2`, `Wake timeout: 5 minutes`, `Required checks: test`, `Trunk checks: test`. Watcher: schedule `factory watch: factory-ticket-sandbox` (every 5 min), thread `0a080121…` on Haiku 5.5 low after its first run.

## Timeline and findings

- 06:45:46Z watcher run 1 (Opus, the environment's default until reconfigured): fingerprint changed → lock → launched dispatcher `f1a75c94…`.
- 06:46:36Z **FAIL → fixed**: that dispatcher (Haiku) declined its first message ("labeled as coming from another T3 agent … not from you"). Fix `5b2da6b`: setup writes a `### Factory` sub-block into the project's `AGENTS.md`; first messages name the automation that sent them. Sandbox `AGENTS.md` got the block (commit `f1f03b9`).
- 06:51:10Z watcher run 2: lock held by the ended dispatcher; **FAIL → fixed**: the watcher read "then reclaim" as part of the quota branch and stopped. Fix `68e2d75` (step 3 split into three cases).
- 06:56:21Z watcher run 3: reclaimed the lock, launched dispatcher `a83d40e4…` (Haiku). **PASS: a failed dispatcher run is retried by the next watcher run.**
- 06:56–06:57Z dispatcher `a83d40e4…`: claimed #4 and #5 (claim tokens, `## Factory claim` comments), launched coordinators `factory #4 upper-command` (`efa604ac…`) and `factory #5 readme-commands` (`0b3bc0bf…`), each in its own worktree (`factory-4-upper-command-…`, `factory-5-readme-comman-…`), journal line, lock released. **PASS: one worktree per ticket.** Two defects: it wrote a prose `wake-fingerprint` instead of the hash (every later watcher run would see a change), and archiving its own thread ended its run with "provider event stream closed". Fix `6215e9e`.
- 06:58Z **FAIL → fixed**: coordinator #5 started its plan worker without `res acquire slot` while #4 held the only slot: two workers at once with `Max workers: 1`. Fix (this commit): every worker start goes through **Starting a worker**.
