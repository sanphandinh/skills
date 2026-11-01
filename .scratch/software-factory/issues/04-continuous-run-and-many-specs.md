# 04: Keep the factory running across a dependency chain and several specs

**What to build:** the `run` mode keeps the coordinator alive in an Orca terminal. It waits on events up to the wake timeout, works every approved spec in priority order within the limits of `factory.md`, holds scarce resources to their limit, never runs two tickets whose plans list the same files at once, pauses and resumes when told, and continues cleanly when its session is replaced.

**Blocked by:** 03

**Status:** ready-for-agent

**Door:** two-way

- [ ] In a spec with a chain (A then B) and an independent ticket (C), A and C run together and B starts only after A merges.
  Verify: run on a sandbox spec with these three tickets; the journal and Orca show A and C in flight together and B starting after A's merge.
- [ ] Two specs labelled `priority:p1` and `priority:p2` are worked p1 first, never above Max workers.
  Verify: set Max workers to 2; the p1 tickets start first; Orca never lists more than 2 live workers.
- [ ] A scarce resource stays within its limit.
  Verify: allow one verifier at a time; bring two tickets to the check step together; their verifier workers never overlap in Orca.
- [ ] Tickets whose plans list the same file never run at the same time.
  Verify: two tickets whose plans name the same file; the second starts building only after the first merges.
- [ ] The coordinator spends no tokens while waiting and wakes at the timeout when nothing happens.
  Verify: leave the factory idle for 30 minutes with a 15-minute timeout; the session's usage grows only at the two timeout wakes; the journal has one line per wake.
- [ ] Telling the coordinator to pause stops new work while in-flight work finishes; telling it to resume continues.
  Verify: send "pause" to the coordinator through Orca during a build; the build finishes and nothing new starts; send "resume"; the next ticket starts.
- [ ] Replacing the coordinator session mid-run loses nothing and duplicates nothing.
  Verify: end the coordinator during a build and start `run` in a new session; the running worker is adopted, no second worker starts for the same step, and the ticket finishes.
