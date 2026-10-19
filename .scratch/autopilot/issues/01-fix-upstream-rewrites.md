# 01: Fix upstream rewrite rules that corrupt paths and double words

**What to build:** importing or pulling an upstream skill no longer turns a filesystem path such as `/tmp` into a reference to a non-existent skill, and no longer produces a doubled "the the" before a skill name. Skills already corrupted by the old rules are re-rewritten so their text matches what upstream meant.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] A path-like token (`/tmp`, `/usr/bin`, any `/word` that is not the name of a skill in this repo) passes through the rewrites unchanged
- [x] A slash-prefixed skill name still becomes a plain reference to that skill
- [x] "the `/x` skill" and "the `/x`" both end with a single "the"
- [x] `improve-codebase-architecture` no longer mentions a `tmp` skill and has no doubled "the"
- [x] The rewrite behaviour is covered by tests in the repo CLI suite
- [x] `npm run validate` and `npm test` pass

## Comments

Done. Rules gain `skillGroups`; `/tmp`, `/clear`, `/compact`, `/settings` now pass through. Only `improve-codebase-architecture` had corrupted lines (three), all fixed.
