# Personal Skills Plugin

This repository is a reusable local plugin for Claude Code and Codex.

## Repository Layout

- `plugins/personal-skills/skills/<skill-name>/SKILL.md`: canonical skill instructions.
- `plugins/personal-skills/skills/<skill-name>/references/`: optional details loaded only when a skill asks for them.
- `plugins/personal-skills/skills/<skill-name>/agents/openai.yaml`: Codex/OpenAI UI metadata.
- `plugins/personal-skills/.claude-plugin/plugin.json`: Claude Code plugin manifest.
- `plugins/personal-skills/.codex-plugin/plugin.json`: Codex plugin manifest.
- `.agents/plugins/marketplace.json`: repo-local Codex marketplace manifest for `codex plugin marketplace add /Users/sanphan/Documents/skills`.
- `plugins/personal-skills`: the actual plugin root referenced by the Codex marketplace entry.
- `docs/superpowers/specs/`: design specs for approved skills.

## Agent Workflow

- Before changing a skill, read its `SKILL.md` and any directly linked reference files.
- Keep `SKILL.md` concise. Move framework-specific or variant-specific details into `references/`.
- Do not duplicate a full skill body into agent-specific config files. Agent config files should point back to `skills/`.
- Validate changed skills with:

```bash
python3 /Users/sanphan/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/sanphan/Documents/skills/plugins/personal-skills/skills/<skill-name>
```

## Supported Plugin Targets

- Claude Code: load the plugin with `claude --plugin-dir /Users/sanphan/Documents/skills/plugins/personal-skills`. Claude Code discovers skills from that plugin's `skills/` directory and namespaces them under `personal-skills`.
- Codex: add the repository root as a local marketplace with `codex plugin marketplace add /Users/sanphan/Documents/skills`, then install the plugin with `codex plugin add personal-skills@personal-skills`. Codex reads the plugin from `plugins/personal-skills`.

## Current Skills

- `portless-web-project-setup`: integrate Portless into new or early-stage web projects, update package scripts, and add local-development instructions to `AGENTS.md` or `CLAUDE.md`.
- `agent-quality-hooks-setup`: use AI to derive an evidence-backed quality contract, detect configured coding agents, and wire Codex, Claude Code, OpenCode, Gemini CLI, or GitHub Copilot through native adapters calling one shared runner.
- `github-repo-setup`: set up GitHub branch rules, repository security features, and Dependabot config/verification for new or existing repositories.
- `frontend-web-project-setup`: choose and scaffold frontend web stacks, defaulting landing/content sites to Astro, normal React/full-stack apps to TanStack Start, and high-performance non-React apps to SvelteKit or SolidStart.
