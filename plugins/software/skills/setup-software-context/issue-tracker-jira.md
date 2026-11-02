# Issue tracker: Jira

Issues and specs for this repo live in Jira; code and pull requests live on the code host below.

**Tracker:** jira https://<site>.atlassian.net <PROJECT-KEY>

**Pull requests:** github|gitlab <owner>/<repo>

**Jira statuses:** needs-triage=Backlog, ready-for-agent=To Do, ready-for-human=Blocked, closed=Done

Edit the right-hand names to match this project's workflow. The factory moves tickets between them with transitions, so each must be reachable from the others.

## Conventions

- **A spec** is an epic; **its tickets** are issues whose parent is the epic.
- **Blocking**: a "Blocks" issue link (the blocked ticket shows "is blocked by"), or a `Blocked by: KEY-1, KEY-2` line in the description.
- **Door**: a `Door: one-way` or `Door: two-way` line in the description.
- **Read an issue**: the Jira web UI, the `acli` CLI, or `GET /rest/api/3/issue/<KEY>` with the credentials below.
- **Credentials**: `JIRA_EMAIL` and `JIRA_API_TOKEN` in the environment. Never write them into a file in this repository.

## Factory

Read by the `factory` skill. Open issues with no parent that are not epics are standalone tickets, built without a spec; the factory files a fix ticket for a red trunk as a task in the project. The factory posts its plan, its questions and its briefs as comments, holds a ticket for a person by moving it to the `ready-for-human` status with a brief, and after a merge comments the ticket's `## Handoff` and moves it to `closed`. A person releases a hold by moving the ticket back to `ready-for-agent`. Pull requests mention `Jira: <KEY>`. The factory's merge steps are verified on GitHub only.

## When a skill says "publish to the issue tracker"

Create a Jira issue in the project; for a ticket, set its parent to the spec epic.

## When a skill says "fetch the relevant ticket"

Read the issue and its comments.
