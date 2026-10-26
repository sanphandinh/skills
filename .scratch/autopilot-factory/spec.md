Status: closed

# Autopilot as a continuous factory: one step per run, state on the pull request

## Problem Statement

Autopilot builds one approved spec at a time inside one long-lived process. That process walks every ticket from implement to merge, holds the findings, verdicts, round counts and handoff in memory, and polls CI while it waits. Three things follow:

- When the process dies (a closed laptop, a crash, a reboot), whatever it held in memory is lost, and the next run has to re-derive or redo work.
- It can only run while someone starts it and keeps a machine on. It finishes when the spec is done, so new work (a triaged bug, a red trunk, the next spec) waits until a human starts it again.
- Nothing watches trunk after a merge. A merge that breaks trunk is found by whoever notices next, and autopilot would happily merge more on top of it.

The developer wants autopilot to behave like a software factory: always taking work from the tracker, finishing what it started before starting more, slowing down when the human falls behind, stopping merges when trunk is red, and calling the human only with a decision-ready brief.

## Solution

Autopilot becomes a set of tasks (decompose, implement, gates, rework, merge, fix), each executed as a short run that reads the ticket's state from the tracker and the ticket's pull request, does one step, appends a run record to the pull request, and exits (ADR-0001). A tick looks at the whole tracker and every autopilot pull request, picks the next runs in a fixed priority (finish before starting), respects the project's limits, starts the runs, and exits.

`autopilot tick` is run by a scheduler on the developer's machine (cron or launchd) every few minutes, or by hand. `autopilot run <spec>` keeps working as a manual mode: it ticks over one spec until nothing is actionable, sleeping while only CI is pending, and prints the familiar final report. `autopilot status` shows the board at any time.

A draft pull request opens right after the first implementation and is the ticket's run log: gate verdicts per patch, findings, rounds, costs. A ticket's pull request becomes ready for review when its gates pass. Merges stop while trunk is red; a red trunk that survives a rerun files one fix ticket and, when it is safe, a revert pull request that a human merges with one click.

The project controls the factory through a new `docs/agents/autopilot.md`: a pause switch, how many tickets may be in flight, how many may wait for a human before autopilot stops starting new ones, fix-round and daily token limits, and which tasks are enabled.

## User Stories

### Running continuously

1. As a developer, I want to run `autopilot tick` from a scheduler every few minutes, so that work moves while I am away without a chat session open.
2. As a developer, I want each tick to look at every `ready-for-agent` spec and ticket on the tracker, so that I never have to point autopilot at a spec again.
3. As a developer, I want a `ready-for-agent` ticket that belongs to no spec (a triaged bug, a fix ticket) to be built like any other ticket, so that small work does not need a spec.
4. As a developer, I want a spec to be recognised by an explicit marker (the spec file on the local tracker, a configurable `spec` label on GitHub and GitLab, an epic on Jira), so that a spec without tickets yet is never mistaken for a ticket.
5. As a developer, I want a tick to start runs in the order merge, fix, gates, rework, implement, decompose, oldest first within each, so that work in progress finishes before new work starts.
6. As a developer, I want `autopilot run <spec>` to keep working and print its final report, so that I can still drive one spec by hand.
7. As a developer, I want `autopilot run <spec>` to sleep while only CI is pending and tick again, so that the manual mode still ends in merged pull requests.
8. As a developer, I want a tick to exit after starting and finishing its runs, so that a scheduler can call it repeatedly and no process lives for hours.
9. As a developer, I want two ticks on the same machine never to overlap, so that a slow tick and the next scheduled one do not fight.

### One step per run

10. As a developer, I want each run to do exactly one step for one ticket and then exit, so that a crash loses at most that one step.
11. As a developer, I want the verifier and both reviewers to run together in one gates run on the same patch, so that one verdict covers one patch.
12. As a developer, I want every run to read what it needs from the tracker, the ticket branch and the pull request, never from a previous process, so that any machine can take the next step.
13. As a developer, I want a run that died to be retried by a later tick once its step lease expires, so that a dead machine never strands a ticket.
14. As a team member on another machine, I want my tick to continue a ticket another machine started, from the tracker and the pull request alone, so that the factory is not tied to one laptop.
15. As a developer, I want two runs never to do the same step on the same patch, so that I never pay twice for the same work.

### The pull request as the run log

