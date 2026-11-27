# Work orders

A work order is everything a worker gets; it starts with nothing else. Fill the common part and the step's part, replace every `<…>`, and pass the whole text to start-worker with the model **Routing** picked (COORDINATOR.md). `<route>` is that candidate's id, written as its line in `providers.md` spells it (MEMORY.md), without `effort`; a worker restarted on another candidate (**Quota**) gets `<route>` filled again. Point to documents by link or path instead of pasting them. `<smode>` is the absolute folder of the `smode` skill on this machine, found as smode's **Running a skill by name** says; check that `<smode>/SKILL.md` exists before the first work order of a turn.

A work order holds only what is the factory's own: the checkout, the branch, what the worker may not do, where the result goes, and the lessons from memory. What the step does, how its verdicts are judged and what its result holds belong to the smode playbook it runs and to `<smode>/RESULTS.md`; never restate them here.

Every worker of a ticket works in the coordinator's workspace, one after the other or, for a verify ‖ review pair, side by side. The coordinator's reset gate runs before each step, so a worker starts on the branch at its pushed head with a clean tree.

## Common part

> Factory worker `<number> <step>` for `<owner>/<repo>`, ticket #<number> "<title>"<, rework round <n>>.
>
> Workspace: this checkout, branch `<branch>` at `<head commit>`, trunk `<trunk>`. Other workers of this ticket may use the same checkout. Read the project's `AGENTS.md` first and the docs it points to; the tracker doc is `docs/agents/issue-tracker.md`. Reply language: read `docs/agents/response-language.md` when it exists (else `match-user`). Copy its `Reply language:` value into every brief and human-facing comment. When that value is `match-user` and there is no live user message, resolve the language as the ticket or spec when it has prose, else the latest human comment on it, else English, and name that resolved language in the brief.
> Ticket: <url>. Spec: <url, or "none">. Plan: <url of the latest `## Factory plan` comment, or "none yet">. Handoffs of the tickets that blocked it: <urls, or "none">.
> <Lessons from memory that apply to this ticket, each with its source, or nothing.>
>
> You run in smode. Read the whole file `<smode>/SKILL.md`, then run its `<playbook>` playbook (`<smode>/playbooks/<playbook>.md`) for this step, under the rules below; this order names the playbook, so skip smode's routing. Skills it names are at: <one absolute `SKILL.md` path per skill the playbook names, resolved by the coordinator>. These paths are outside your workspace: when your file tool refuses one, read or write it with the shell. Run every command from this checkout, not from the shell's start folder, and never inside a folder this order names by absolute path: those paths are only to read or to write the result. Run every command in the foreground and wait for it; never move one to the background and end your turn, because the manager then counts the step as finished.
>
> Talk to your coordinator only through the agent manager: read its follow-ups at each checkpoint, and ask through the manager, never in your own terminal. When the manager gives you no way to ask, do not guess: report failed with the question in `questions`. Leave GitHub to the coordinator: no comments, pull requests, labels or statuses; it posts from your result. Start no agent beyond the sub-agents a skill starts by design. Never merge, force-push, deploy or delete data, and never switch, reset or clean this checkout: the coordinator does that between steps.
>
> When the step is finished, write the result as one JSON object to `<memory>/results/<number>-<step>-<n>.json`: the common keys and the `<step>` keys of `<smode>/RESULTS.md`, with `step` set to `<step>`, `ticket` to `<number>`, and `route` to `<route>` exactly as written here. Then report completion through the manager with that path: succeeded when the step is done, failed when it is not.

## plan

> Step: plan the ticket. Read only: change no file and make no commit. <On a revision: revise the latest plan to resolve these findings, keeping what still holds: <findings>.>

Playbook: `plan-ticket`. Role: `thinker`. Skills to resolve: none beyond the playbook's.

## build

> Step: build the ticket test-first, following the plan, on the branch this checkout is on. Commit each finished unit and push after every commit, naming the remote branch: `git push origin HEAD:<branch>`. <On rework round <n>: fix exactly these findings, keeping the earlier work: <findings>.> <For a person's comment: make the change this comment asks for, keeping the earlier work: <comment, with its link>.>
>
> The coordinator verifies, reviews and opens the pull request: stop the playbook at its step 7. In `pr_body`, the Merge Danger section gives the door, and a blast radius from the allowed list in `docs/agents/merge-policy.md` whenever the change fits one; add a "Deviations from the plan" section, and end the body with `Closes #<number>`. On a rework round, write the whole `pr_body` and the whole `handoff` again: they replace the old ones.

Playbook: `ticket`. Role: `worker`. Skills to resolve: `tdd`, `pr`.

### build: update from trunk

Given in **Land** (COORDINATOR.md) when `git merge-tree` found that trunk merges cleanly, and as the conflict order when it found conflicts.

> Step: bring trunk into the branch. Run `git fetch origin`, then `git merge origin/<trunk>`. <Only for conflicts: resolve the conflicts in these files: <files from `git merge-tree`>, keeping both sides' intent. When a conflict touches a protected path of `docs/agents/merge-policy.md`, or resolving it would change what another ticket built (its handoff says what it meant), stop: abort the merge, change nothing, and report failed with the conflict in `questions`.> Run the whole test suite, commit the merge, and push with `git push origin HEAD:<branch>`. Change nothing beyond the merge and what the tests need. Write the result with the `build` keys: `head_sha`, and `pr_title`, `pr_body` and `handoff` copied unchanged from the latest build result (`<path of that result>`).

Playbook: none: this order is the whole step. Role: `worker`. Skills to resolve: none.

## verify

> Step: verify pull request <url> at commit `<head_sha>`. Read only: change no tracked file and make no commit. Save evidence (screenshots, logs) under `<memory>/evidence/<number>/`, never in this checkout. <When this is a re-run after an unverified round: the criteria still open are <list>; last time <reasons>.> <When the project's `Scarce resources` names one this step holds: you hold <resource>; follow the playbook's rules for a scarce resource.>

Playbook: `verify`. Role: `reviewer`, of another model family than the build's. Skills to resolve: none beyond the playbook's.

## review

> Step: review pull request <url> at commit `<head_sha>`, with the fixed point `origin/<trunk>`. Read only: change no file and make no commit. Review the commits, not the working tree: a verifier may be running in this checkout, and untracked files it makes are not part of the change.

Playbook: `review`. Role: `reviewer`, of another model family than the build's. Skills to resolve: `code-review`.
