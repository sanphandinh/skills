# Pickup

Take over work in flight: from a handoff document, a ticket's handoff, a branch, or another agent's report.

1. Find the source: the handoff the user names, the latest `## Handoff` on the ticket, or the branch and its commits. A handoff written by the `handoff` skill is the primary source.
2. Restate the goal from the source, then check every claim it makes against the current state: the branch head, `git status`, the tests, the pull request's checks. Trust what you observed over what the handoff says.
3. List what is done, what is in progress, and what is not started. For work in progress, find the last unit that is green and start from there.
4. Match the remaining work to a playbook and continue it; its todo list starts at the first step not yet done.
5. Before you stop, write a new handoff with the `handoff` skill so the next pickup starts from facts.

**Reply:** what you took over, which claims held and which did not (measured), what you did, and where the next handoff is.
