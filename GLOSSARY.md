# Autopilot

The unattended build in the `software` plugin: it keeps taking work from the tracker and moves each ticket to a merged pull request, calling a human only where the merge policy or the limits say so.

## Language

**Task**:
A kind of work autopilot performs, defined once and run many times: decompose, implement, gates, rework, merge, fix.
_Avoid_: job, workflow, phase

**Run**:
One execution of one task on one ticket, from start to exit. A run never waits: it writes what it learned to the tracker or the pull request and ends.
_Avoid_: session, attempt

**Tick**:
One pass of autopilot over the tracker and its pull requests that picks the next runs, starts them, and exits.
_Avoid_: loop, cycle, poll

**Run record**:
An append-only marker comment a run leaves on the ticket's pull request: what it did, on which patch, with what verdict and cost. The next run reads the records instead of remembering.
_Avoid_: state comment, status, log

**Step lease**:
A time-limited hold on one task for one patch, so two runs never do the same step; an expired lease is free to take.
_Avoid_: lock, mutex

**Spec conflict**:
A run's finding that the ticket or its spec, not the code, is wrong; it sends the ticket to a human instead of to rework.
_Avoid_: spec bug, blocker

**Brief**:
The decision-ready comment autopilot leaves whenever it hands work to a human: what to decide, why it stopped, the options with a recommendation, and links.
_Avoid_: needs-human note, status update

**Fix ticket**:
The one ticket autopilot files while trunk stays red after a rerun, holding the first red commit and its log.
_Avoid_: incident, hotfix

**Stop the line**:
The rule that nothing merges while trunk is red.
_Avoid_: freeze, merge block

# Factory

The agent-driven successor to autopilot, in the `factory` plugin: a coordinator agent builds approved specs through an agent manager (ADR-0002). **Brief**, **Fix ticket** and **Stop the line** above mean the same here.

## Language

**Coordinator**:
The long-lived agent that runs the factory: it reads the tracker and the git host, decides each ticket's next step, starts workers, merges, and asks people. It never writes code.
_Avoid_: orchestrator, scheduler, bot

**Worker**:
A fresh agent session the agent manager starts in a workspace to do one step of one ticket, under one work order, ending with a result.
_Avoid_: subagent, job, run

**Work order**:
The self-contained instructions a worker starts with: the step, the pointers it needs, what it may change, the evidence that proves it is done, and where to write its result.
_Avoid_: brief (that is the note to a person), prompt, task spec

**Wake**:
One pass of the coordinator: wait for events, reload its instructions and settings, handle the events, move each ticket one step, record a journal line.
_Avoid_: tick, loop, poll

**Agent manager**:
The tool that creates workspaces, runs workers, and reports their events: Orca now, Herdr later.
_Avoid_: harness, runner

**Interface**:
The nine operations the factory needs from an agent manager.
_Avoid_: API, adapter

**Reference**:
The document that maps the interface to one agent manager's commands and lists its traps; ready when the setup smoke test passes on it.
_Avoid_: adapter, driver

**Hold**:
A ticket or pull request waiting for a person's decision, marked with the `factory:hold` label and a brief.
_Avoid_: block, park

**Verdict status**:
A commit status (`factory/verify`, `factory/review`) on the exact head commit a verifier or reviewer checked. A new push leaves the new head without one.
_Avoid_: approval, check result
