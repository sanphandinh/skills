# Personal Skills Plugin

This repository is a reusable local plugin for Claude Code and Codex.

## Repository Layout

- `skills/<skill-name>/SKILL.md`: canonical skill instructions.
- `skills/<skill-name>/references/`: optional details loaded only when a skill asks for them.
- `skills/<skill-name>/agents/openai.yaml`: Codex/OpenAI UI metadata.
- `.claude-plugin/plugin.json`: Claude Code plugin manifest.
- `.codex-plugin/plugin.json`: Codex plugin manifest.
- `docs/superpowers/specs/`: design specs for approved skills.

## Agent Workflow

- Before changing a skill, read its `SKILL.md` and any directly linked reference files.
- Keep `SKILL.md` concise. Move framework-specific or variant-specific details into `references/`.
- Do not duplicate a full skill body into agent-specific config files. Agent config files should point back to `skills/`.
- Validate changed skills with:

```bash
python3 /Users/sanphan/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/sanphan/Documents/skills/skills/<skill-name>
```

## Supported Plugin Targets

- Claude Code: load the repository as a plugin with `claude --plugin-dir /Users/sanphan/Documents/skills`. Claude Code discovers skills from the root `skills/` directory and namespaces them under `personal-skills`.
- Codex: install or load this repository as a Codex plugin using `.codex-plugin/plugin.json`; Codex reads `skills` from `./skills/`.

## Current Skills

- `portless-web-project-setup`: integrate Portless into new or early-stage web projects, update package scripts, and add local-development instructions to `AGENTS.md` or `CLAUDE.md`.
