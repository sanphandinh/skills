# 02: Plan a ticket before any code is written

**What to build:** a `planner` role agent for Oh My Pi and Claude Code. Given a ticket, it reads the ticket, its spec, its blockers' handoffs and the code on the base branch, and returns a plan: decisions with reasons and ADR citations, the files to change and the files not to touch, interface signatures, tests per acceptance-criterion branch, verify commands, the door (`one-way` or `two-way`), and open questions. The implementer agents follow a plan when they get one and report every deviation. The planner works on its own and inside the factory.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] ROLES.md defines a `planner` role (Oh My Pi `@planner` falling back to `@plan`; Claude Code `opus`), and both platform plugins ship a `planner` agent with an output schema holding every plan section.
  Verify: `npm run validate` passes; read ROLES.md and both agent files.
- [ ] Given a ticket that leaves a product choice open, the planner returns the question and decides nothing about it.
  Verify: run the planner on a sample ticket with an open product choice; the result lists the question and holds no decision for it.
- [ ] Given a ticket that changes behaviour in stages, the plan names the files this ticket must not touch.
  Verify: run the planner on the first version of Ody-drive #61; the plan lists Recents and the sibling tickets' entry points as files not to touch.
- [ ] An implementer given a plan follows it and lists its deviations.
  Verify: run the implementer agent with a plan on a sandbox ticket; its result lists each deviation with a reason, or states there were none.
