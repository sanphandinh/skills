# <Project name>

<One paragraph: what this project is, who uses it, what matters most.>

## Commands

- Install: `<command>`
- Dev: `<command>`
- Test (single file): `<command>`
- Test (all): `<command>`
- Typecheck / lint: `<command>`

## Context

Domain knowledge lives next to this file, not inside skills:

- `CONTEXT.software.md`: architecture, conventions, seams, what not to touch.

## Agent skills

Skills come from the `sanphan-skills` plugin marketplace, installed at project
scope with each agent's own plugin commands (see PLATFORMS.md in that repo).
Change skills in the source repo, not in this project.

- Claude Code: `software`, `software-claude` (enabled in `.claude/settings.json`)
- Codex: `software` (enabled in `.codex/config.toml`)
- Oh My Pi: `software`, `software-omp` (run `omp plugin install <name>@sanphan-skills --scope project`)

Model roles used by the agents (`reviewer`, `writer`, ...) are mapped to models
in `.omp/config.yml` under `modelRoles`, or in your own agent config.

<!-- The setup-software-context skill fills in the issue tracker, triage labels,
     and domain docs sections below. -->
