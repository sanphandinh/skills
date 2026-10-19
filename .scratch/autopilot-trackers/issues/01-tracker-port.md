# 01: Tracker port with the local adapter

**What to build:** every ticket operation in the orchestrator goes through a tracker port; the local markdown tracker becomes its first adapter and behaves exactly as before. The implementer returns its handoff in its result and the adapter places it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] The orchestrator reaches tickets only through the port
- [ ] The existing orchestrator tests pass without weakening any assertion
- [ ] An attempt with no handoff in its result is incomplete
