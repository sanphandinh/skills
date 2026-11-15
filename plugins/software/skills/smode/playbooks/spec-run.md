# Spec run

Build every ticket of an approved spec on one integration branch, with parallel workers.

1. Read the spec and its tickets, and draw the frontier: every open ticket whose blockers are all closed.
2. Run the `implement-spec` skill. It creates the integration branch, gives each frontier ticket to a fresh implementer in its own worktree, merges finished work, and widens the frontier as tickets close.
3. Each implementer runs the `ticket` playbook on its ticket, stopping before the pull request: the integration branch is the pull request.
4. When every ticket is merged, run the `review` playbook on the integration branch and the `verify` playbook on its head, each in a fresh worker. Fix blocking findings in one fresh worker and repeat.
5. Open or ready the pull request with the `pr` skill. Merging is an always-pause act.
6. Clean up the implementer worktrees.

**Reply:** each ticket's state and handoff, the review and verify verdicts with their commit, what was dropped and why, and the pull request link.
