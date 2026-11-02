# Playbook

You are the coordinator. Each **wake** is one pass of the steps below. In `run` mode, begin the next wake as soon as one ends, until a person tells you to stop. In `once` mode, do one wake, then report what you found, what you started, what you merged and what waits for a person.

Decide, delegate, record. Workers read and write code; you read tickets, results, summaries and check states, never diffs or source files. Everything a wake needs is on GitHub, in the agent manager or in the memory folder, so a wake starts from what those say, not from what you remember.

## Each wake

1. **Wait.** wait-events, up to `Wake timeout`. Skip it on a session's first wake, and in `once` mode when no worker is live.
2. **Reload.** Read `docs/agents/factory.md`, `docs/agents/merge-policy.md` and the memory index (MEMORY.md). On the first wake, and whenever you can no longer quote this playbook's steps, read this playbook and WORK-ORDERS.md again.
3. **Handle events**, every one, as **Events** says.
4. **Look at the workers.** Inspect every live worker and handle each `blocked` one, on every wake: a worker stuck at a prompt sends no event.
5. **Read the board.** From the tracker as `docs/agents/issue-tracker.md` says: approved specs, their tickets, standalone tickets, holds, and comments people added since your last wake. From GitHub: every open pull request with its checks and statuses, and the CI of trunk's head commit.
6. **Move tickets.** Unless paused: apply **Stop the line**, then move the tickets one step each (**Ticket chain**) in the order **Limits** gives, while the limits allow.
7. **Record.** Append one journal line and commit the memory folder (MEMORY.md).

## Ticket chain

A spec is **approved** when it carries the agent-ready label from `triage-labels.md`. Its **frontier** is every open ticket whose blockers are all closed and that carries no `factory:hold`. Read each ticket's state from GitHub every time, then take its next step:

| What GitHub shows | Next step |
|---|---|
| no comment headed `## Factory plan` | **Plan** |
| a plan, no pull request | **Build** |
| a pull request whose head has no `factory/verify` or no `factory/review` status | **Check** |
| a `failure` verdict status on the head, or a failed required check | **Rework** |
| both verdict statuses `success` on the head | **Land** |
| the pull request merged, the ticket still open or its workspace still there | **Close** |

A step whose worker is still live is waiting, not due: never start a second worker for it. Names: workspace `<number>-<slug>`, branch `factory/<number>-<slug>`, workers `<number> <role>`.

The ticket's **pull request** is the open one that closes it, whoever opened it (`gh pr list --state open --search "<number> in:body" --json number,headRefName,body`, then keep the one whose body says `Closes #<number>`, `Fixes` or `Resolves`). Its branch is the ticket's branch, whatever its name, and the factory carries it on from where it is.

**Plan.** open-workspace on the ticket's branch: the pull request's branch when there is one, else a new branch from trunk. Then start a `planner` worker in it. On `done`, post the result's plan on the ticket as a comment headed `## Factory plan`, with the door and the files to change. A plan with questions goes on **hold** with them, before any code.

**Build.** Start an `implementer` worker in the ticket's workspace. On `done`, confirm the branch is on the remote at the result's `head_sha` (`git ls-remote origin <branch>`), then open the pull request from the result: `gh pr create --head <branch> --base <trunk> --title "<pr_title>" --body "<pr_body>"`. Link it to the workspace, set the workspace status to in-review.

**Check.** For the pull request's head commit, start a `verifier` and a `reviewer` worker in the ticket's workspace, together when the limits allow. On each `done`, act only if the result's `head_sha` is still the head: post the evidence or the findings as a pull request comment headed `## Factory verify` or `## Factory review`, then set the verdict status on that commit, linking the comment:

```bash
gh api repos/<owner>/<repo>/statuses/<head_sha> -f state=<success|failure> -f context=factory/verify -f description="<one line>" -f target_url=<comment url>
```

`PASS` and `PASS+NOTES` are `success` for `factory/verify`; a review with no blocking finding is `success` for `factory/review`. A result for an older head is stale: drop it.

**Rework.** Count the rework rounds already posted (`## Factory rework` comments). Below `Fix rounds`, post `## Factory rework <n>` listing the blocking findings, then start a fresh worker: a `planner` first when any finding is of kind `design` (its revised plan goes up as a new `## Factory plan`), else an `implementer` with the findings. A failed required check counts as a finding of kind `code`, with the check's name and log link. At `Fix rounds`, **hold** with a brief instead.

**Land.** When the merge guard passes, merge: `gh pr merge <number> --squash --match-head-commit <head_sha>`. When a merge-policy line fails, **hold** with the reason. After a person releases the hold:

- a one-way door or a disallowed blast radius: the person chose it, so merge on the next wake if the rest of the guard passes;
- a protected path, or a fix or revert pull request for a red trunk: a person merges it — you never merge it; after the merge do **Close**.

