# Personal Skills Repository

This repository is the source of truth for reusable personal AI-agent skills.

## Repository Layout

- `skills/<skill-name>/SKILL.md`: canonical skill instructions.
- `skills/<skill-name>/references/`: optional details loaded only when a skill asks for them.
- `skills/<skill-name>/agents/openai.yaml`: Codex/OpenAI UI metadata.
- `.agents/skills/<skill-name>/SKILL.md`: thin discovery shims for agents that scan `.agents/skills`.
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
- Claude Code: `CLAUDE.md` imports this file; keep Claude-specific behavior there only when needed.
- opencode: `opencode.json` loads this file as project instructions; `.agents/skills` exposes thin skill shims that point back to canonical files under `skills/`.
- Cursor: `.cursor/rules/personal-skills.mdc` points Cursor Agent at this repository layout.
- GitHub Copilot: `.github/copilot-instructions.md` and `.github/instructions/skills.instructions.md` point Copilot at this repository layout.
- Pi: use this `AGENTS.md` as the portable instruction layer until a verified Pi plugin or skill format exists.

## Current Skills

- `portless-web-project-setup`: integrate Portless into new or early-stage web projects, update package scripts, and add local-development instructions to `AGENTS.md` or `CLAUDE.md`.
