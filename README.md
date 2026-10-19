# Personal Skills

Agent skills shipped as plugins for Claude Code, Codex, and Oh My Pi. Each agent
installs them per project with its own plugin commands.

- [PLATFORMS.md](PLATFORMS.md): what each agent supports and how to install in a project.
- [ROLES.md](ROLES.md): model roles that agents use, and how to map them to models.
- [UPSTREAM.md](UPSTREAM.md): syncing the skills derived from mattpocock/skills.
- [AGENTS.md](AGENTS.md): rules for writing skills and agents in this repo.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.software.md`, and per-harness role model examples to copy into a project.

## The pipeline

A human takes part twice. First, the problem goes through `grill-with-docs` and `to-spec` until the spec, with its test seams, is approved (`Status: ready-for-agent`). Second, the human reviews only the pull requests the merge policy will not merge alone.

Between the two, `autopilot` splits the spec into tickets (stopping for approval when it is large), and for each ticket runs a fresh implementer, an independent verifier that drives the real product per `docs/agents/verify.md`, and the Spec and Standards reviewers, then opens one pull request. Auto-merge is on by default, but only for a two-way door with an allowed blast radius, a passing verdict on the current patch, no hard review finding, green CI, and no protected path touched (`docs/agents/merge-policy.md`). Each merged ticket leaves a handoff for the tickets it unblocks and a decision trail.

## Work on this repo

```bash
npm install
npm run validate
npm test
npm run list
npm run upstream -- status
```
