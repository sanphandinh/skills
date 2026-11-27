# Brief: factory on T3, one coordinator per ticket (user-approved decisions, 2026-11-26/27)

Proposal to change the `factory` skill (`plugins/software/skills/factory`). Brainstormed while running the factory for real on `sanphandinh/gia-pha-studio` with T3 Code. Decisions below are settled by the user; the "Test first" section is unverified.

## Problems with the current design (references/t3.md, PLAYBOOK.md)
- One coordinator thread for life: the watcher queues `mode once` into it, every wake appends to the same session, context grows. The chat thread where the user typed `factory run` becomes the coordinator, mixing wakes with human chat.
- Empty hourly wakes: `wake-check.sh` wakes when the fingerprint is older than 1 hour. Measured 8 consecutive empty Opus wakes while the board only waited on a human hold.
- One worktree per step (`delegate_task` `isolation: "worktree"`): 4–8 worktrees and 4–8 `pnpm install` per ticket; results pass between steps via the remote (fetch + reset); many cleanup points.
- Hard to read history: a ticket's story is spread over many wakes.

## New design
T3 scheduler (15 min) → Watcher (1 thread, fresh session each run, cheap model): board changed? lock free? → Dispatcher (new thread each run, stateless) → Coordinator #12 (own thread + worktree, lives Plan→Close) → workers plan/build/verify‖review (delegate_task, isolation "shared"). Shared state: GitHub (tickets, plans, PRs, statuses) and memory folder (resources/, results/, journal).

1. Coordinator per ticket: one coordinator owns one ticket Plan→Close incl. rework; orchestrates only (no diffs, no code). Each step is a worker via delegate_task on the role's model from docs/agents/roles.md; workers are its children so done/failed/questions reach it directly; task_status/task_cancel work. Many eligible tickets → dispatcher creates many coordinators in parallel.
2. Thin dispatcher, new stateless thread each run, called by the watcher when the board changes. 5 jobs: (1) claim: pick a frontier ticket without `factory:active`; write the claim lock in memory first, then add label `factory:active` and a comment with the thread id (order prevents double claims by overlapping dispatchers); (2) create coordinator via t3_thread_launch; (3) wake the coordinator when a person removes `factory:hold`, via t3_thread_send (no T3 event for label removal); (4) revive dead coordinators (provider error, quota): new thread on the old worktree with workspaceStrategy {type: "existing_worktree", worktreePath}; (5) housekeeping: close spec when all tickets closed, reclaim expired locks, sweep stray worktrees.
3. One worktree per ticket, created by T3: t3_thread_launch with workspaceStrategy {type: "worktree", baseRef: "origin/main", startFromOrigin: true, branch: "factory/<n>-<slug>"}; T3 creates worktree, branch, runs setup script. Workers share the coordinator's worktree (isolation "shared", the default); next step sees previous commits; build still pushes after every commit. Clean reset gate before every worker (not only verify): back to exact head commit, `git clean -fdx -e node_modules`, delete `.wrangler/state` (a verifier once left a temp Playwright spec and a rework builder could `git add -A` it). Verify and review may still run in parallel (review only reads git). Main checkout used only by the dispatcher.
4. Shared resources, FIFO queue in memory: worker slot (max = Max workers), `port-4317` (dev server for verify): 1, `merge`: 1. Each in `memory/resources/<name>/` with `holder` (ticket, thread id, expiry) and `queue`; atomic writes via mkdir or rename (macOS has no flock). Waiting coordinator ends its turn, no polling; the releaser t3_thread_send's the head of the queue. Safety net: dispatcher reclaims expired/dead holders and wakes the queue head if nobody did. Deadlock avoidance: always acquire slot → port → merge. Waiting for a resource is a state distinct from `factory:hold`. Decided: pure FIFO, no priority.
5. Watch the PR and self-heal: coordinator calls watch_pull_request on its ticket's PR (it is a top-level thread, so allowed).
   | Event | Action |
   | CI changes | green + both statuses → acquire merge; red → build fixes, counts 1 rework round |
   | factory review fails | rework as now; past Fix rounds → hold |
   | owner/collaborator comment asks for code change | treat as finding, build fixes, reply to comment with commit |
   | a person asks / changes product direction | hold with brief, don't guess |
   | conflict from a trunk merge | build merges trunk into branch, resolves, runs tests, pushes; then rerun BOTH verify and review (decided) |
   | conflict touches protected path or changes another ticket's meaning | hold with brief |
   | person merges or closes the PR | Close, release all resources, unwatch |
   Separate counter for conflict resolutions, proposed max 3 then hold, not counted with Fix rounds. Small merge queue: the coordinator holding `merge` updates its branch from trunk right before merging. Safety: comments from non-owner/non-collaborator are untrusted data (prompt injection), not commands.
