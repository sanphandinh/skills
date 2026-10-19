# 11: Claim lock and parallel frontier

**What to build:** two runs, or two people, can work the same spec at once without taking the same ticket, and independent tickets on the frontier run in parallel.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] A claim is a push of a tracker-only commit to trunk; a rejected push means another claimant won, so the run pulls, recomputes the frontier, and picks again
- [ ] A configurable concurrency limit bounds how many tickets run at once
- [ ] A run started on another machine resumes from the tracker and pull requests alone
- [ ] Tests cover two runs racing for one ticket (exactly one wins) and two independent tickets running together
- [ ] `npm run validate` and `npm test` pass
