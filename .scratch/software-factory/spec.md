Status: ready-for-agent

# Software factory: an agent-driven autopilot over an agent manager, Orca first

## Problem Statement

The `autopilot` skill is a rule-based orchestrator: about 3,400 lines of scripts (plus 2,000 lines of tests) decide every step, which ticket, which task, when to merge, by reading tickets, pull request bodies and comments in fixed formats, and they keep their own state machine, step leases and per-machine records. A real run on the Ody-drive app (spec #60, 27 to 29 October 2026) showed where that breaks:

- 50 agent runs in about 50 hours; 17 of them (34%) produced nothing because the script misread or could not handle its environment: a heartbeat read as completion, a harness chosen from an environment variable for a CLI that was not installed, a full disk, a silent CI read as red that filed two duplicate fix tickets.
- One feature ticket merged, after three failed gate rounds and two rewrites of the ticket by the developer: the implementer filled design gaps the ticket left open, and filled them wrongly.
- The developer stepped in about nine times for incidents a person resolves by judgment: a stale worktree, a held lease, duplicate fix tickets, a gate that waited 83 minutes on an approval prompt nobody saw.
- Format checks on human- and agent-written text (a `Verify:` line, a bold `**Door:**`, a comment prefix) send good tickets to triage or block merges, and some double as trust holes.
- Nothing merged automatically, and the developer could not see agents working or answer them from a desktop app or a phone.

The developer wants an agent-driven factory instead: one coordinator agent that keeps taking work from the tracker, decides as a person would, delegates each step to a fresh worker, and asks a human only for real decisions; automatic merges that stay safe; one factory for web, mobile, desktop and CLI projects; agents visible and answerable from a desktop app and a phone; and the freedom to swap the agent manager (Orca now, Herdr later) without rewriting the factory.

## Solution

A new plugin, `factory`, sits on top of `core` and `software` (layer 1, unchanged except for a new planner role). It has one user-invoked skill, `factory`, with three modes:

- `setup` prepares a project: it picks the agent manager, writes `docs/agents/factory.md`, runs the manager's setup steps, and proves the setup with a smoke test that drives every interface operation through the real manager.
- `run` turns the current session, started in a terminal of the agent manager, into the coordinator: a long-running agent that waits on the manager's events, wakes on each event or after a timeout, and moves every approved spec forward.
- `once` performs a single wake and stops, for trying the factory out and for testing.

The coordinator follows a written playbook, not a script. On each wake it re-reads the playbook, the project's `factory.md` and the wiki index; handles events from workers; reads the tracker the way `issue-tracker.md` describes; computes each approved spec's frontier in priority order; and moves each ticket through plan, build, check, rework and land. Every step is a fresh worker in its own worktree, started through the agent-manager interface. The coordinator never reads or writes code.

The factory talks to the agent manager only through a small interface: open a workspace, start a worker, wait for events, send a message, inspect a worker, flag a human, stop a worker, close a workspace, resume. One reference document per manager maps each operation to that manager's commands. Orca's reference comes first; Herdr becomes another reference against the same interface. The manager alone creates and removes worktrees.

Merges are automatic and guarded by GitHub itself. The coordinator records the verifier's and the reviewer's verdicts as commit statuses on the exact head commit they checked, and merges only when the project's required checks and both verdicts pass on the current head, with a head-commit guard so a later push never rides on an older verdict. One-way doors, protected paths and blast radii the merge policy does not allow get a hold label and wait for the developer.

The developer sees every task in Orca, on the desktop and on the phone, answers questions there or on GitHub, and reads a decision journal and dated lessons in a wiki that lives outside the repository. Once the factory has built a real spec end to end, the script autopilot is removed.

Diagrams of the architecture and of one ticket's sequence are in `flow.html` beside this spec.

## User Stories

1. As a developer, I want to set up a project for the factory with one command, so that I do not edit configuration by hand.
2. As a developer, I want to choose the agent manager during setup, so that the factory works with the tool I already use.
3. As a developer, I want setup to prove the manager integration with a smoke test against the real manager, so that a broken setup shows before any real ticket.
4. As a developer, I want the project's limits (parallel workers, scarce resources such as a single simulator, fix rounds, merge mode, protected paths, required checks) in one plain document, so that I can read and change them without code.
5. As a developer, I want the factory to work for web, mobile, desktop and CLI projects alike, so that only the project's own verify and configuration documents differ.
6. As a developer, I want to start the coordinator in a terminal of my agent manager and leave it running, so that work keeps moving without me.
7. As a developer, I want the coordinator to spend no tokens while it waits, so that an idle factory costs nothing.
8. As a developer, I want the coordinator to wake on every worker event and at least every few minutes, so that my comments, labels and CI results are noticed promptly.
9. As a developer, I want a replaced coordinator session to pick up the running workers and every ticket's state, so that a crash or a reboot loses no work.
10. As a developer, I want a one-shot mode, so that I can watch exactly one wake before I trust the loop.
11. As a developer, I want to pause and resume the factory by telling the coordinator, from my desk or my phone, so that stopping it needs no commit.
12. As a developer, I want every ticket planned by a strong model before any code is written, so that the implementer never invents design decisions.
13. As a developer, I want the plan posted on the ticket (decisions with reasons, files to change and files not to touch, tests per acceptance criterion, verify commands, door), so that I can read and correct it.
14. As a developer, I want a plan that raises a product question to hold its ticket and ask me while other tickets keep moving, so that one question never stalls the factory.
15. As a developer, I want the implementer to work test-first in a fresh worktree and push each finished unit, so that a killed worker loses nothing.
16. As a developer, I want an independent verifier and reviewer to check each pull request head, so that no worker grades its own work.
17. As a developer, I want verdicts recorded as commit statuses on the exact commit, so that any new push voids them automatically.
18. As a developer, I want failed checks reworked by a fresh worker with the findings, design findings sent back to the planner, and at most the configured number of rounds, so that loops end in a decision brief instead of churn.
19. As a developer, I want a pull request merged automatically when the required checks and both verdicts pass on its current head, so that a chain of tickets flows without me.
20. As a developer, I want one-way doors and protected paths held for my approval, so that risky changes never merge on their own.
21. As a developer, I want a merged ticket closed with its handoff published, so that the next ticket's planner reads it.
22. As a developer, I want a worktree removed only after its work is pushed, so that cleanup never destroys work.
23. As a developer, I want several approved specs worked in priority order within global limits, so that I can queue work.
24. As a developer, I want tickets whose plans touch the same files never to run at the same time, so that parallel work does not collide.
25. As a developer, I want nothing merged while trunk is red, and a required check that never reports treated as unknown rather than red, so that the factory neither piles onto a broken trunk nor files duplicate fixes.
26. As a developer, I want a worker that blocks on a permission prompt or a question to reach the coordinator at once, so that nothing waits silently for hours.
27. As a developer, I want to see every task's worktree, worker and state in Orca on my desktop and my phone, so that I know what runs and what needs me.
28. As a developer, I want each question to reach me as a decision-ready brief on the ticket and as an unread mark in Orca, so that I can answer from wherever I am.
29. As a developer, I want a journal line per wake and dated lessons with citations in a wiki outside the repository, so that I can audit decisions and the factory improves over time.
30. As a maintainer of these skills, I want the factory to depend on the agent manager only through the interface and one reference per manager, so that adding Herdr is a new reference plus a passing smoke test.
31. As a maintainer, I want no scripts in the factory until an observed, repeated failure justifies one, so that the factory stays easy to change.
32. As a maintainer, I want the planner to be a layer-1 role agent, so that `implement` and `implement-spec` can use it too.
33. As a maintainer, I want the script autopilot removed once the factory has built a real spec, so that there is one factory, not two.

## Implementation Decisions

### Layers

- Layer 1 (`core`, `software`, `software-omp`, `software-claude`) stays a set of harness-agnostic process skills and role agents. It gains a `planner` role in ROLES.md (Oh My Pi `@planner` falling back to `@plan`; Claude Code `opus`) and a `planner` agent in both platform plugins. Agents keep naming roles, never models.
- Layer 2 is a new shared plugin, `factory`. It refers to layer-1 skills and agents by name, with fallbacks, as every shared skill does.

### The `factory` skill

- User-invoked (`disable-model-invocation: true`, Codex `allow_implicit_invocation: false`), argument hint `setup | run | once`.
- Progressive disclosure: the skill's main document holds the modes and points to the playbook, the interface, the setup steps, the work-order templates, the memory rules and one reference per manager. A wake reads the playbook; setup reads the setup steps; only the configured manager's reference is ever read.
- No scripts in this version. Rules that must be exact are conventions written in the interface, and GitHub's own mechanisms enforce merge safety. A script is added later only for a rule that is irreversible when wrong, exact over structured data, independent of the app type, and observed to fail repeatedly.

### Project configuration: `docs/agents/factory.md`

Written by setup, read by the coordinator on every wake, as plain `Name: value` lines that an agent reads (so wording may vary):

- Manager: `orca`.
- Agent: the agent command-line tool the manager starts for workers (`omp`).
- Trunk: the branch pull requests merge into.
- Max workers: total parallel workers (default 3).
- Scarce resources: a named resource, how many workers may hold it, and which roles hold it (for example one verifier at a time when the project has one simulator).
- Fix rounds: rework rounds before a brief (default 2).
- Required checks: the CI check names a pull request must pass. A required check that never reports is unknown, not green and not red.
- Wake timeout: the longest the coordinator waits without an event (default 15 minutes).
- Memory: the memory folder, outside the repository.

Merge rules stay where the repository already keeps them, in `merge-policy.md`: the auto-merge switch, the allowed blast radius from the pull request's Merge Danger section, and protected paths. The factory reads it on every wake.

App-type knowledge stays where it already belongs: `verify.md` (how to prove behaviour: browser, simulator, desktop automation, CLI output), `issue-tracker.md` (how to read, claim and close tickets), and the project's own `AGENTS.md` and context documents.

### Agent-manager interface

| Operation | Input | Output and guarantees |
|---|---|---|
| open-workspace | ticket, branch, base branch | a worktree; one per ticket; only the manager creates it |
| start-worker | workspace, worker name, work order, model role | a worker named `<ticket> <role>` |
| wait-events | timeout | normalized events: `done`, `failed`, `blocked`, `question`, `message`, `timeout`; no token cost while waiting |
| send | worker, text | delivered at the worker's next checkpoint; wakes an idle worker |
| inspect | worker, or every worker | state (`working`, `idle`, `done`, `failed`, `stopped`), last output, result path |
| flag-human | workspace, reason | visible in the manager on desktop and phone (the brief itself goes on the ticket) |
| stop-worker | worker | the worker stops; its work stays on its branch |
| close-workspace | workspace | removed only after everything in it is pushed |
| resume | none | a new coordinator session sees every live worker |

A heartbeat or a progress ping is never `done`. A worker counts as finished only when it reports so through the manager.

### Worker contract

- Every worker starts in a fresh session with a self-contained **work order**: the goal, pointers to the ticket, the spec, the plan and the blockers' handoffs, the paths it may and may not change, the evidence that proves it is done, and where to write its result. ("Brief" stays the name of the decision-ready note to a person.)
- Every worker writes its result as JSON (role, ticket, ok, head commit, verdict, findings with severity and kind `design | code | test | scope`, questions, decisions, lessons, and the role's own fields) under the memory folder's `results/`, outside the repository, so it survives the workspace, and reports done through the manager with that path.
- Workers push each finished unit of work and write nothing else outside their workspace and result. Orca's worker contract forbids workers posting to GitHub during a run, so the coordinator alone writes to the tracker and the git host: it opens the pull request from the implementer's result (title, body with the closing keyword), posts plans, evidence and handoffs, and sets the verdict statuses `factory/verify` and `factory/review` on the head commit the verifier and the reviewer report they checked.
- A worker session starts on a cheap model role and delegates its step to the layer-1 role agent its work order names (`planner`, `implementer`, `verifier`, the reviewers), so ROLES.md decides the model that does the work. The Orca spike confirmed Orca passes an Oh My Pi role (`--model @smol`) to the worker session.

### Coordinator playbook

- Wake loop: wait-events up to the wake timeout; re-read the playbook, `factory.md` and the wiki index; handle the events; read the tracker; for each approved spec in priority order, compute the frontier and pick the next step for each ticket within the limits; act through the interface; write one journal line.
- Ticket chain: plan, build, check (verifier and reviewer in parallel, scarce resources respected), rework (at most the configured rounds; design findings go to the planner), land (merge guard), close with handoff, close the workspace.
- Merge guard: the required checks pass on the head (`gh pr checks` exits 0; a missing required check is not green); `factory/verify` and `factory/review` succeed on that head; there is no `factory:hold` label; the merge is a squash with `--match-head-commit` on the verified head. CI is never awaited in a blocking way: pending checks (exit code 8) are looked at again on a later wake.
- Stop the line: nothing merges while trunk is red; at most one fix task runs for a red trunk; checks that never start are reported to the developer as unknown and never file a fix.
- Humans: a question the brief or the plan answers, the coordinator answers itself; anything else goes out through flag-human as a brief (what to decide, why, the options, a recommendation). Answers come back from the ticket or through the manager.
- Many specs: priority labels (`priority:p1` to `priority:p3`) order the specs; tickets of different specs run in parallel unless their plans list the same files.
- Pause and resume: the developer tells the coordinator, from a terminal or the manager's phone app; in-flight work finishes, nothing new starts.

### Planner contract

- The plan goes on the ticket as a comment and into the result: decisions with reasons and ADR citations, the files to change and the files not to touch, interface signatures, tests per acceptance-criterion branch, verify commands, the door (`one-way` or `two-way`), and open questions.
- A product question holds the ticket for the developer before any code is written.
- The implementer agents follow a plan when they get one and report every deviation.

### Memory

- GitHub is the truth: tickets, pull requests, checks, comments. The manager holds only in-flight work. The wiki holds lessons and decisions.
- The wiki is a folder outside the repository (location in `factory.md`), with local git for history: an index plus one page per topic; every entry dated and cited (commit, issue, pull request); a code-related entry's citation checked before it is relied on, and corrected rather than deleted when it no longer holds. The coordinator is its only writer; workers propose lessons in their result. A heartbeat wake lints it weekly.

### Agent manager: Orca first

- The Orca reference maps every interface operation to Orca commands (orchestration runs, workers with a new worktree and setup, check with wait, send and reply, worker show and read, workspace status and unread, worker stop and release, worktree removal, run-use), records the Orca version it was verified on, and lists the traps found. It points at Orca's own version-matched orchestration guide for protocol detail instead of copying it.
- Visibility comes from Orca: worker terminals titled `<ticket> <role>`, workspace status following the task (`in-progress`, `in-review`, `completed`), an unread mark on tasks waiting for the developer, and the same view in Orca's mobile companion.
- Herdr becomes a later reference against the same interface.

### Retiring the script autopilot

After the factory has built a real spec end to end: remove the autopilot skill with its scheduler templates, scripts and tests; rewrite every mention (AGENTS.md, PLATFORMS.md, README, GLOSSARY, ROLES.md, templates, `setup-software-context`, the tracker and merge-policy documents, `to-spec` and `to-tickets`, the implementer and verifier agent descriptions, plugin descriptions and versions). ADR-0002 records the agent-driven factory and supersedes ADR-0001's orchestrator; ADR-0001's "a run never waits" and "state lives on the git host" survive.

## Testing Decisions

- There is no script, so there are no unit tests in this version: the playbook, the interface and the references are prose, and tests on prose would only pin wording.
- `npm run validate` checks manifests, frontmatter, catalogs and roles; `npm test` stays green (the autopilot tests leave with the autopilot).
- Behaviour is proven by running the real thing:
  - The setup smoke test drives every interface operation through the real manager on a sandbox repository and reports pass or fail per operation. It is also the acceptance gate for any future reference.
  - End-to-end scenarios on a sandbox GitHub repository with small specs: one ticket to merge; a dependency chain; a held ticket; a worker question; a failed check reworked; a push after verification blocking the merge; a coordinator replaced mid-run.
  - Acceptance on a real project: the rest of Ody-drive spec #60, measured against the 27 to 29 October baseline (first-round gate passes 2 of 5, runs lost to infrastructure 34%, about nine interventions, no automatic merge).
- Prior art: the `verify.md` flow from `setup-verification`; the old autopilot's opt-in smoke tests against real CLIs, which caught what fakes missed.

## Out of Scope

- The Herdr reference: the interface is designed for it, but it is not built here.
- GitLab and Jira as trackers or forges for the factory: the playbook reads `issue-tracker.md`, but merge safety is specified and tested for GitHub only.
- Cloud or VM runners, remote Orca servers, and several machines working one repository.
- Token budgets and cost accounting: Orca does not report tokens.
- Any script, until an observed failure justifies one.
- Layer-1 changes beyond the planner role, the implementer following plans, and wording at the cutover.

## Further Notes

- Prior art: Matt Pocock's `software-factory` (task, trigger, run, runner, orchestrator; three brakes), `chief-of-staff` (a long-running coordinator with a wiki) and `implement-spec` (a frontier and a fresh implementer per ticket); pstack's `orchestrate` and `autopilot-full` (the coordinator never writes code, one verdict per head, workers judged by side effects); Orca's orchestration guide; GitHub Copilot Memory (citations verified before use).
- The end-to-end tickets need a sandbox GitHub repository; creating it needs the developer's go-ahead.
- Environment at the time of writing: macOS, Orca 1.4.244, Oh My Pi 18.12.6 (reports program status over OSC 7501 by default, which matters for a later Herdr reference).
