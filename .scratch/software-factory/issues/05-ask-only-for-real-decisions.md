# 05: Ask the developer only for real decisions

**What to build:** the developer is asked only for decisions and can answer on GitHub or in Orca. A plan with a product question holds its ticket; one-way doors and protected paths get `factory:hold` and wait; a worker that blocks on a permission prompt or a question reaches the coordinator at once and is either answered from the brief and the plan or turned into a brief for the developer; a red trunk stops merges with at most one fix task; a required check that never reports is raised as unknown and files nothing.

**Blocked by:** 03

**Status:** ready-for-agent

**Door:** two-way

- [ ] A plan with a product question holds its ticket with a brief on the ticket and an unread mark in Orca, and the answer releases it, while other tickets keep moving.
  Verify: a sandbox ticket with an open product choice beside an ordinary ticket; the ordinary one merges; the held one shows a brief and an unread mark; answer on the ticket; the next wake builds it.
- [ ] A one-way door or a change to a protected path never merges automatically.
  Verify: one sandbox ticket planned as one-way and one touching a protected path; after green checks both carry `factory:hold` and stay open; removing the label lets the next wake merge.
- [ ] A worker blocked on a permission prompt or a question is handled within one wake.
  Verify: start a worker that hits a permission prompt; the coordinator receives a `blocked` event and answers it or flags the developer before the next timeout.
- [ ] While trunk is red nothing merges and at most one fix task runs.
  Verify: break trunk in the sandbox; green pull requests stay open; exactly one fix ticket exists; after the fix merges, the waiting pull requests merge.
- [ ] A required check that never reports produces one brief saying CI is unknown, and no fix ticket.
  Verify: name a required check that never runs; after the wait the playbook allows, one brief exists and no fix ticket was filed.
