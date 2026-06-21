# Personal Skills Repository

This repository is the source of truth for reusable personal AI-agent skills.

## Repository Layout

- `skills/<skill-name>/SKILL.md`: canonical skill instructions.
- `skills/<skill-name>/references/`: optional details loaded only when a skill asks for them.
- `skills/<skill-name>/agents/openai.yaml`: Codex/OpenAI UI metadata.
- `.claude-plugin/plugin.json`: Claude Code plugin manifest; the root `skills/` directory is the plugin skill source.
- `.claude/skills/`, `.opencode/skills/`, `.github/skills/`, `.agents/skills/`: symlink adapters for agents that discover project-local skills from tool-specific directories.
- `.cursor/rules/`: thin Cursor rules that reference canonical skill files.
- `docs/superpowers/specs/`: design specs for approved skills.

## Agent Workflow

- Before changing a skill, read its `SKILL.md` and any directly linked reference files.
- Keep `SKILL.md` concise. Move framework-specific or variant-specific details into `references/`.
- Do not duplicate a full skill body into agent-specific config files. Agent config files should point back to `skills/`.
- Validate changed skills with:

```bash
python3 /Users/sanphan/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/sanphan/Documents/skills/skills/<skill-name>
```

## Supported Agents

- Codex: read this file and the canonical skill folder under `skills/`.
- Claude Code: load this repo as a plugin with `--plugin-dir`; `.claude/skills` also exposes symlinked project skills.
- opencode: use `AGENTS.md` plus the `skill` tool; `.opencode/skills` and `.agents/skills` expose symlinked skills for discovery.
- Cursor: `.cursor/rules/personal-skills.mdc` describes the repo and focused rules such as `portless-web-project-setup.mdc` point to canonical skill files.
- GitHub Copilot: `.github/skills` exposes native project skills; `.github/copilot-instructions.md` and `.github/instructions/skills.instructions.md` provide repository instructions.
- Pi: use this `AGENTS.md` as the portable instruction layer until a verified Pi plugin or skill format exists.

## Current Skills

- `portless-web-project-setup`: integrate Portless into new or early-stage web projects, update package scripts, and add local-development instructions to `AGENTS.md` or `CLAUDE.md`.
