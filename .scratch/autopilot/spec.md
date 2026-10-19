Status: ready-for-agent

# Autopilot: unattended build from an approved spec to merged pull requests

## Problem Statement

The software pipeline in this repo is clear: problem and requirements, then `grill-with-docs`, `to-spec`, `to-tickets`, `implement` with `tdd`, `code-review`, `pr`. Every step after the spec still needs a human to start it, carry context between sessions, decide what is unblocked, judge whether the work is done, and press merge. That makes the pipeline impossible to run unattended, and it spends the human's attention on steps that need no human judgement.

The existing `implement-spec` skill automates part of this, but its own upstream documentation records the failure modes of an agent-orchestrated run: a review-and-fix loop with no stop (one five-ticket feature took about four hours), implementers colliding at merge time, blocked tickets never starting, tests silently skipped inside worktrees, and one large pull request that is hard to review. Upstream states that truly unattended work is better served by a deterministic loop than by an agent making orchestration decisions.

Nothing in the current set proves a change works on the real product. "Self verification" today means the author's own tests passed. Review is also done by the agent that wrote the code, which is biased toward its own solution.

When several people work one spec, ticket B that depends on ticket A has no reliable way to learn what A actually built, where it deviated from the spec, or what traps it found.

## Solution

A human takes part in exactly two places:

1. **Gate 1: the spec.** The human clarifies the problem, grills the technical design with `grill-with-docs`, and approves a spec written by `to-spec` (with its test seams named). For a large spec the human also approves the ticket breakdown.
2. **Gate 2: risky pull requests.** The human reviews only the pull requests the merge policy refuses to auto-merge.

Everything between the gates runs unattended through a new user-invoked `autopilot` skill backed by a deterministic orchestrator script. Given an approved spec, autopilot splits it into tickets (or stops for approval when the spec is large), then for every ticket on the frontier runs a fresh implementer, an independent verifier that drives the real product, and two independent reviewers, opens one pull request per ticket on GitHub, and either auto-merges it or hands it to the human. When a ticket merges, its handoff note is already on the tracker for every ticket it unblocks. The same orchestrator runs the agents through Claude Code or Oh My Pi.

## User Stories

