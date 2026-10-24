# 01: Tracker port with the local adapter

**What to build:** every ticket operation in the orchestrator goes through a tracker port; the local markdown tracker becomes its first adapter and behaves exactly as before. The implementer returns its handoff in its result and the adapter places it.

**Blocked by:** None (can start immediately)

**Status:** closed

**Door:** two-way

- [x] The orchestrator reaches tickets only through the port
- [x] The existing orchestrator tests pass without weakening any assertion
- [x] An attempt with no handoff in its result is incomplete

## Handoff

**Delivered:** every ticket operation goes through a tracker port; `trackers/local.mjs` is the first adapter.
**Interfaces introduced:** tracker port `{ kind, key, trailDir, spec(), tickets(), claim(ticket, who), handToHuman(ticket, reason), pointer(ticket), prLink(ticket), onBranch(dir, ticket, { handoff }), afterMerge(ticket, { handoff, pr }), splitPrompt, split({ runSplitter, statusFor, trailRows }) }`; a ticket is `{ id, ref, title, status, blockedBy, claimedBy, door }`; `runAutopilot({ tracker })` injects one.
**Deviations from spec:** none.
**Decisions:** the implementer returns its handoff in `handoff`; an attempt without it is incomplete.
**Gotchas:** `pointer({ ref: spec })` is how prompts name the spec, so remote adapters must handle a bare `{ ref }`.
**For the next ticket:** 02, 03, 04: implement the same object; tickets are closed when `status === "closed"`.
