# Ticket

Build exactly one ticket, on the branch you are given or a new one from trunk, from plan to pull request. Use a `worker` for the build when you delegate it.

1. Read the ticket the way `docs/agents/issue-tracker.md` says, its spec, and the handoff of every ticket that blocked it. When a handoff contradicts the ticket, follow the handoff (it describes merged code) and report the conflict, saying whether it changes what an acceptance criterion can mean.
2. With no plan for the ticket yet, run the `plan-ticket` playbook and write its plan, every heading, onto the ticket as a comment headed `## Plan` (where `docs/agents/issue-tracker.md` keeps comments) before writing any code. A worker whose work order asks for a result object returns the plan in it instead. A plan only in your head is a deviation. A plan with open questions stops here: ask the user, or report them when you are a worker.
3. Build test-first with the `tdd` skill at the seams the plan names. Make its decisions, change the files it lists to change, and leave alone the files it lists not to touch. Record every departure from it, with the reason, as a deviation.
4. Commit each finished unit on the branch. When the branch has a remote, push after each commit.
5. Check your own work before anyone else does, because every finding a reviewer makes costs a full round:
   - run the whole test suite and the typecheck, and compare the typecheck's errors with the base branch's: you add none;
   - list the files the branch changes against its base: each is in the plan's files to change or in the deviations, and none is in its files not to touch;
   - for every acceptance criterion, name the test that proves it, and walk its edges (repeats, order, the second call, cleanup on every exit path).
6. Write the ticket's handoff from the template in `docs/agents/issue-tracker.md`, naming interfaces by name and behaviour, never by file path.
7. When your work order says the coordinator verifies, reviews and opens the pull request, stop here and report.
8. Run the `verify` playbook and the `review` playbook, each in a fresh worker that did not write the change, on the head you pushed.
9. Fix the blocking findings in a fresh worker with the findings in its work order, then repeat step 8 on the new head.
10. Write the pull request body with the `pr` skill, including its Merge Danger section and a "Deviations from the plan" section, and open the pull request. Merging is an always-pause act.

Steps 2, 5, 8 and 9 are never skipped, except that step 7 ends a worker's part early when its work order says so. Never review your own change, force-push a shared branch, deploy, or delete data.

**Reply:** what now works against each acceptance criterion, the self-check results, deviations, the verify and review verdicts with their head commit, and the pull request link. When a work order asks for a result object, give the `build` object of smode's `RESULTS.md`.