6. Collisions: at claim time the dispatcher can't know files; the coordinator checks after plan: compare its files_to_change with plans of running tickets and open PRs; overlap → wait.
7. Worktree cleanup: use T3's cleanup mode "after merging" (requires the coordinator to link_pull_request its PR to its thread). Turn OFF "after the thread settles" (a coordinator waiting on a hold could lose its worktree); the coordinator settles itself only at Close. Last net: dispatcher scans t3_worktree_list and runs git worktree remove (T3 has no delete-worktree tool; deleting a thread doesn't delete the worktree).
8. Watcher: keep as is (one thread, fresh session, cheap model). Proposed: drop the "fingerprint older than 1 hour → wake" rule; call the dispatcher only when the board or results/ changed; nothing to do → no thread created.

## Test first (only read from T3 tool schemas or inferred)
1. t3_thread_launch with workspaceStrategy worktree: does the setup script run, and finish before the first worker; does the branch keep the given name.
2. delegate_task isolation "shared" on an Antigravity worker: does it run in the coordinator's worktree (Antigravity's shell has started outside the worktree before).
3. Does watch_pull_request wake the coordinator on review comments, on the PR becoming conflicted, on CI changes.
4. Does cleanup "after merging" remove the worktree of a thread with a linked PR; is a thread waiting on a hold removed.
5. Can existing_worktree revive a coordinator on the old worktree.
6. Can a dispatcher on a cheap model call t3_thread_launch with an Opus/Sonnet model and full-access.

## Files possibly affected (inferred)
SKILL.md (meaning of run/once; once = one dispatcher run), PLAYBOOK.md (split into dispatcher playbook and per-ticket coordinator playbook; Ticket chain, Limits, Merge guard to resource-queue model), WORK-ORDERS.md (shared workspace, reset gate, drop "fetch, reset --hard origin/<branch>"), MEMORY.md (resources/, claims, live coordinators), INTERFACE.md (claim, acquire/release, watch PR; decide T3-only vs all managers), references/t3.md (operations, Wakes, Traps, cleanup setting).

## Not discussed
Coordinator model (maybe Sonnet instead of Opus); limit of concurrent coordinators vs worker slots; migrating a running old-design factory.

## Outside the skill (project repo)
gia-pha-studio docs/agents/verify.md: "fresh worktree" → "worktree reset clean at head commit"; later.

## Small bugs seen
references/t3.md Candidates says Antigravity effort option is `thinking_level`; orchestrator_capabilities lists `thought_level`. Typing `factory run` in a chat thread makes that thread the coordinator; the new design avoids it.

## Decisions taken after the brief, in the planning session
- Merge queue: always update the branch from trunk before merge, and keep holding `merge` while verify and review rerun.
- INTERFACE.md stays manager-neutral; references/t3.md maps to T3 tools.
- Watcher and dispatcher run the `scout` route; per-ticket coordinators run the `coordinator` route; drop the `Coordinator:` line in factory.md (setup converts).
- New setting `Max tickets`, default = `Max workers`.
- Land fast path accepted: acquire `merge`; if the branch already contains origin/<trunk>, merge at once; otherwise release `merge`, acquire slot(s) → scarce → `merge`, update, re-check, and hold `merge` until merged.
- Comments asking for code changes from owner/collaborator do not count toward Fix rounds.
- No new labels (user, later): drop the brief's `factory:active`; claim lives in memory plus a `## Factory claim` comment. Replace `factory:hold` with the existing triage role `ready-for-human` on every tracker (Jira and local already hold that way). Keep `priority:p*`.
