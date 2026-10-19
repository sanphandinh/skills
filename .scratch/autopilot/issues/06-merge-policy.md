# 06: Merge policy with mandatory gates

**What to build:** the merge decision follows a per-project merge policy doc, auto-merge is on by default, and a set of gates cannot be turned off, so only low-risk pull requests merge without a human.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] A merge policy template is added to `setup-software-context`'s seed templates and the policy doc is read from `docs/agents/`
- [ ] Mandatory gates: verification doc present, independent verifier `PASS` or `PASS+NOTES` on the current patch, no hard finding on either axis, green CI, two-way door, blast radius in the allowed set, no file under a protected path
- [ ] Default protected paths: database migrations, infrastructure, CI configuration, dependency lockfiles, environment files; a project may add paths, and removing a default requires a written reason
- [ ] A verdict whose patch identity differs from the current head blocks the merge until re-verified
- [ ] A refused pull request marks its ticket `ready-for-human` and posts the reason on the pull request
- [ ] Tests cover: no verification doc, protected path touched, one-way door, stale verdict, and the passing case
- [ ] `npm run validate` and `npm test` pass