16. As a developer, I want a draft pull request to open right after the first implementation, so that I can see work in progress and later runs have a place to record their results.
17. As a developer, I want every run to append a run record to the pull request (step, patch, round, verdict, findings, tokens, duration, log pointer), so that the history of the ticket is auditable and the next run knows what happened.
18. As a developer, I want run records to be append-only, so that nothing a run wrote can be silently rewritten.
19. As a developer, I want the ticket's handoff written to a file on the ticket branch, so that it lands with the code and never invalidates a verdict.
20. As a developer, I want the pull request to become ready for review only when its gates pass, so that draft means "the machine is working" and ready means "the machine is done".
21. As a developer, I want pull requests opened by the previous autopilot, which carry no run records, to be treated as waiting for gates, so that upgrading needs no migration.
22. As a developer, I want the tracker's `Autopilot: <phase>` line retired, so that the phase lives in one place and can never disagree with the pull request.

### Keeping branches current

23. As a developer, I want a pull request that has fallen behind trunk without conflicts to be brought up to date mechanically, without an agent, so that keeping up with trunk costs no tokens.
24. As a developer, I want a verdict to survive that update when the patch is unchanged, and gates to run again when it changed, so that merges never rely on a verdict for code it did not see.
25. As a developer, I want a pull request with a merge conflict to get a rework run with the conflict as its finding, without counting against the fix-round limit, so that trunk moving does not use up a ticket's chances.

### Limits and brakes

26. As a developer, I want a `Paused: yes` switch that makes every tick exit without starting a run, so that I can stop the factory instantly.
27. As a developer, I want to cap how many tickets are in flight across all machines, so that work in progress stays small.
28. As a developer, I want to cap how many runs one tick starts at once, so that one machine is not overloaded.
29. As a developer, I want autopilot to stop starting implement and decompose runs once a set number of its pull requests wait for me, while it keeps finishing merge, fix, gates and rework, so that it slows down when I fall behind instead of piling up pull requests.
30. As a developer, I want a per-ticket token and time budget summed across all of its runs, so that splitting the work into runs does not reset the budget.
31. As a developer, I want time spent waiting for CI not to count against a ticket's time budget, so that slow CI does not hand tickets to me.
32. As a developer, I want an optional daily token limit per machine, after which only steps that need no agent (merge, branch updates, trunk checks) run until the next day, so that cost is bounded.
33. As a developer, I want to choose which tasks are enabled, so that I can start slow and turn tasks on one at a time.
34. As a developer, I want conservative defaults when `docs/agents/autopilot.md` is missing, so that a project that never configured the factory still runs safely.
35. As a developer, I want `setup-software-context` to seed `docs/agents/autopilot.md` next to the merge policy, so that the limits are visible and editable from day one.

### Stop the line and fix

36. As a developer, I want nothing to merge while the latest trunk commit's CI is red, so that broken trunk never gets more changes on top.
37. As a developer, I want gates, rework and implement to keep running while trunk is red, so that the factory does not idle while trunk is being fixed.
38. As a developer, I want a red trunk's failed jobs rerun once before anything else, so that a flaky test does not open a fix ticket.
39. As a developer, I want a trunk that is still red after the rerun to file exactly one fix ticket holding the first red commit and its log, and later red results to comment on that ticket instead of filing more, so that one breakage is one ticket.
40. As a developer, I want the fix ticket to go through the normal implement, gates and rework steps, so that fixes are verified and reviewed like any change.
41. As a developer, I want a fix pull request never to auto-merge, so that a human always approves changes made while trunk is red.
42. As a developer, I want a revert pull request opened alongside the fix ticket when the first red commit is an autopilot merge, the revert applies cleanly to current trunk, and the reverted pull request touched no protected path, so that I can restore trunk with one click.
43. As a developer, I want a revert pull request never to auto-merge, so that a revert is always my decision.

### Working with the human

44. As a developer, I want every hand-off to me to come with a brief (what to decide, why autopilot stopped, the options with a recommendation, links to the diff, verdicts and logs), so that I can decide without reading logs.
45. As a developer, I want to merge an autopilot pull request myself and have autopilot finish the ticket (handoff, close), so that taking over is cheap.
46. As a developer, I want to set a `ready-for-human` ticket back to `ready-for-agent` with a comment, and have autopilot continue from the pull request with my comment as a finding and a fresh fix-round count, so that I can steer without coding.
47. As a developer, I want autopilot to leave alone any pull request or ticket I closed, so that closing is a reliable "stop".
48. As a developer, I want `autopilot status` to show what is in flight, what waits for me (with links to the briefs), what is blocked, what merged in the last day, whether trunk is green, and today's token use, so that I know where things stand at a glance.

