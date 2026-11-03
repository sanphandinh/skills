# Factory

The unattended build in the `factory` plugin: a coordinator agent keeps taking work from the tracker and moves each ticket to a merged pull request, asking a person only where the merge policy, a plan's questions or the limits say so (ADR-0002). The scripted orchestrator it replaced is recorded in ADR-0001.

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
The ten operations the factory needs from an agent manager.
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

**Brief**:
The decision-ready comment the factory leaves whenever it hands work to a human: what to decide, why it stopped, the options with a recommendation, and links.
_Avoid_: needs-human note, status update

**Fix ticket**:
The one ticket the factory files while trunk stays red after a rerun, holding the first red commit and its log.
_Avoid_: incident, hotfix

**Stop the line**:
The rule that nothing merges while trunk is red.
_Avoid_: freeze, merge block
