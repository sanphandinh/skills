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

**Tracker:** local

**Pull requests:** github sanphandinh/skills

Code for a ticket still goes through a pull request on this repository, even though tickets live here. Every pull request operation names this repository explicitly; never let a tool infer it from git remotes, because a second remote (such as `upstream`) may point somewhere else.

## Factory

**Tracker:** local

Read by the `factory` skill. A **spec** is a directory `.scratch/<feature-slug>/` that contains `spec.md`; it stays open while the spec or any of its tickets is not `Status: closed`. A spec is **approved** when its tickets that should be built carry `Status: ready-for-agent` (the agent-ready role from `triage-labels.md`) and the spec is not waiting on a person. Its **tickets** are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`. A **standalone ticket** is an open issue file with `Status: ready-for-agent` under `.scratch/<slug>/issues/` when that folder has no `spec.md`, or under `.scratch/factory-fixes/issues/` for trunk-fix work. A ticket is **blocked** while any ticket named in its `Blocked by:` line is not `Status: closed`. **Priority** on a spec is `Priority: p1`, `Priority: p2`, or `Priority: p3` on `spec.md`; missing means `p2`. A **hold** is `Status: ready-for-human` with a `## Factory brief` under `## Comments`; when a pull request exists, also add the `factory:hold` label on GitHub. The factory appends `## Factory plan`, verify, review, rework, and brief sections under the ticket's `## Comments`, commits those ticket updates to trunk outside pull requests, and after merge appends `## Handoff` and sets `Status: closed`.

## Claiming and closing tickets

- **Claim**: add `Claimed-by: <who>` (a person) near the top, commit only that change, and push it to trunk before any other work. A rejected push means someone claimed first: pull and pick another ticket. The factory works only tickets nobody claimed.
- **Factory comments**: the factory appends its plan, its questions and its briefs under the ticket's `## Comments` heading, and holds a ticket for a person by setting `Status: ready-for-human` with a brief; a person releases it by setting `Status: ready-for-agent` again. The factory commits these changes to trunk on their own, never inside a pull request.
- **Close**: set `Status: closed` and tick the acceptance criteria. By hand, close on the ticket's own branch so the close lands in the same merge as the code; the factory closes the ticket on trunk right after its pull request merges.
- **Acceptance criteria**: every criterion is a checkbox with a `Verify:` line under it naming the command or action that checks it.
- **Specs and standalone tickets**: a folder with a `spec.md` is a spec; a folder with only `issues/` holds standalone tickets that build without a spec. The factory files fix tickets for a red trunk in `.scratch/factory-fixes/issues/`.

## Handoff

When a ticket is done, append a `## Handoff` section to its file, on the ticket's branch; the factory appends it on trunk right after the merge instead. Whoever picks up a ticket reads the handoff of every ticket that blocked it before starting. Describe interfaces by name and behaviour, never by file path or line number: the handoff must stay true while the code moves.

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