1. As a developer, I want to start an unattended build by invoking `autopilot` with a pointer to an approved spec, so that I do not have to call each skill by hand.
2. As a developer, I want to run the same build from a terminal or a CI job without a chat session, so that it can run while I am away.
3. As a developer, I want to choose the harness (Claude Code or Oh My Pi) per run, so that I can use whichever agent and models I have.
4. As a developer, I want autopilot to refuse to start on a spec whose status is not `ready-for-agent`, so that an unapproved spec never gets built.
5. As a developer, I want autopilot to split a small spec into tickets on its own and record why it split it that way, so that I am not pulled back in for routine breakdowns.
6. As a developer, I want autopilot to stop and ask me to approve the breakdown when a spec has more than five tickets, contains a one-way-door ticket, or has a ticket that blocks three or more others, so that I keep control of large or risky efforts.
7. As a developer, I want to approve a proposed breakdown by editing the tickets' status lines and re-running autopilot, so that approval uses the tracker vocabulary I already know.
8. As a developer, I want autopilot to order tickets so that low-risk foundation tickets come first and high-risk tickets come last, so that early tickets can auto-merge and unblock the rest.
9. As a developer, I want every ticket to get its own branch and pull request cut from the current trunk, so that each pull request is small and lands on its own.
10. As a developer, I want a ticket that depends on another ticket to start only after its blocker has merged to trunk, so that it is built on real merged code rather than a guess.
11. As a developer, I want independent tickets on the frontier to run in parallel, so that the build finishes sooner.
12. As a team member on another machine, I want to claim a ticket in a way that two people or two runs cannot both claim it, so that work is never duplicated.
13. As a team member picking up ticket B, I want to read the handoff notes of every ticket that blocked B before I start, so that I continue from what was actually built.
14. As the author of ticket A, I want my handoff note to state what was delivered, the interfaces I introduced, where I deviated from the spec and why, the decisions I made, the gotchas I found, and specific notes for each ticket I unblock, so that the next person does not repeat my discoveries.
15. As a team member, I want a handoff note to describe interfaces by name and behaviour rather than by file path and line, so that it stays true as the code moves.
16. As the implementer of ticket B, I want a clear rule for when A's handoff contradicts B's ticket, so that I neither guess nor silently diverge.
17. As a developer, I want the ticket's handoff note and its closing status to land in the same merge as its code, so that the tracker never claims work that is not on trunk.
18. As a developer, I want each implementer to build its ticket with the `tdd` skill at the seams the spec names, so that the rigour of the manual pipeline survives automation.
19. As a developer, I want the agent that verifies a change to be a different agent from the one that wrote it, so that the verdict is not the author checking what it meant to build.
20. As a developer, I want the verifier to drive the real product the way a user would, following my project's verification doc, so that a passing verdict means the behaviour works, not only that tests pass.
21. As a developer, I want each verdict to be `PASS`, `PASS+NOTES`, or `FAIL` with the evidence it observed, so that I can audit it.
22. As a developer, I want each verdict tied to the patch it checked, so that a verdict never authorises a merge of code it did not see.
23. As a developer, I want the change reviewed on the Spec axis and the Standards axis by reviewers that did not write it, so that review is independent and neither axis masks the other.
24. As a developer on Oh My Pi, I want the implementer, verifier, and reviewers to run on different model roles, so that the review benefits from model diversity.
25. As a developer on Claude Code, I want the same separation expressed through different model aliases, so that the behaviour matches across harnesses.
26. As a developer, I want any proven verification failure or hard review finding sent back to a fresh implementer as one consolidated fix round, so that fixes do not drop earlier directives.
27. As a developer, I want a ticket to get at most two fix rounds before it is handed to me, so that a run can never loop for hours.
28. As a developer, I want a per-ticket ceiling on time and token spend, so that one bad ticket cannot burn the budget.
29. As a developer, I want every pull request body written by the `pr` skill, including its Merge Danger section with door and blast radius, so that the merge decision has explicit risk facts.
30. As a developer, I want low-risk pull requests to merge automatically by default, so that I only review what matters.
31. As a developer, I want auto-merge to require a two-way door, an allowed blast radius, an independent verifier's `PASS` on the current patch, no hard review findings on either axis, and green CI, so that automatic merges are trustworthy.
32. As a developer, I want auto-merge to be impossible when my project has no verification doc, so that nothing merges that no agent actually ran.
33. As a developer, I want a default list of protected paths (migrations, infrastructure, CI configuration, dependency lockfiles, environment files) that always route to me, so that dangerous changes are never auto-merged.
34. As a developer, I want to add protected paths, and to remove a default one only with a written reason, so that the policy stays honest.
35. As a developer, I want every pull request the policy refuses to be marked `ready-for-human` with the reason, so that I know why it waits for me.
36. As a developer, I want autopilot to pause before any irreversible action (force-pushing a shared branch, deploying, deleting data, messaging customers), so that unattended does not mean unsafe.
37. As a developer, I want each ticket to keep a decision trail of what the agents decided and why, committed with the ticket, so that I can review the reasoning behind a pull request rather than trust a summary.
38. As a developer, I want a run to survive the machine dying, so that another run or another person can resume from the tracker and the pull requests.
39. As a developer, I want the orchestrator's per-machine bookkeeping kept outside the repository, so that it never dirties git.
40. As a developer, I want a final report when a run stops, listing what merged, what waits for me and why, and what is still blocked, so that I know where things stand at a glance.
41. As a developer setting up a project, I want a `setup-verification` skill that writes my project's verification doc with a feature map and the commands to drive the product, so that verifiers have something real to follow.
42. As a developer, I want every GitHub operation pinned to my own repository, so that a second remote such as `upstream` can never receive issues, pull requests, or merges.
43. As a developer, I want `implement-spec` to keep working unchanged, so that I can still choose one large pull request for a spec when I want it.
44. As a skill author in this repo, I want the shared skills to stay agent-neutral and the exact orchestration logic to live in a tested script, so that the repo's own rules hold.

## Implementation Decisions

### Modules

