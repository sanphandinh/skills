# 08: Build the rest of Ody-drive spec #60 with the factory

**What to build:** the factory builds what remains of Ody-drive spec #60 (at the time of writing: #62 with its open pull request #74, then #63, #64 and #65, then #66) with automatic merges, and the run is compared with the 27 to 29 October baseline. Lessons go to the wiki; fixes to the playbook or the Orca reference found on the way land as their own changes in this repository.

**Blocked by:** 04, 05, 06, 07

**Status:** ready-for-agent

**Door:** one-way (merges into a real product)

- [ ] Setup on Ody-drive passes its smoke test, with one verifier at a time (one simulator) and the Xcode Cloud check named as required.
  Verify: run setup in Ody-drive; read its `docs/agents/factory.md`; the smoke test passes.
- [ ] The open fix ticket #75 and a silent Xcode Cloud produce one brief to the developer and no new fix ticket.
  Verify: after the first wakes, GitHub shows one factory brief about CI and no new "Fix trunk" issue.
- [ ] Every remaining ticket of spec #60 either merges through the factory or carries a brief saying why it did not.
  Verify: on GitHub, #62 to #66 are closed with merged pull requests, or open with a factory brief.
- [ ] A run report compares first-round gate passes, runs lost to infrastructure, developer interventions and automatic merges with the baseline (2 of 5, 34%, about nine, none).
  Verify: read the report in the wiki.
