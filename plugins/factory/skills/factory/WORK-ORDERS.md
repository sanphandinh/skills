# Work orders

A work order is everything a worker gets; it starts with nothing else. Fill the common part and the role's part, replace every `<…>`, and pass the whole text to start-worker. Point to documents by link or path instead of pasting them.

## Common part

> Factory worker `<number> <role>` for `<owner>/<repo>`, ticket #<number> "<title>"<, rework round <n>>.
>
> Workspace: this checkout, branch `<branch>`, trunk `<trunk>`. Read the project's `AGENTS.md` first and the docs it points to; the tracker doc is `docs/agents/issue-tracker.md`.
> Ticket: <url>. Spec: <url, or "none">. Plan: <url of the latest `## Factory plan` comment, or "none yet">. Handoffs of the tickets that blocked it: <urls, or "none">.
>
> <The role's delegation line, from its section below.>
>
> Talk to your coordinator only through the agent manager: read its follow-ups at each checkpoint, and ask through the manager, never in your own terminal. Leave GitHub to the coordinator: no comments, pull requests, labels or statuses; it posts from your result. Never merge, force-push, deploy or delete data.
>
> When the step is finished, write the result below as one JSON object to `<memory>/results/<number>-<role>-<n>.json`, then report completion through the manager with that path: succeeded when the step is done, failed when it is not.
>
> Every result has: `role`, `ticket` (the number), `ok` (true when the step is done), `summary` (three sentences: what you did, what you found, what remains), `questions` (product questions you could not settle, each with its options and your recommendation; empty when none), `lessons` (facts a later worker would want to know, such as a trap, a command or a convention, each with its source: a file, a commit or a link; empty when none).

## planner

> Step: plan the ticket. Read only: change no file and make no commit. <On a revision: revise the latest plan to resolve these findings, keeping what still holds: <findings>.>
>
> Result also has: `plan` (markdown with the headings Decisions, Change map, Interfaces, Tests, Verify, Door, Questions), `door` (`one-way` or `two-way`), `files_to_change`, `files_not_to_touch`.

Delegation line: "Delegate the step, with this whole work order, to the `planner` agent. When this session has no agent by that name, do the step yourself under the same rules. When the agent exists but fails (a provider error, a rate limit), report failed with the error instead of doing its step yourself."

## implementer

> Step: build the ticket test-first, following the plan. Work on the local branch `<local branch>` (switch to it first: a checker may have left this checkout detached); the remote branch is `<branch>`. When `origin/<branch>` exists, start with `git pull --ff-only origin <branch>`. Commit each finished unit and push after every commit (`git push -u origin HEAD:<branch>`). Before finishing, merge trunk into the branch if trunk moved, resolve conflicts, run the tests, and push. <On rework round <n>: fix exactly these findings, keeping the earlier work: <findings>.>
>
> Result also has: `head_sha` (the commit you pushed last), `pr_title`, `pr_body`, `handoff`, `deviations` (each departure from the plan with its reason; empty when none).
>
> Write `pr_body` with the `pr` skill. Its Merge Danger section gives the door, and a blast radius from the allowed list in `docs/agents/merge-policy.md` whenever the change fits one. Add a "Deviations from the plan" section, and end the body with `Closes #<number>`. On a rework round, write the whole body and the whole handoff again: they replace the old ones.
>
> Write `handoff` in this shape, naming interfaces by name and behaviour, never by file path or line:
>
> ```markdown
> ## Handoff
>
> **Delivered:** the behaviour that now works, against the acceptance criteria
> **Interfaces introduced:** types, functions, endpoints, config that later tickets build on
> **Deviations from spec:** where the work differs from the spec, and why
> **Decisions:** choices made along the way
> **Gotchas:** traps found, things left undone, deliberate debt
> **For the next ticket:** one entry per ticket this one unblocks
> ```

Delegation line: the planner's, with the `implementer` agent.

## verifier

> Step: prove the ticket works on the real product at commit `<head_sha>` of pull request <url>, following `docs/agents/verify.md`. First make `git rev-parse HEAD` equal `<head_sha>` (`git fetch origin` and `git checkout --detach <head_sha>` when it does not). Read only: change no file and make no commit.
>
> Judge each acceptance criterion on its own: `pass` (you ran it and saw it work), `fail` (you ran it and saw it break), or `unverified` (you could not reach the point to observe it: the environment, a device, an account or the automation got in the way), with what stopped you. A criterion is `fail` only on observed behaviour. <When this is a re-run after an unverified round: the criteria still open are <list>; last time <reasons>.>
>
> <When the project's `Scarce resources` names a resource you hold, such as a simulator, a device, a browser profile or a port:> while you hold <resource>, run one command against it at a time and wait for it to finish: never in the background, never in parallel, never several steps chained in one long script. Start by bringing it to a clean state as `docs/agents/verify.md` says. When a command times out or you abort it, stop whatever it left running (as `docs/agents/verify.md` says) before you retry.
>
> Result also has: `verdict` (`FAIL` when any criterion is `fail`; else `UNVERIFIED` when any is `unverified`; else `PASS`, or `PASS+NOTES` when you have notes), `head_sha` (the commit you checked), `criteria` (each with `criterion`, `status` `pass`, `fail` or `unverified`, and `reason` for the last two), `evidence` (per criterion: what you ran or did, and what you saw), `findings` (each with `severity` `blocking` or `note`, `kind` `design`, `code`, `test` or `scope`, and `detail`).

Delegation line: the planner's, with the `verifier` agent.

## reviewer

> Step: review pull request <url> at commit `<head_sha>` with the `code-review` skill: fixed point `origin/<trunk>`, the spec axis against the ticket and its plan, the standards axis against the repository's standards. First make `git rev-parse HEAD` equal `<head_sha>` as above. Read only.
>
> These constraints from the ticket, its spec and its plan are binding, and breaking any of them is a `blocking` finding, never a note: <every "do not", "must not", "keep", "unchanged" line, the plan's files not to touch, and the spec's out-of-scope list>. A change outside the plan that the pull request body does not disclose is `blocking` too.
>
> Result also has: `verdict` (`pass` when no finding is blocking, else `fail`), `head_sha`, `findings` (each with `severity`, `kind` and `detail`, as above). You decide the severity; the coordinator does not change it.

Delegation line: "Do the step yourself with the `code-review` skill; it starts its own review agents."
