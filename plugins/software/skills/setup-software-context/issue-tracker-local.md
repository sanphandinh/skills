# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- `.scratch/` is committed with the repo, so claims and handoffs reach everyone who pulls

## Pull requests

**Pull requests:** github <owner>/<repo>

Code for a ticket still goes through a pull request on this repository, even though tickets live here. Every pull request operation names this repository explicitly; never let a tool infer it from git remotes, because a second remote (such as `upstream`) may point somewhere else.

## Claiming and closing tickets

- **Claim**: add `Claimed-by: <who>` (a person, or `autopilot@<host>`) near the top, commit only that change, and push it to trunk before any other work. A rejected push means someone claimed first: pull and pick another ticket.
- **Progress**: an unattended run records its phase on an `Autopilot: <phase>` line near the top (`implementing`, `pr-open`, `verifying`, `reviewing`, `merge-ready`). It is not a triage role and never replaces `Status:`.
- **Close**: set `Status: closed` and tick the acceptance criteria. Close on the ticket's own branch so the close lands in the same merge as the code.

## Handoff

When a ticket is done, append a `## Handoff` section to its file, on the ticket's branch. Whoever picks up a ticket reads the handoff of every ticket that blocked it before starting. Describe interfaces by name and behaviour, never by file path or line number: the handoff must stay true while the code moves.

```markdown
## Handoff

**Delivered:** the behaviour that now works, against the acceptance criteria
**Interfaces introduced:** types, functions, endpoints, config that later tickets build on
**Deviations from spec:** where the work differs from the spec, and why
**Decisions:** choices made along the way, with a pointer to the decision trail if one exists
**Gotchas:** traps found, things left undone, deliberate debt
**For the next ticket:** one entry per ticket this one unblocks (`NN: what it should know`)
**Links:** pull request, merge commit, verdict, decision trail
```

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by the `wayfinder` skill. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
