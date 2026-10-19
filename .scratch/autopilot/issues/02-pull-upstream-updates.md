# 02: Pull upstream updates for the build-path skills

**What to build:** `implement`, `implement-spec`, `code-review`, and `setup-software-context` carry the latest upstream fixes (ticket references fetched and named before work, standards-file discovery and foreground reviewers, triage label creation and corrected tracker commands), merged three-way with this repo's local edits kept.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each of the four skills is pulled with the upstream tool and `UPSTREAM.md` records the new commits
- [ ] Local edits survive (for example `setup-software-context` writing to `AGENTS.md`, and `code-review`'s "Which sub-agents to use" paragraph)
- [ ] No conflict markers remain and no rewrite artefacts are introduced
- [ ] The `review-spec` and `review-standards` agents on both platforms still match the briefs `code-review` hands them
- [ ] `npm run validate` and `npm test` pass