- **`autopilot` skill (shared, user-invoked).** A thin entry point. It checks preconditions, resolves the spec reference, and invokes the orchestrator CLI. It carries no orchestration logic. `disable-model-invocation: true` and `allow_implicit_invocation: false`.
- **Orchestrator CLI (script inside the `autopilot` skill, Node, no new runtime dependencies beyond what the repo already uses).** The deep module of this design. Its public interface is one operation, a run of a spec, taking the spec reference, the harness name, and options (dry run, concurrency, budgets). It owns the ticket state machine, frontier computation, claiming, fix-round counting, budget enforcement, the merge decision, and the final report. Agents are called only for work that needs judgement.
- **Harness port.** One operation: run a named role with a prompt in a working directory, returning success and the agent's structured output. Adapters: Claude Code (`claude -p` with JSON output), Oh My Pi (`omp -p --mode json`, with a per-run config overlay for role models), and a scripted fake for tests. Role-to-model resolution stays in the platform layer (`ROLES.md`, OMP `modelRoles`, Claude agent aliases); the orchestrator names roles only.
- **Forge port.** Operations: open a pull request, read CI status, read a pull request's head and body, post a comment, merge. Adapters: GitHub through `gh` with `--repo` always pinned to the repository recorded in the tracker config, and a fake for tests. A local-branch adapter can be added later without touching the orchestrator.
- **Tracker access.** Reads and writes the local markdown tracker described in `docs/agents/issue-tracker.md`. The tracker doc gains conventions it lacks today: an `Autopilot:` phase line, a `Claimed-by:` line, a `## Handoff` section, and a closing status. The triage `Status:` vocabulary is not extended with autopilot phases.

### Agents and roles

- Three agents with the same names on every platform: **implementer**, **verifier**, and the existing **review-spec** and **review-standards**.
- **implementer** builds one ticket with the `tdd` skill at the spec's seams, commits, writes the handoff note and decision trail, and opens nothing itself. It does not run `code-review` on its own work; review is a separate step.
- **verifier** is read-only on code. It checks out the pull request head in a fresh worktree, follows the project verification doc, and returns a typed verdict: `PASS`, `PASS+NOTES`, or `FAIL`, the evidence observed, and the patch identity it checked.
- Roles: implementer uses `worker`; verifier uses a new custom role `verifier` (OMP falls back to a built-in role); reviewers use `reviewer`. On Claude Code the implementer and reviewers use different aliases. `ROLES.md` gains the `verifier` role.
- Every agent spawn is fresh with consolidated scope (the ticket, the spec, blocker handoff notes, prior verdicts and findings as context pointers). No agent is resumed across fix rounds.

### Ticket state machine (per ticket)

`ready-for-agent` → claimed → implementing → pull request open → verifying → reviewing → merge-ready → merged (closed) or `ready-for-human`.

- A failed verification or a hard review finding sends the ticket back to implementing as a fix round. After two fix rounds the ticket becomes `ready-for-human`.
- Exceeding the time or token ceiling makes the ticket `ready-for-human`.
- The orchestrator computes the frontier from merged state on trunk, not from closed flags alone.

### Splitting tickets

- `to-tickets` gains an unattended mode: no quiz, breakdown reasoning written to the decision trail, tickets ordered with foundation and low-risk work first.
- In unattended mode the large-spec rule applies: more than five tickets, any one-way-door ticket, or any ticket blocking three or more others. When it triggers, tickets are written with `Status: needs-triage` and the run stops. The human edits statuses to `ready-for-agent` and re-runs.

### Branching and claiming

- Every ticket branch is cut from current trunk after all its blockers have merged. No stacked pull requests.
- Claiming is a small tracker-only commit (`Claimed-by:` and `Autopilot:` lines) pushed directly to trunk before work starts. A rejected push means someone else moved first: pull, recompute the frontier, pick again. The rejected push is the lock.
- The handoff section and the closing status are committed on the ticket's own branch, so they land in the same merge as the code.

### Handoff

- The `handoff` skill gains a ticket mode that writes the handoff template into the ticket file instead of the OS temp directory. Template sections: Delivered, Interfaces introduced, Deviations from spec, Decisions, Gotchas, For the next ticket (one entry per unblocked ticket), Links.
- Before starting, an implementer reads the handoff of every blocker. When a handoff contradicts its ticket, it follows the handoff (it reflects merged code) and records the divergence in its trail. When the contradiction touches the ticket's acceptance criteria, the ticket becomes `ready-for-human`.

### Verification

- New shared skill **`setup-verification`**, derived from pstack's `create-verification-skill` (MIT, credited). It writes the project's verification doc with a feature map and the commands that drive the product (CLI, HTTP, browser).
- Without that doc, verification falls back to tests, typecheck, and review, and auto-merge is disabled for the project.
- A verdict is valid only for the patch it checked. Before merge the orchestrator compares the verdict's patch identity with the current head; a mismatch requires a new verification.

### Merge policy

