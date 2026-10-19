Status: closed

# Autopilot on GitHub, GitLab, and Jira trackers

## Problem Statement

Autopilot only works when tickets live as local markdown files in the repository. Teams that track work in GitHub Issues, GitLab Issues, or Jira cannot use it, even though the manual pipeline skills (`to-spec`, `to-tickets`, `triage`) already publish to GitHub and GitLab. The orchestrator reads tickets, claims them, hands them to the human, and closes them through git directly, so supporting another tracker today would mean editing the orchestrator's core.

## Solution

Put every ticket operation behind a tracker port, next to the existing harness and forge ports. The local markdown tracker becomes one adapter with unchanged behaviour; GitHub, GitLab, and Jira become three more. The tracker doc names the tracker on a structured line, so the script can pick the adapter. Pull requests stay on a forge (GitHub or GitLab), which may differ from the tracker (Jira tickets, GitHub pull requests).

## User Stories

1. As a developer whose tickets live in GitHub Issues, I want autopilot to build a spec issue's sub-issues, so that I do not have to move tickets into the repository.
2. As a developer on GitLab, I want the same for GitLab issues and merge requests.
3. As a developer whose tickets live in Jira and code on GitHub or GitLab, I want autopilot to read an epic's issues from Jira and open pull requests on the code host.
4. As a developer, I want to point autopilot at a spec by its tracker reference (`#42`, a URL, or `PROJ-12`), so that I use the names I already use.
5. As a developer, I want ticket status read from and written to the tracker's own vocabulary (labels, or Jira workflow statuses mapped in the tracker doc), so that the board stays truthful.
6. As a developer, I want blocking edges read from the tracker's native dependency links, with a `Blocked by:` line in the body as the fallback, so that `to-tickets` output works as is.
7. As a team member, I want two runs never to take the same remote ticket, even though remote trackers have no atomic lock.
8. As a team member picking up a ticket, I want the blocker's handoff posted on the blocker's ticket when it merges.
9. As a developer, I want a merged pull request to close its ticket (`Closes #N` where the tracker supports it, an explicit transition for Jira).
10. As a developer, I want the decision trail still committed with the code, even when the ticket lives outside the repository.
11. As a developer, I want the local markdown tracker to behave exactly as before.
12. As a developer, I want credentials (Jira API token) read from the environment and never written to a file.
13. As a developer, I want `setup-software-context` to write the structured tracker line, so that I never hand-edit it.

## Implementation Decisions

- **Tracker port.** Operations: read the spec (title, status), list its tickets (id, reference, title, status, blockers, claim holder, door), claim a ticket, hand a ticket to the human with a reason, the pointer a prompt uses for a ticket, what goes in a pull request body to link the ticket, work done on the ticket branch before the pull request (local: write the handoff and close the ticket), work done after a confirmed merge (remote: post the handoff and close the ticket), split support, and where the decision trail lives.
- **Handoff is data, not an edit.** The implementer returns its handoff in its JSON result; the tracker adapter places it (in the ticket file on the branch for local, as a ticket comment after merge for remote). An attempt with no handoff is incomplete.
- **Claim on remote trackers.** Post a claim comment carrying the claimant and a nonce, assign the ticket, re-read the claim comments, and keep the claim only if it is the earliest unreleased one. Handing to the human posts a release comment.
- **Status.** GitHub and GitLab map canonical roles to labels through `docs/agents/triage-labels.md`; `closed` is the issue state. Jira maps roles to workflow statuses through a `Jira statuses:` line and moves tickets with transitions.
- **Tracker doc lines.** `Tracker: local`, `Tracker: github <owner>/<repo>`, `Tracker: gitlab <group>/<project>`, or `Tracker: jira <site URL> <project key>`; no line means local. `Pull requests:` gains `gitlab <group>/<project>`. Jira auth comes from `JIRA_EMAIL` and `JIRA_API_TOKEN`.
- **Ticket membership.** GitHub: sub-issues of the spec issue. GitLab: issues linked to the spec issue. Jira: issues whose parent is the spec epic.
- **Transports.** GitHub and GitLab adapters speak REST through `gh api` and `glab api`; Jira through `fetch`. Each adapter takes its transport as a dependency so tests run against in-memory fakes.
- **Trail.** For remote trackers the trail lives at `.autopilot/<spec key>/trail/<ticket>.tsv` in the repository; patch identity excludes it as it excludes `.scratch/`.
- **GitLab forge.** A `glab` forge adapter beside the GitHub one.

## Testing Decisions

- The orchestrator's existing suite keeps passing against the local adapter, unchanged in what it asserts.
- Each remote adapter is tested through the tracker port against an in-memory fake of its REST API: listing tickets with blockers, claim races (two claimants, earliest wins), hand to human, close after merge with the handoff comment, status mapping.
- One orchestrator run per remote tracker, with fake transport, fake harness, and fake forge, proves a ticket goes from claim to merge to closed with its handoff posted.
- Real-service smoke tests are opt-in by environment variable.

## Out of Scope

- Linear and other trackers (the port makes them one adapter each).
- Jira as a forge, Bitbucket.
- Migrating existing local tickets to a remote tracker.

## Further Notes

- Decided unattended under the user's "do the best" grant; each decision above is reversible.
