# 06: Merge policy with mandatory gates

**What to build:** the merge decision follows a per-project merge policy doc, auto-merge is on by default, and a set of gates cannot be turned off, so only low-risk pull requests merge without a human.

**Blocked by:** 05

**Status:** closed

- [x] A merge policy template is added to `setup-software-context`'s seed templates and the policy doc is read from `docs/agents/`
- [x] Mandatory gates: verification doc present, independent verifier `PASS` or `PASS+NOTES` on the current patch, no hard finding on either axis, green CI, two-way door, blast radius in the allowed set, no file under a protected path
- [x] Default protected paths: database migrations, infrastructure, CI configuration, dependency lockfiles, environment files; a project may add paths, and removing a default requires a written reason
- [x] A verdict whose patch identity differs from the current head blocks the merge until re-verified
- [x] A refused pull request marks its ticket `ready-for-human` and posts the reason on the pull request
- [x] Tests cover: no verification doc, protected path touched, one-way door, stale verdict, and the passing case
- [x] `npm run validate` and `npm test` pass

## Comments

Done. A stale verdict triggers one re-verification before the merge decision, not a fix round. A test keeps the seed template and the built-in defaults identical. This repo now has its own `docs/agents/merge-policy.md` from the seed.