- A merge policy doc under `docs/agents/`; auto-merge is **on** by default.
- Mandatory gates, not configurable: verification doc present; independent verifier `PASS` or `PASS+NOTES` on the current patch; no hard finding on either review axis; green CI; Merge Danger door is two-way; blast radius within the allowed set; no file under a protected path.
- Default protected paths: database migrations, infrastructure, CI configuration, dependency lockfiles, environment files. A project may add paths; removing a default requires a reason written in the policy doc.
- A refused pull request gets `ready-for-human` on its ticket and a comment with the reason.

### Always pause

Force-pushing a shared branch, deploying, deleting data, and messaging customers always stop for the human, regardless of policy. Force-push of the run's own ticket branch uses a lease pinned to the last pushed head.

### State and records

- Shared state lives on the tracker (statuses, claims, handoffs) and on pull requests (verdicts, review findings, merge decisions), so another machine can resume.
- Per-machine bookkeeping (attempt counts, agent session ids, budget spend) lives in a state directory outside the repository and is never needed by another machine.
- Each ticket's decision trail is a TSV committed with the ticket.

### Delivery slices

1. One ticket end to end on Oh My Pi: implementer, verifier, reviewers, pull request, merge policy.
2. Many tickets: frontier, claiming, handoff, unattended splitting, fix-round and budget limits.
3. Claude Code adapter and the `setup-verification` skill.

## Testing Decisions

- A good test drives the orchestrator through its one public operation and asserts only observable outcomes: ticket files' status, claim, and handoff lines; branches and commits in a real git repository; pull requests opened, comments posted, and merges performed on the fake forge; the decision trail; the final report. Tests never assert on internal state.
- **Primary seam: one run of a spec.** Tests build a temporary repository with a real git history and a `.scratch/` tracker, use the scripted fake harness to play each agent's result, and the fake forge. Prior art: `cli/repo.test.mjs` (temporary directories, real `git` through `execFileSync`, `node:test`, `node:assert/strict`).
- **Harness port** and **forge port** are real seams (three and two adapters). The real Claude Code, Oh My Pi, and GitHub adapters get opt-in smoke tests that do not run in the default suite.
- The merge policy is tested through the primary seam, not as a separate unit.
- Scenarios the suite must cover:
  - One ticket passes every gate and auto-merges; its handoff and closing status are on trunk.
  - Ticket B blocked by A starts only after A merges, and B's implementer prompt points at A's handoff.
  - Two runs claim the same ticket; exactly one wins and the other picks another ticket.
  - Verification fails twice; the ticket becomes `ready-for-human` and no third round starts.
  - The time or token ceiling is hit; the ticket becomes `ready-for-human`.
  - No verification doc in the project; nothing auto-merges.
  - A verdict's patch identity differs from the current head; no merge until re-verified.
  - A pull request touches a protected path, or declares a one-way door; it routes to the human with the reason.
  - A large spec stops after writing `needs-triage` tickets; re-running after approval proceeds.
  - The spec is not `ready-for-agent`; the run refuses to start.
  - A forge call is always pinned to the configured repository.
- Repo checks after every change: `npm run validate` and `npm test`.

## Out of Scope

- GitHub Issues as the tracker for this repo (the design keeps tracker access behind the tracker doc, so it can come later).
- Local-branch merging without GitHub (the forge port allows it later).
- Codex agents (Codex cannot ship custom agents in a plugin today); a Codex harness adapter may follow.
- Deployments and anything after merge.
- Replacing or removing `implement-spec`, `implement`, or the manual pipeline.
- Multi-model fan-out beyond role separation (for example pstack's `interrogate` panels); a later spec may add it.
- A web dashboard; the final report and the tracker are the interface.

## Further Notes

- Source of the automation ideas: cursor/plugins `pstack` (MIT): independent verifiers, project verification skills, exit predicates, patch-id verdicts, decision trails, fresh subagents with consolidated scope, the always-pause list. Credit pstack wherever its material is adapted.
- Upstream `mattpocock/skills` documentation for `implement-spec` motivates the deterministic orchestrator, the fix-round cap, and the merged-state frontier.
- Known gotcha: in this repository `gh` resolves to the `upstream` remote (`mattpocock/skills`) unless told otherwise. Every forge call must pass the configured repository explicitly.
- Before slice 1, pull the upstream updates to `implement`, `implement-spec`, `code-review`, and `setup-software-context`, and fix the `rewrites` rule that turns `/tmp` into "the `tmp` skill".
- Worktrees hold only tracked files; a verification step that needs untracked fixtures or credentials must say so in the verification doc so the verifier runs it where they exist.
