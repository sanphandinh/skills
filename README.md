# Personal Skills

Agent skills shipped as plugins for Claude Code, Codex, and Oh My Pi. Each agent
installs them per project with its own plugin commands.

- [PLATFORMS.md](PLATFORMS.md): what each agent supports and how to install in a project.
- [ROLES.md](ROLES.md): model roles that agents use, and how to map them to models.
- [UPSTREAM.md](UPSTREAM.md): syncing the skills derived from mattpocock/skills.
- [AGENTS.md](AGENTS.md): rules for writing skills and agents in this repo.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.software.md`, and per-harness role model examples to copy into a project.

## The pipeline

A human takes part at three points. First, the problem goes through `grill-with-docs` and `to-spec` until the spec, with its test seams, is approved, and `to-tickets` splits it into tickets whose acceptance criteria each carry a `Verify:` line. Second, the human answers the factory's briefs: a product question a plan raised, a one-way door, a protected path, anything stuck. Third, the human reviews only the pull requests the merge policy holds.

In between, the `factory` plugin runs a coordinator agent inside an agent manager (Orca). It takes each ticket through plan (a planner settles the design before any code), build (a fresh implementer, test-first), check (an independent verifier that drives the real product per `docs/agents/verify.md`, and the Spec and Standards reviewers, each verdict a commit status on the exact head commit), rework, and an automatic merge when every gate in `docs/agents/merge-policy.md` holds. Each merged ticket leaves a handoff for the tickets it unblocks, and the coordinator keeps a journal and a wiki of lessons outside the repository. See [PLATFORMS.md](PLATFORMS.md#running-the-factory).

## Work on this repo

```bash
npm install
npm run validate
npm test
npm run list
npm run upstream -- status
```
