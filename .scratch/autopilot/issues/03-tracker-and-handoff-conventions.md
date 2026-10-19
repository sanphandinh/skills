# 03: Tracker conventions for claims and ticket handoff

**What to build:** the local markdown tracker gains the conventions autopilot needs, and the `handoff` skill can write a handoff into a ticket so the next person or agent can continue from what was actually built.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The local tracker template (and this repo's tracker doc) define an `Autopilot:` phase line, a `Claimed-by:` line, a `## Handoff` section, and how a ticket is closed, without adding autopilot phases to the triage `Status:` vocabulary
- [ ] The `handoff` skill has a ticket mode that appends the handoff template to the ticket file instead of the OS temp directory; session mode is unchanged
- [ ] The handoff template has Delivered, Interfaces introduced, Deviations from spec, Decisions, Gotchas, For the next ticket (one entry per unblocked ticket), and Links, and asks for interfaces by name and behaviour, not file paths or lines
- [ ] The tracker doc states that `.scratch/` must be committed for handoffs to reach other people
- [ ] `npm run validate` passes
