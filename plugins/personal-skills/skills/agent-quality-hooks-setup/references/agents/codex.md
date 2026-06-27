# Codex Adapter

Official documentation: https://developers.openai.com/codex/hooks  
Last verified: 2026-06-25

## Detection

- `.codex/config.toml`
- `.codex/hooks.json`

## Native Mapping

| Shared profile | Codex event |
|---|---|
| `after-edit` | `PostToolUse`, matching relevant edit tools such as `apply_patch` |
| `turn-complete` | `Stop` |

Use command handlers that call the repo-owned runner. Commands execute from the session working directory; resolve the repository root safely. Parse hook JSON structurally and never interpolate raw input.

Codex can merge hooks from multiple configuration/plugin sources. Inspect all active project sources and avoid duplicate registrations. Hooks may require user review/trust before execution.

Re-check the official page before implementation because event schemas and configuration locations can change.
