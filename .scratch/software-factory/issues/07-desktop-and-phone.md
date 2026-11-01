# 07: See and answer the factory from the desktop and the phone

**What to build:** every task shows in Orca with its worktree, a worker terminal titled `<ticket> <role>`, and a workspace status that follows the task (`in-progress`, `in-review`, `completed`); tasks waiting for the developer carry an unread mark. Orca's mobile companion shows the same, and the developer can answer a waiting worker or the coordinator from the phone.

**Blocked by:** 04, 05

**Status:** ready-for-agent

**Door:** two-way

- [ ] Each worker terminal is titled `<ticket> <role>` and each workspace status follows its task.
  Verify: during a sandbox run, `orca terminal list --json` and `orca worktree list --json` show the titles and the statuses changing with the steps.
- [ ] A task waiting for the developer carries an unread mark that clears once answered.
  Verify: trigger a hold; Orca marks that workspace unread; answer it; the mark clears on the next wake.
- [ ] The phone shows every task and can answer a waiting worker or the coordinator.
  Verify: pair Orca's mobile companion; answer a worker's question from the phone; the worker continues.
