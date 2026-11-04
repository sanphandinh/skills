# 08: Build the rest of Ody-drive spec #60 with the factory

**What to build:** the factory builds what remains of Ody-drive spec #60 (at the time of writing: #62 with its open pull request #74, then #63, #64 and #65, then #66) with automatic merges, and the run is compared with the 27 to 29 October baseline. Lessons go to the wiki; fixes to the playbook or the Orca reference found on the way land as their own changes in this repository.

**Blocked by:** 04, 05, 06, 07

**Status:** closed

**Door:** one-way (merges into a real product)

- [x] Setup on Ody-drive passes its smoke test, with one verifier at a time (one simulator) and the Xcode Cloud check named as required.
  Verify: run setup in Ody-drive; read its `docs/agents/factory.md`; the smoke test passes.
- [x] The open fix ticket #75 and a silent Xcode Cloud produce one brief to the developer and no new fix ticket.
  Verify: after the first wakes, GitHub shows one factory brief about CI and no new "Fix trunk" issue.
- [x] Every remaining ticket of spec #60 either merges through the factory or carries a brief saying why it did not.
  Verify: on GitHub, #62 to #66 are closed with merged pull requests, or open with a factory brief.
- [x] A run report compares first-round gate passes, runs lost to infrastructure, developer interventions and automatic merges with the baseline (2 of 5, 34%, about nine, none).
  Verify: read the report in the wiki.

## Handoff

**Delivered:** setup on Ody-drive passed every smoke check (simulator 1 at a time, held by the verifier; no PR checks; Xcode Cloud as the trunk check). The factory built the rest of spec #60: #62-#66 closed, with #80 and #82 split from #66 on a person's instruction; PRs #74, #76, #77 and #79 merged into main by the factory and #78 (one-way door) by the person; spec #60 closed 2026-11-04T10:02Z. Silent Xcode Cloud produced one unknown-CI brief on #75 and no fix ticket. Report: `~/.local/share/factory/Ody-drive/wiki/run-report-spec-60.md`.
**Results vs baseline:** first-round pass 2 of 7 (was 2 of 5); runs lost to infrastructure 2 of 66, 3% (was 34%); 7 person decisions from briefs plus provider and session operations (was about 9 incidents); 4 automatic merges into main plus 2 into a branch (was 0).
**Deviations from spec:** #66 AC2 (large-download cancel) accepted as unverified on a device, covered by seam tests.
**Gotchas:** provider rate limits stall the coordinator and workers; when Orca's reused session is stuck it starts a new one, so the newest coordinator closes the old (reference updated). Cursor-provided models cannot run workers (their own harness hides our agents).
**For the next ticket:** none; 07 waits on the phone check.
