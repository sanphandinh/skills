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
- `agent-quality-hooks-setup`: detect existing typecheck, lint, and formatting commands, then wire them into Claude Code, Codex, OpenCode, or generic coding-agent hooks through a shared quality runner plus thin adapters.
- `github-repo-setup`: set up GitHub branch rules, repository security features, and Dependabot config/verification for new or existing repositories.
- `frontend-web-project-setup`: choose and scaffold frontend web stacks, defaulting landing/content sites to Astro, normal React/full-stack apps to TanStack Start, and high-performance non-React apps to SvelteKit or SolidStart.
