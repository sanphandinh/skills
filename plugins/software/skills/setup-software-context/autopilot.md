# Autopilot

Read by the `autopilot` skill on every tick. Each line below is read as `Name: value`; a missing line keeps the default shown here. Start slow: keep the limits small and enable one task at a time, then loosen them as the gates earn trust.

Paused: no

In-flight tickets: 2

Runs per tick: 2

Waiting for human: 3

Fix rounds per ticket: 2

Tokens per day: none

Tasks: decompose, implement, gates, rework, merge, fix

## What each line means

- **Paused**: `yes` makes every tick exit without starting a run.
- **In-flight tickets**: how many tickets may be claimed and unfinished at once, across every machine.
- **Runs per tick**: how many agent runs one tick on one machine starts at once.
- **Waiting for human**: once this many autopilot pull requests wait for a human, no new ticket or spec is started; work already in flight still finishes.
- **Fix rounds per ticket**: implementer attempts after the first before a ticket goes to a human. A human handing the ticket back starts the count again.
- **Tokens per day**: a per-machine daily token limit (`none` for no limit). Over it, only steps without an agent run (merge, branch updates, trunk checks).
- **Tasks**: the enabled tasks, from `decompose`, `implement`, `gates`, `rework`, `merge`, `fix`.
