# Result objects

What a worker returns when its work order asks for a result object: one JSON object, keys in snake_case, written where the work order says. This file is the only definition; playbooks and the `factory` skill point here instead of listing keys, and `npm run validate` fails when the factory reads a key that is not below.

## Common keys

Every result has these:

- `step`: `plan`, `build`, `verify` or `review`, as the work order names it.
- `ticket`: the ticket's number or id, as the work order gives it.
- `route`: the candidate the factory's coordinator started this worker on, copied exactly from the work order, never your own guess (`<provider>/<model>`, then ` via=<channel>` when it has one).
- `ok`: true when the step is done.
- `summary`: three sentences: what you did, what you found, what remains.
- `questions`: product questions you could not settle, each with its options and your recommendation; empty when none.
- `lessons`: facts a later worker would want (a trap, a command, a convention), each with its source (a file, a commit, a link); empty when none.

## plan

From the `plan-ticket` playbook.

- `plan`: the plan as markdown, with the playbook's headings (Decisions, Change map, Interfaces, Tests, Verify, Door, Questions, Split).
- `door`: `one-way` or `two-way`.
- `files_to_change`: the paths the plan changes.
- `files_not_to_touch`: the paths the plan leaves alone.

## build

From the `ticket` playbook, stopped at its step 7.

- `head_sha`: the commit you pushed last.
- `pr_title`: the pull request's title.
- `pr_body`: the whole pull request body, written with the `pr` skill.
- `handoff`: the whole handoff, from the template in `docs/agents/issue-tracker.md`, naming interfaces by name and behaviour, never by file path or line.
- `deviations`: each departure from the plan with its reason; empty when none.

## verify

From the `verify` playbook.

- `verdict`: `FAIL` when any criterion is `fail`; else `UNVERIFIED` when any is `unverified`; else `PASS`, or `PASS+NOTES` when you have notes.
- `head_sha`: the commit you checked.
- `criteria`: one object per acceptance criterion:
  - `criterion`: the criterion as the ticket words it.
  - `status`: `pass`, `fail` or `unverified`.
  - `reason`: for `fail` and `unverified`, what you saw or what stopped you.
- `evidence`: per criterion, what you ran or did and what you saw.
- `findings`: as in **Findings** below.

## review

From the `review` playbook.

- `verdict`: `pass` when no finding is blocking, else `fail`.
- `head_sha`: the commit you reviewed.
- `findings`: as in **Findings** below.

## Findings

Each finding of `verify` or `review` is an object:

- `severity`: `blocking` or `note`. The worker that found it owns it; nobody downstream changes it.
- `kind`: `design`, `code`, `test` or `scope`.
- `detail`: what is wrong, where, and why it matters.
