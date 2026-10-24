# 15: `setup-verification` skill

**What to build:** a project can generate its verification doc, a feature map plus the commands that drive the real product, so verifiers prove behaviour the way a user would and auto-merge becomes possible.

**Blocked by:** 06

**Status:** closed

- [x] A shared, user-invoked `setup-verification` skill writes `docs/agents/verify.md` with a feature map and the commands to drive the product (CLI, HTTP, browser)
- [x] The doc names any untracked fixtures or credentials a check needs, so verifiers know when a worktree cannot run it
- [x] The verifier agent's prompt reads this doc; with no doc, verification falls back to tests, typecheck, and review
- [x] Material adapted from pstack's `create-verification-skill` is credited (MIT)
- [x] `npm run validate` passes

## Comments

Done. The doc is one file with the feature map as a section, so the merge-policy gate checks a single path. Credit for pstack lives in `UPSTREAM.md` under Other sources.
