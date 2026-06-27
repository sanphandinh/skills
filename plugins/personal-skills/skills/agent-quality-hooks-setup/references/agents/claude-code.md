# Claude Code Adapter

Official documentation: https://code.claude.com/docs/en/hooks  
Last verified: 2026-06-25

## Detection

- `.claude/settings.json`
- `.claude/settings.local.json`
- `CLAUDE.md` indicates possible usage but does not prove hooks are configured.

## Native Mapping

| Shared profile | Claude Code event |
|---|---|
| `after-edit` | `PostToolUse` with an edit/write matcher |
| `turn-complete` | `Stop` |

Command hooks receive JSON on stdin. Parse `.tool_input` with a structured parser before passing a file path to the runner. Use the project-root environment supplied by Claude Code when available.

Claude Code can load project, local, user, plugin, and managed hooks. Inspect active sources and do not append a duplicate quality hook. Blocking feedback and exit semantics are Claude-specific; preserve them in this adapter rather than the shared runner.

Re-check the official page before implementation.