### Specs and tickets

49. As a developer, I want a spec with no tickets to be decomposed by a decompose run, stopping for my approval when the breakdown is large or risky (as today), so that the approval gate for large efforts is kept.
50. As a developer, I want every acceptance criterion of a ticket to carry a `Verify:` line naming the command or action that checks it, so that verifiers check what the ticket promised rather than guess.
51. As a developer, I want a ticket missing `Verify:` lines to go to `needs-triage` instead of being built, so that unverifiable work never enters the unattended loop.
52. As a developer, I want `to-tickets` to always write `Verify:` lines, so that tickets it produces pass that check.
53. As a developer, I want a run that finds the ticket or its spec wrong (contradictory acceptance criteria, an impossible design) to report a spec conflict, send the ticket to me with a brief, and comment on the spec (or the ticket when it has no spec), without spending a fix round, so that spec problems go back to discovery instead of looping in rework.
54. As a developer, I want a spec closed with a summary comment (its pull requests and what was delivered) once all its tickets merged, and kept open while any ticket waits for me or for triage, so that the board shows finished work as finished.

### Operating it

55. As a developer, I want every tick to append one line to a tick log on the machine, and every run's harness output kept for 14 days, with the run record pointing at it, so that I can investigate an unattended run afterwards.
56. As a developer, I want ready-made cron and launchd templates that set the PATH and working directory the harness and `gh` need, so that scheduling does not fail silently on a minimal environment.
57. As a developer, I want the harness detection to work under a scheduler with no agent session as an ancestor, so that the right harness is chosen from the project's installed plugins or the PATH.
58. As a skill author in this repo, I want the orchestration logic to stay in the tested script and the skill to stay a thin entry point, so that the repo's rules hold.

## Implementation Decisions

### Shape (ADR-0001)

- Autopilot's public operations become three: **tick** (one pass over everything), **run of one spec** (ticks restricted to that spec until nothing is actionable, then the final report), and **status** (read-only board). Tick is the deep module; run and status are thin over it.
- A tick reads facts, computes for every ticket its next step with a pure **next-step function**, filters by limits and leases, starts up to the per-tick run limit in priority order (merge, fix, gates, rework, implement, decompose; oldest first), waits for those runs, and exits.
- The next-step function takes the ticket, its blockers, whether its branch exists, its pull request with its run records, the current patch, any conflict with trunk, the human's latest note, and the limits, and returns one of: implement, gates, rework, merge, finish (a human merged the pull request), triage, human, or nothing. Spec-level steps (decompose, close-spec) are picked by the tick. It holds every rule that decides what happens next, so it is tested as a table.
- A verdict covers the current patch only when its gates ran after the last implementer run, so every rework gets fresh gates even when the patch did not change.
- The four ticket steps (implement, gates, rework, merge) are separate functions that read only external state and write only external state. Rework is implement with findings; an implementer attempt that comes back incomplete is retried inside the same run while fix rounds remain. Bringing a branch up to date with trunk is part of the merge step (below), not a separate step. The single walk from implement to merge is removed.
- The harness port is unchanged: each agent call is already a fresh non-interactive session.

### Run records

