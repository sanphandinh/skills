---
name: autopilot
description: "Run the unattended software factory: ticks that move every approved spec and ticket to verified, reviewed, merged pull requests, calling a human only with a brief. Also builds one spec by hand, or shows the board."
argument-hint: "tick | run <spec path | #issue | KEY-1> | status [--harness omp|claude|orca]"
disable-model-invocation: true
---

Autopilot is a set of tasks (decompose, implement, gates, rework, merge, fix) run by an orchestrator script. Each run does one step for one ticket, records what it did on the ticket's pull request, and exits; a tick picks the next runs. The script holds every rule; this skill only checks the preconditions and starts it. Never do the orchestration yourself.

## Preconditions

Check each one and stop with the reason when one fails:

- The issue tracker doc (`docs/agents/issue-tracker.md`) exists. If not, tell the user to run the `setup-software-context` skill. Its `Tracker:` line names where tickets live (local, GitHub, GitLab, or Jira); for Jira, `JIRA_EMAIL` and `JIRA_API_TOKEN` must be set. On GitHub and GitLab a spec is an issue with the spec label from `docs/agents/triage-labels.md`; that file must have a `spec` row and the tracker must have the label. If either is missing, stop: an older setup would treat the spec and its tickets as standalone tickets.
- The working tree is clean, and the repository has the remote the tracker doc names for pull requests. If the tree is dirty, stop and report the files; never commit unrelated or generated files just to make this precondition true.
- If `docs/agents/verify.md` is missing, warn that nothing will auto-merge until the `setup-verification` skill has written it, then continue.
- If `docs/agents/autopilot.md` is missing, say the defaults apply (two tickets in flight, stop starting new work once three pull requests wait for a human, two fix rounds) and that `setup-software-context` seeds the file.

## Modes

From the repository root, with `<script>` being `node <this skill's folder>/scripts/autopilot.mjs`:

- **Tick** (`<script> tick`): one pass over the whole tracker, then exit. This is what a scheduler runs. Every approved spec and every standalone `ready-for-agent` ticket is in scope.
- **Run one spec** (`<script> run <spec>`): ticks over that spec until nothing is actionable, sleeping while only CI is pending, then prints the final report. The spec must be `ready-for-agent`. Pass `--dry-run` to show the frontier without changing anything, `--concurrency <n>` for parallel runs.
- **Status** (`<script> status`): the board: in flight, waiting for the human (with links to the briefs), blocked, needing triage, merged in the last day, trunk, and today's tokens.

The script picks the harness itself (the session it runs inside, else the agent plugin the project installed, else the only agent CLI on PATH) and prints which one and why. Pass `--harness <omp|claude>` only when the user names one or the script asks for it. Pass `--as <name>` to give the factory one name on every machine; machines sharing a name continue each other's tickets. Pass `--max-tokens <n>` or `--max-minutes <n>` to change the per-ticket budget.

## Orca mode

When the user wants to watch runs as they work or review them afterwards, and Orca is installed, pass `--harness orca` (with `--agent omp|claude|codex`, default omp when it is on PATH). Each run's checkout is then an Orca worktree named after the ticket and step, and each agent call an Orca worker terminal titled with the ticket and role. A worker that succeeded is released with its output archived and its worktree removed; any other is retained with its worktree kept, its comment saying so, for debugging. The run record on the pull request names its Orca dispatches; `orca orchestration worker-read --dispatch <id>` shows what one did.

Preconditions: Orca is running and the repository is added to it (`orca repo add --path .`). The tick must run in an Orca terminal; started anywhere else it relaunches itself in one and waits. In Orca mode only the time budget applies, because Orca reports no tokens, and agents run with the user's own Orca permission settings: a worker waiting for an approval shows in Orca and counts against the time budget. Basing a new ticket on trunk makes Orca fast-forward the local default branch.

## Running continuously

When the user wants the factory to run on its own, set up the scheduler template that fits the machine, from this skill's `scheduler/` folder: `autopilot.cron` (crontab) or `autopilot.plist` (macOS launchd). Fill every placeholder with the user, especially PATH: a scheduler starts with almost no environment, and the tick needs `node`, `git`, `gh` or `glab`, and the agent CLI, logged in as the user. Suggest starting slow: small limits in `docs/agents/autopilot.md`, then loosen them. If the verification doc leases a single simulator or device, keep `Runs per tick: 1`; parallel runs will wait on each other's lease.

Each tick writes one line to `ticks.log` in the machine's state directory (under `$XDG_STATE_HOME/autopilot/` or `~/.local/state/autopilot/`), and every agent call's output is kept there for 14 days; the run records on pull requests point at those files.

## When the human is needed

Autopilot leaves a brief (what to decide, why it stopped, options with a recommendation) on the pull request, or on the ticket when there is none. Tell the user the three ways back:

- merge the pull request: the next tick closes the ticket and publishes its handoff;
- set the ticket back to `ready-for-agent` with a comment: the next tick reworks it with that comment, with fresh fix rounds;
- close the pull request or the ticket: autopilot leaves it alone.

While trunk's CI is red nothing merges. A red files a fix ticket and, when the red commit is an autopilot merge that reverts cleanly, a revert pull request. Neither the fix nor the revert ever auto-merges: a human must merge or close the fix (or revert) before any other pull request can merge. Say this explicitly in the brief for every other waiting pull request.

## Report

Relay what the script prints as is, with the pull request links. Do not retry `ready-for-human` tickets yourself; they need the human.
