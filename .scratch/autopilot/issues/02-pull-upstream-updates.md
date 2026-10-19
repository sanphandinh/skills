# 02: Pull upstream updates for the build-path skills

**What to build:** `implement`, `implement-spec`, `code-review`, and `setup-software-context` carry the latest upstream fixes (ticket references fetched and named before work, standards-file discovery and foreground reviewers, triage label creation and corrected tracker commands), merged three-way with this repo's local edits kept.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Each of the four skills is pulled with the upstream tool and `UPSTREAM.md` records the new commits
- [x] Local edits survive (for example `setup-software-context` writing to `AGENTS.md`, and `code-review`'s "Which sub-agents to use" paragraph)
- [x] No conflict markers remain and no rewrite artefacts are introduced
- [x] The `review-spec` and `review-standards` agents on both platforms still match the briefs `code-review` hands them
- [x] `npm run validate` and `npm test` pass

## Comments

Done. `implement-spec` was already current upstream. Also pulled `to-tickets`, `handoff`, and `tdd`, which tickets 03 and 12 edit next, so their later upstream pulls start from a recent base. All merges were clean.