- A run record is an append-only comment on the ticket's pull request carrying a machine-readable marker (step, patch identity, round, verdict, findings, tokens, duration, log pointer, who) plus a short human-readable line. Gate run records keep posting the verifier and reviewer details the pull request shows today.
- Kinds of record: implement, gates, rework, update, merge, human-return, spec-conflict, and the brief. Records carry their decision-trail rows; the trail file is written from them when the ticket merges or goes to the human.
- The forge port gains listing a pull request's comments, marking a draft pull request ready, reading trunk's latest CI status, and rerunning a commit's failed jobs; both GitHub and GitLab adapters implement them.
- The handoff moves from process memory to a file on the ticket branch (`handoff/<id>.md` beside the tracker's trail directory), which patch identity already excludes. After merge the tracker adapter publishes it: on the local tracker it is appended to the ticket on trunk, which closes the ticket in the same commit; remote trackers post it as a ticket comment and close the issue. The ticket file is never edited on the branch, so tracker edits on trunk (claims, hand-offs) never conflict with it.
- Budgets per ticket are the sums over its run records since the human last handed it back. CI waiting is not a run, so it never counts.
- The per-machine state directory keeps only caches, the daily token counter, the tick lock, the tick log and run logs. Nothing in it is needed by another machine.

### Duplicate prevention

- Ticket claims stay as they are (the tracker adapters' claim mechanisms) and are held for the whole life of the ticket.
- A step lease is taken before every run, one per ticket (one per spec for decompose and close-spec, one for the trunk watch). It is a ref on the remote (`refs/autopilot/lease/<name>`) pointing at a commit whose message names the holder and an expiry of the run's time budget plus ten minutes. Creating the ref is atomic, and taking over an expired lease is a compare-and-swap push, so it works the same for every tracker and needs no tracker API.
- Machines of one factory share a name (`--as`), so they can continue each other's tickets; the lease, not the claim, keeps them apart.
- A per-repository lock file on each machine stops overlapping ticks.

### Pull request lifecycle

- Implement pushes the branch and opens a draft pull request with the body from the `pr` skill.
- Gates pass: the pull request is marked ready for review. Merge runs only on a ready pull request.
- Merge checks, in order: trunk green (stop the line), merge policy, pull request CI. CI pending returns wait-ci and the run exits; a later tick merges.
- Behind trunk without conflict: the merge step merges trunk into the branch (no agent, no force push) and records an update; if the patch identity changed, gates run again, else it goes on to CI and the merge. Conflict: a rework run that starts from the merge and has the conflicting files as its finding, not counted against the fix-round limit.
- Every push builds on the remote head and never forces; a rejected push means someone else pushed meanwhile, and the ticket goes to the human.
- A pull request without run records (from the previous autopilot) is treated as waiting for gates.

### Continuous scope and tracker port

- The tracker port gains listing every open spec and every `ready-for-agent` ticket, including tickets with no spec, and closing a spec with a comment. Specs are recognised by an explicit marker: the spec file on the local tracker, a `spec` label on GitHub and GitLab (its string configurable in the triage labels doc), an epic on Jira.
- A ticket without a spec builds against itself: its pointer stands in for the spec in prompts and reviews.
- A ticket whose acceptance criteria lack `Verify:` lines is set to `needs-triage` with a brief instead of being implemented. `to-tickets` always writes them.
- The tracker doc's `Autopilot: <phase>` convention is removed from the local tracker doc and its seed template.

### Configuration

- New project doc `docs/agents/autopilot.md`, seeded by `setup-software-context`, with structured lines read by the script. Defaults when missing:
  - `Paused: no`
  - `In-flight tickets: 2` (claimed and not finished, counted from the tracker across machines)
  - `Runs per tick: 2` (per machine)
  - `Waiting for human: 3` (open autopilot pull requests whose ticket is `ready-for-human`; at the limit no implement or decompose run starts)
  - `Fix rounds per ticket: 2`
  - `Tokens per day: none` (per machine)
  - `Tasks: decompose, implement, gates, rework, merge, fix`
- The merge policy doc keeps its role and mandatory gates. Fix and revert pull requests never auto-merge, regardless of policy.
- Over the daily token limit, only steps that need no agent run (merge, branch updates, trunk checks).

### Human interface

- Every hand-off writes a brief: what to decide, why autopilot stopped, options with a recommendation, links. It replaces the current "Needs a human" comment, on the pull request when one exists, else on the ticket.
- Human merges the pull request: the next tick finishes the ticket. Human sets the ticket back to `ready-for-agent`: the next tick records a human-return, takes the human's latest comment (on the pull request after the brief, else on the ticket) as a finding, and resets the fix-round count and the budget. Human closes the pull request or ticket: autopilot leaves it alone.
- A spec conflict (the implementer's or a reviewer's structured output) sends the ticket to the human with a brief, comments on the spec or standalone ticket, and spends no fix round. It generalises today's handoff conflict that touches acceptance criteria.

### Stop the line and fix

- Trunk is red when the latest trunk commit's CI failed. While red, no merge runs; every other step continues.
- The red is blamed on the newest trunk commit that changed anything outside the tracker folders: tracker-only commits (claims, comments, closes) cannot break CI, and on the local tracker autopilot makes them all the time.
- The first time a blamed commit is red, its failed jobs are rerun once; while the rerun is pending trunk still counts as red. If still red, one fix ticket is filed as a standalone `ready-for-agent` ticket with the first red commit; while it is open, later blamed red commits add one comment each to it and are not rerun.
- A revert pull request is opened next to the fix ticket only when the first red commit is an autopilot merge, the revert applies cleanly to current trunk, and the reverted pull request touched no protected path. It never auto-merges.

### Operations

- `autopilot status` renders the board described in the user stories.
- Each tick appends one line to a tick log in the state directory; each run's harness output is saved there and pruned after 14 days; the run record carries its path.
- The skill ships cron and launchd templates (every five minutes by default) that set the working directory and PATH, and documents the authentication the harness and `gh`/`glab` need under a scheduler.
- The `autopilot` skill text, the local tracker doc and its seed templates, `to-tickets`, the merge policy seed and `AGENTS.md` are updated to match.

### Delivery slices

Each slice leaves autopilot working.

1. Run records: records, the handoff file, the new forge operations. The walk is unchanged.
2. Next-step function from external state, tested as a table.
3. Separate step functions; run of one spec loops over next steps; crash-between-steps scenarios.
4. Tick: the command, step leases, the tick lock, merge without CI polling, `docs/agents/autopilot.md`, limits, daily budget.
5. Continuous factory: whole-tracker scope, standalone tickets, spec markers, closing specs, human return, briefs, `Verify:` lines, spec conflicts, branch updates and conflicts.
6. Stop the line and fix: trunk status, rerun, fix ticket, revert pull request.
7. Operations: status, logs, scheduler templates, skill and doc updates.

## Testing Decisions

- A good test drives autopilot through its public operations and asserts only observable outcomes: ticket files and tracker state, branches and commits in a real git repository, comments, draft and ready states, merges on the fake forge, the tick log, the status output. Tests never assert on internal state.
- **Primary seam: one tick.** Tests call tick repeatedly on a temporary repository with real git history and a fake harness and fake forge, and check the world after each tick. The run of one spec keeps a few scenarios for backward compatibility.
- **Crash scenarios:** between any two ticks, the test builds a completely fresh context (new process state, new state directory where relevant) and the ticket still continues at the right step.
- **The next-step function** gets a table test: every row is a set of facts and the expected next step, covering at least every state in the user stories (no pull request, draft without records, failed verdict under and at the round limit, passed verdict on an old patch, behind trunk, conflict, trunk red, CI pending, human return, closed by human, spec conflict, over budget, paused, waiting-for-human limit reached).
- **Leases:** two ticks started together never run the same step on the same patch; an expired lease is taken by a later tick.
- **Stop the line and fix:** red trunk blocks merges only; a rerun that turns green files nothing; a persistent red files one fix ticket and comments on it afterwards; a revert pull request appears only when all three conditions hold; neither fix nor revert pull requests auto-merge.
- Prior art: the existing autopilot scenario suite, its fake harness and fake forge, and the tracker adapter tests with fake transports; `cli/repo.test.mjs` for temporary repositories with real git. Most of the existing scenarios are rewritten as tick sequences.
- The forge adapters' new operations get transport-level tests like the existing ones and opt-in smoke tests against real `gh` and `glab`.
- Repo checks after every change: `npm run validate` and `npm test`.

## Out of Scope

- Running ticks in GitHub Actions or GitLab CI, with event triggers, concurrency groups and an app identity. The design keeps tick identical so this is a later workflow, not a rewrite.
- Retro, architecture and ratchet tasks run by autopilot. The `retro` and `improve-codebase-architecture` skills stay manual.
- Renaming the forge port to "git host".
- Exporting traces to an observability platform.
- A daily token budget shared across machines.
- Auto-merging fix or revert pull requests.
- Deploy verification, end-to-end runs against a new deployment, and automatic revert after merge; projects get post-merge checks through their own trunk CI, which stop the line reads.
- Explore or triage runs on incoming issues; `triage` stays manual.

## Further Notes

- Source of the model: the in-progress `software-factory` skill on mattpocock/skills (branch `software-factory-skill`, October 2026): tasks, triggers, runs that never wait and remember only through the tracker and git host, disposable runners, the three brakes, starting slow.
- This spec supersedes parts of the original autopilot spec: the single process per spec, polling CI, the `Autopilot: <phase>` tracker line, and the end-of-run report as the only interface.
- The stop-the-line rule only sees what the project's trunk CI checks. A project that wants post-merge smoke or end-to-end checks adds them to its trunk CI.
- Under a scheduler there is no agent session among the process ancestors, so harness detection falls back to the project's installed plugins, then the PATH; the scheduler templates must set PATH accordingly.
- In this repository `gh` resolves to the `upstream` remote unless told otherwise; every forge call keeps passing the configured repository explicitly.
