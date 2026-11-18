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

- Claude Code: `core`, `software` (enabled in `.claude/settings.json`)
- Codex: `core`, `software` (enabled in `.codex/config.toml`)
- Oh My Pi: `core`, `software` (run `omp plugin install <name>@sanphan-skills --scope project`)

Start every software request by running the `smode` skill before anything
else; it routes the request to a playbook. The other software skills run when
smode or a person names them. (The setup-software-context skill writes the same
rule as `### Entry point` below.)

Every setting the skills read lives in `docs/agents/`, committed with this
project. The model each role (`scout`, `worker`, `thinker`, `reviewer`,
`coordinator`) runs on is `docs/agents/roles.md`, written by smode's `setup`
playbook; `setup override` changes chosen roles.

<!-- The setup-software-context skill fills in the issue tracker, triage labels,
     domain docs, and response language sections below. -->
