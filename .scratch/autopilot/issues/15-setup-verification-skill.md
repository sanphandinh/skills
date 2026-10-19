# 15: `setup-verification` skill

**What to build:** a project can generate its verification doc, a feature map plus the commands that drive the real product, so verifiers prove behaviour the way a user would and auto-merge becomes possible.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] A shared, user-invoked `setup-verification` skill writes `docs/agents/verify.md` with a feature map and the commands to drive the product (CLI, HTTP, browser)
- [ ] The doc names any untracked fixtures or credentials a check needs, so verifiers know when a worktree cannot run it
- [ ] The verifier agent's prompt reads this doc; with no doc, verification falls back to tests, typecheck, and review
- [ ] Material adapted from pstack's `create-verification-skill` is credited (MIT)
- [ ] `npm run validate` passes
