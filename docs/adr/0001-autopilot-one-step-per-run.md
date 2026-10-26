# Autopilot runs one step per run, with its state on the pull request

Autopilot used to walk a ticket from implement to merge inside one long-lived process that held findings, verdicts and round counts in memory and polled CI. We split that walk into separate runs (decompose, implement, gates, rework, merge, fix), each of which reads the ticket's pull request, does one step, appends a run record to the pull request, and exits; a tick picks the next runs. This follows the software-factory model (mattpocock/skills, `software-factory` branch, 2026-10): a run never waits, and remembers earlier runs only through the tracker and the git host. We chose the pull request over the tracker as the store because there are two git host adapters and four tracker adapters, and pull request events are the natural triggers for the next run.

## Consequences

- A dead process loses nothing; any machine, or a CI job, can take the next step.
- Run records are append-only comments, so pull requests carry more comments; we accept that for an auditable history.
- Duplicate work is prevented by ticket claims plus time-limited step leases, not by a single process.
- The tracker doc's `Autopilot: <phase>` line is retired: the phase is derived from the pull request.
