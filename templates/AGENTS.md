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

Skills come from the `sanphan-skills` repo, installed with each harness's own
tools (see PLATFORMS.md in that repo). Change skills in the source repo, not in
this project.

- Claude Code: `core`, `software` (enabled in `.claude/settings.json`)
- Cursor: `core`, `software` (plugins, project scope)
- Antigravity: `core`, `software` (`agy plugin install`)
- OpenCode: every skill in `.agents/skills/` (`npx skills add sanphandinh/skills --skill '*' -a opencode`)

Start every software request by running the `smode` skill before anything
else; it routes the request to a playbook. The other software skills run when
smode or a person names them. (The setup-software-context skill writes the same
rule as `### Entry point` below.)

Every setting the skills read lives in `docs/agents/`, committed with this
project. smode works in the session that runs it. When the project runs the
factory, the model each of its roles (`scout`, `worker`, `thinker`, `reviewer`,
`coordinator`) runs on is `docs/agents/roles.md`, written by `factory setup`.

<!-- The setup-software-context skill fills in the issue tracker, triage labels,
     domain docs, and response language sections below. -->
