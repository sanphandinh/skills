# Personal Skills

Agent skills shipped as plugins for Claude Code, Codex, and Oh My Pi. Each agent
installs them per project with its own plugin commands.

- [PLATFORMS.md](PLATFORMS.md): what each agent supports and how to install in a project.
- [ROLES.md](ROLES.md): model roles that agents use, and how to map them to models.
- [UPSTREAM.md](UPSTREAM.md): syncing the skills derived from mattpocock/skills.
- [AGENTS.md](AGENTS.md): rules for writing skills and agents in this repo.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.software.md` to copy into a project.

## Work on this repo

```bash
npm install
npm run validate
npm test
npm run list
npm run upstream -- status
```
