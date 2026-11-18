# Work orders

A work order is everything a worker gets; it starts with nothing else. Fill the common part and the step's part, replace every `<…>`, and pass the whole text to start-worker with the model **Routing** picked. `<route>` is that candidate's id, written as its line in `providers.md` spells it (MEMORY.md), without `effort`; a worker restarted on another candidate (**Quota**) gets `<route>` filled again. Point to documents by link or path instead of pasting them. `<smode>` is the absolute folder of the `smode` skill on this machine, found as smode's **Running a skill by name** says; check that `<smode>/SKILL.md` exists before the first work order of a wake.

A work order holds only what is the factory's own: the checkout, the branch, what the worker may not do, where the result goes, and the lessons from memory. What the step does, how its verdicts are judged and what its result holds belong to the smode playbook it runs and to `<smode>/RESULTS.md`; never restate them here.

## Common part

> Factory worker `<number> <step>` for `<owner>/<repo>`, ticket #<number> "<title>"<, rework round <n>>.
>
> Workspace: this checkout, branch `<branch>`, trunk `<trunk>`. Read the project's `AGENTS.md` first and the docs it points to; the tracker doc is `docs/agents/issue-tracker.md`. Reply language: read `docs/agents/response-language.md` when it exists (else `match-user`). Copy its `Reply language:` value into every brief and human-facing comment. When that value is `match-user` and there is no live user message, resolve the language as the ticket or spec when it has prose, else the latest human comment on it, else English, and name that resolved language in the brief.
> Ticket: <url>. Spec: <url, or "none">. Plan: <url of the latest `## Factory plan` comment, or "none yet">. Handoffs of the tickets that blocked it: <urls, or "none">.
> <Lessons from memory that apply to this ticket, each with its source, or nothing.>
>
> You run in smode. Read the whole file `<smode>/SKILL.md`, then run its `<playbook>` playbook (`<smode>/playbooks/<playbook>.md`) for this step, under the rules below; this order names the playbook, so skip smode's routing. Skills it names are at: <one absolute `SKILL.md` path per skill the playbook names, resolved by the coordinator>. These paths are outside your workspace: when your file tool refuses one, read or write it with the shell. Run every command from this checkout, not from the shell's start folder, and never inside a folder this order names by absolute path: those paths are only to read or to write the result. Run every command in the foreground and wait for it; never move one to the background and end your turn, because the manager then counts the step as finished.
>
> Talk to your coordinator only through the agent manager: read its follow-ups at each checkpoint, and ask through the manager, never in your own terminal. When the manager gives you no way to ask, do not guess: report failed with the question in `questions`. Leave GitHub to the coordinator: no comments, pull requests, labels or statuses; it posts from your result. Never merge, force-push, deploy or delete data.
>
> When the step is finished, write the result as one JSON object to `<memory>/results/<number>-<step>-<n>.json`: the common keys and the `<step>` keys of `<smode>/RESULTS.md`, with `step` set to `<step>`, `ticket` to `<number>`, and `route` to `<route>` exactly as written here. Then report completion through the manager with that path: succeeded when the step is done, failed when it is not.

## plan

> Step: plan the ticket. Read only: change no file and make no commit. <On a revision: revise the latest plan to resolve these findings, keeping what still holds: <findings>.>

Playbook: `plan-ticket`. Role: `thinker`. Skills to resolve: none beyond the playbook's.

## build

> Step: build the ticket test-first, following the plan. Work on the local branch `<local branch>` (switch to it first: a checker may have left this checkout detached); the remote branch is `<branch>`. When `origin/<branch>` exists, start with `git pull --ff-only origin <branch>`. Commit each finished unit and push after every commit (`git push -u origin HEAD:<branch>`). Before finishing, merge trunk into the branch if trunk moved, resolve conflicts, run the tests, and push. <On rework round <n>: fix exactly these findings, keeping the earlier work: <findings>.>
>
> The coordinator verifies, reviews and opens the pull request: stop the playbook at its step 7. In `pr_body`, the Merge Danger section gives the door, and a blast radius from the allowed list in `docs/agents/merge-policy.md` whenever the change fits one; add a "Deviations from the plan" section, and end the body with `Closes #<number>`. On a rework round, write the whole `pr_body` and the whole `handoff` again: they replace the old ones.

Playbook: `ticket`. Role: `worker`. Skills to resolve: `tdd`, `pr`.

## verify

> Step: verify pull request <url> at commit `<head_sha>`. Read only: change no file and make no commit. <When this is a re-run after an unverified round: the criteria still open are <list>; last time <reasons>.> <When the project's `Scarce resources` names one this step holds: you hold <resource>; follow the playbook's rules for a scarce resource.>

Playbook: `verify`. Role: `reviewer`, of another model family than the build's. Skills to resolve: none beyond the playbook's.

## review

> Step: review pull request <url> at commit `<head_sha>`, with the fixed point `origin/<trunk>`. Read only: change no file and make no commit.

Playbook: `review`. Role: `reviewer`, of another model family than the build's. Skills to resolve: `code-review`.
