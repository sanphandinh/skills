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
