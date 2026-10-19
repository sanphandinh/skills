# 11: Claim lock and parallel frontier

**What to build:** two runs, or two people, can work the same spec at once without taking the same ticket, and independent tickets on the frontier run in parallel.

**Blocked by:** 10

**Status:** closed

- [x] A claim is a push of a tracker-only commit to trunk; a rejected push means another claimant won, so the run pulls, recomputes the frontier, and picks again
- [x] A configurable concurrency limit bounds how many tickets run at once
- [x] A run started on another machine resumes from the tracker and pull requests alone
- [x] Tests cover two runs racing for one ticket (exactly one wins) and two independent tickets running together
- [x] `npm run validate` and `npm test` pass

## Comments

Done. A run resumes tickets claimed under its own name (`--as`, default `autopilot@<hostname>`) and continues their pushed branch and open pull request. The race test uses a pre-push hook so the rival claim really lands first.
