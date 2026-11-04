# 02: Plan a ticket before any code is written

**What to build:** a `planner` role agent for Oh My Pi and Claude Code. Given a ticket, it reads the ticket, its spec, its blockers' handoffs and the code on the base branch, and returns a plan: decisions with reasons and ADR citations, the files to change and the files not to touch, interface signatures, tests per acceptance-criterion branch, verify commands, the door (`one-way` or `two-way`), and open questions. The implementer agents follow a plan when they get one and report every deviation. The planner works on its own and inside the factory.

**Blocked by:** None (can start immediately)

**Status:** closed

**Door:** two-way

- [x] ROLES.md defines a `planner` role (Oh My Pi `@planner` falling back to `@plan`; Claude Code `opus`), and both platform plugins ship a `planner` agent with an output schema holding every plan section.
  Verify: `npm run validate` passes; read ROLES.md and both agent files.
- [x] Given a ticket that leaves a product choice open, the planner returns the question and decides nothing about it.
  Verify: run the planner on a sample ticket with an open product choice; the result lists the question and holds no decision for it.
- [x] Given a ticket that changes behaviour in stages, the plan names the files this ticket must not touch.
  Verify: run the planner on the first version of Ody-drive #61; the plan lists Recents and the sibling tickets' entry points as files not to touch.
- [x] An implementer given a plan follows it and lists its deviations.
  Verify: run the implementer agent with a plan on a sandbox ticket; its result lists each deviation with a reason, or states there were none.

## Handoff

**Delivered:** the `planner` agent for Oh My Pi (`structured: true`, so its output schema is enforced) and Claude Code; ROLES.md's `planner` role; implementers follow a plan and return `deviations`. On a sandbox ticket with an open choice ("Add a truncate command") the planner returned three questions with options and marked every dependent part `open until question <n> is answered`. On the first version of Ody-drive #61 it named `app/(tabs)/recents.tsx` and `buildViewerRoute` as untouched (#62's scope), the track switch (#62) and reader activation (#63) as unchanged, and raised the open-target sheet question that cost #61 three rounds. The implementer built an `upper` command from a plan, touched exactly the planned files and returned `deviations: []`.
**Interfaces introduced:** planner output `{ plan, door, filesToChange, filesNotToTouch, questions, note? }`; implementer output gains `deviations[] { change, reason }`.
**Deviations from spec:** none.
**Decisions:** the planner's plan headings are Decisions, Change map, Interfaces, Tests, Verify, Door, Questions.
**Gotchas:** without `structured: true`, Oh My Pi does not enforce an agent's `output` schema (the first Ody run returned its own shape). The #61 run also read the issue's later comments, so part of its foresight came from the thread.
**For the next ticket:** 03: the planner work order asks for this shape and the coordinator posts `plan` as `## Factory plan`.