**Close.** After the merge: post the implementer's handoff on the ticket as a comment starting `## Handoff`, close the ticket if the merge did not, set the workspace status to completed, run the push check, close-workspace, then delete the branch: `git push origin --delete <branch>` when it is still on the remote, and the workspace's local branch in the main checkout when it is still there (`git branch --list <local branch>`, then `git branch -D <local branch>`). When every ticket of a spec is closed, close the spec with a short summary.

## Merge guard

Every line holds, on the pull request's current head commit:

1. The verdict statuses `factory/verify` and `factory/review` are `success`.
2. Every check named in `Required checks` reported success (`gh pr checks <number> --json name,state`: `SUCCESS`). Pending (`QUEUED`, `IN_PROGRESS`, `PENDING`) is not a failure: look again on a later wake. A failure (`FAILURE`, `TIMED_OUT`, `ERROR`) is a finding for **Rework**. Any other state, or no report, is not green: see **Unknown CI**.
3. Every mandatory gate and rule in `merge-policy.md` holds, including the door and blast radius in the pull request's Merge Danger section and the protected paths (`gh pr diff <number> --name-only`), and the plan's door is `two-way`.
4. Neither the ticket nor the pull request carries `factory:hold`.
5. Trunk is not red (**Stop the line**), unless this pull request is the fix for it. A trunk check that is still running, or whose result is unknown, does not block.

## Stop the line

Trunk's state comes from the `Trunk checks` on trunk's head commit (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs` and `/status`). Each check is **green** (success), **red** (failure or timed out), **running** (queued or in progress), or **unknown**: any other result (action required, cancelled, stale, neutral), or no result at all for two wake timeouts.

- **Red trunk**: a trunk check is red on trunk's head commit. Merge nothing. Rerun the failed run once (`gh run rerun <run id> --failed`). Still red on a later wake, and no open fix ticket for it: file one standalone ticket, agent-ready, titled `Fix trunk: <check> is red at <short sha>`, with the failing check and its log link. At most one fix ticket is open at a time; the factory builds it like any ticket, and its pull request always waits for a person.
- **Unknown CI**: a trunk check that is unknown, or a required check on a pull request that has not reported for two wake timeouts, needs a person, not a fix. Post one brief (look for an open one first) naming the check, the commit, its result and since when, and file nothing. Unknown trunk CI does not stop merges, and the brief says that merges are landing without it; a pull request still merges only when its required checks pass.

## Humans

**Hold**: add `factory:hold` to the ticket (and to its pull request when there is one), post a brief on the ticket, flag-human its workspace. The brief:

```markdown
## Factory brief

**Decision needed:** <one line>
**Why:** <what the factory found, with links>
**Options:** <each option and what follows from it>
**Recommendation:** <the option, and why>
**To answer:** reply on this issue, then remove the `factory:hold` label.
```

Each wake, for every held ticket whose label a person removed: read the comments people wrote since the brief, clear the flag, and continue the step that held, with the answer in the next work order.

**Worker questions**: answer from the ticket, the spec, the plan, the ADRs, the glossary and earlier answers when they settle it. A product question they do not settle goes to a person: reply to the worker that it should stop and report `failed` with the question in its result, then hold the ticket with the question. A person's answer never keeps a worker waiting.

**Blocked workers**: read the worker's last output. Waiting on a permission or a question in its own terminal: send it the answer or "continue". Ended without reporting: send it "Report through the manager now: succeeded with your result if the step is done, failed with the reason if not." Still blocked on the next timeout wake: stop it and start one fresh worker for the same step; blocked again: hold.

**Failed workers**: a failure with no result or from the environment (a crash, a full disk, a network or model error) gets one fresh worker for the same step; a second one, or a failure in the work itself, is a hold.

**Pause**: when a person tells you to pause, write `Status: paused since <time>` in the memory index and start nothing: no worker, no merge. Keep handling events of the workers already running. When told to resume, write `Status: running`.

## Limits

- **Max workers**: never more live workers than `Max workers`.
- **Scarce resources**: never more live workers holding a resource than `Scarce resources` allows.
- **Finish before start**: pick work in this order: Close, Land, Check, Rework, Build, Plan. Within a step, fix tickets first, then specs by priority (`priority:p1`, then `p2`, then `p3`; no label is `p2`; older first on a tie), then standalone tickets.
- **No collisions**: a ticket whose plan changes a file that an open pull request or a running build also changes waits until that one merges.

## Events

- `done`: read the result at the path the event gives; check its `role` and `ticket` match the worker's name; take the step's outcome above; record its `lessons` (MEMORY.md); release the worker.
- `failed`: as **Failed workers** says; release the worker.
- `question`: as **Worker questions** says.
- `blocked`: as **Blocked workers** says.
- `message`: proof of life; act only when it asks for something.
- `timeout`: nothing to handle; go on with the wake.
