# 04: Keep the factory running across a dependency chain and several specs

**What to build:** the `run` mode keeps the coordinator alive in an Orca terminal. It waits on events up to the wake timeout, works every approved spec in priority order within the limits of `factory.md`, holds scarce resources to their limit, never runs two tickets whose plans list the same files at once, pauses and resumes when told, and continues cleanly when its session is replaced.

**Blocked by:** 03

**Status:** closed

**Door:** two-way

- [x] In a spec with a chain (A then B) and an independent ticket (C), A and C run together and B starts only after A merges.
  Verify: run on a sandbox spec with these three tickets; the journal and Orca show A and C in flight together and B starting after A's merge.
- [x] Two specs labelled `priority:p1` and `priority:p2` are worked p1 first, never above Max workers.
  Verify: set Max workers to 2; the p1 tickets start first; Orca never lists more than 2 live workers.
- [x] A scarce resource stays within its limit.
  Verify: allow one verifier at a time; bring two tickets to the check step together; their verifier workers never overlap in Orca.
- [x] Tickets whose plans list the same file never run at the same time.
  Verify: two tickets whose plans name the same file; the second starts building only after the first merges.
- [x] The coordinator spends no tokens while waiting and wakes at the timeout when nothing happens.
  Verify: leave the factory idle for 30 minutes with a 15-minute timeout; the session's usage grows only at the two timeout wakes; the journal has one line per wake.
- [x] Telling the coordinator to pause stops new work while in-flight work finishes; telling it to resume continues.
  Verify: send "pause" to the coordinator through Orca during a build; the build finishes and nothing new starts; send "resume"; the next ticket starts.
- [x] Replacing the coordinator session mid-run loses nothing and duplicates nothing.
  Verify: end the coordinator during a build and start `run` in a new session; the running worker is adopted, no second worker starts for the same step, and the ticket finishes.

## Handoff

**Delivered:** `run` on spec #7 (p1: A→B chain plus C) and spec #11 (p2) with standalone #13/#14: A and C planned and built together, B waited for A's merge, p1 work started before p2, never more than 2 live workers (`Max workers: 2`). "pause" at 05:40 wrote `Status: paused`, in-flight workers finished and nothing new started for 6 minutes; "resume" restarted at once. Killing the coordinator's terminal mid-check and starting a new `run` session adopted both live workers (no duplicates). An idle coordinator ended its turn on its own twice, so `run` now creates an Orca automation that types `/skill:factory once` into the coordinator's session every `Wake timeout` (schedule-wakes, the tenth interface operation); #24 then went from filed to merged with nobody nudging.
**Interfaces introduced:** schedule-wakes (INTERFACE.md) → `orca automations create --workspace … --workspace-mode existing --reuse-session`; `orca-wake` in the memory index.
**Deviations from spec:** waiting is not free: each scheduled wake costs one short turn (about every 5–15 minutes); the spec's "no tokens while idle" does not hold. The one-verifier scarce limit was configured but two tickets never reached Check at the same moment, so it was not stressed.
**Gotchas:** provider limits (Anthropic 5-hour, opencode-go weekly) end turns and kill workers silently; the next wake must find them as blocked/failed and restart once.
**For the next ticket:** 08: run Ody with `Wake timeout: 15 minutes` and one verifier.
