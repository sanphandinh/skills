# 04: Jira tracker adapter

**What to build:** autopilot builds a Jira epic's issues, statuses mapped by a Jira statuses line, transitions to close after merge, auth from JIRA_EMAIL and JIRA_API_TOKEN.

**Blocked by:** 01

**Status:** closed

**Door:** two-way

- [x] Adapter tests against an in-memory Jira API
- [x] No credential is ever written to a file or a log

## Handoff

**Delivered:** `jiraTracker` over a fetch transport (`jiraApi`), statuses from `Jira statuses:` (defaults Backlog, To Do, Blocked, Done), moves by transition.
**Interfaces introduced:** `adfText`, `jiraStatuses`; `fakeJira()` in the test helpers.
**Deviations from spec:** claim markers are posted as visible `[autopilot:claim ...]` text, because rich text drops HTML comments; the shared lock accepts both forms.
**Decisions:** a Jira status in the done category also reads as closed.
**Gotchas:** a missing transition to a mapped status fails loudly and names the tracker doc line to fix.
**For the next ticket:** 05: document `Tracker:`, `Pull requests:`, and `Jira statuses:`, and the `JIRA_EMAIL` and `JIRA_API_TOKEN` environment.
