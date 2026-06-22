# Agent Hook Adapters

Use this reference before writing tool-specific hook config. Hook APIs change; verify official docs when precision matters.

## Shared Contract

Create one repo-owned runner for final checks, for example:

```bash
#!/usr/bin/env bash
set -euo pipefail

mode="${1:-check}"

case "$mode" in
  check)
    npm run typecheck
    npm run lint
    npm run format:check
    ;;
  format-changed)
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' EXIT
    git diff --name-only -z --diff-filter=ACMRTUXB -- '*.js' '*.jsx' '*.ts' '*.tsx' '*.json' '*.css' '*.md' > "$tmp"
    [ ! -s "$tmp" ] || xargs -0 npx prettier --write < "$tmp"
    ;;
  format-file)
    shift
    [ "$#" -eq 0 ] || npx prettier --write "$@"
    ;;
  *)
    echo "unknown quality-gate mode: $mode" >&2
    exit 2
    ;;
esac
```

Adapt the commands to the repository. Keep static command lists. Do not `eval` strings from hook input.

## Claude Code

Official docs: https://code.claude.com/docs/en/hooks-guide

Current useful facts:

- Project hooks can live in `.claude/settings.json`.
- `PostToolUse` with matcher `Edit|Write` is the normal edit-hook surface for format-on-edit.
- `Stop` runs after Claude finishes a turn and is useful for final check-only gates, especially because shell commands can also modify files.
- Command hooks receive JSON on stdin.
- Exit code `2` or a blocking decision can feed feedback back to Claude.
- Claude Code can inspect configured hooks with `/hooks`.

Example:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.agents/hooks/quality-gate.sh format-changed"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.agents/hooks/quality-gate.sh check",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

For format-on-edit, write a small wrapper that parses `.tool_input.file_path` from stdin and passes it as an argument to the formatter. Prefer Python or `jq`; avoid interpolating raw JSON into a shell command.

## Codex

Official docs: https://developers.openai.com/codex/hooks

Current useful facts:

- Codex hooks can be configured in JSON or TOML; plugin-bundled hooks use `hooks/hooks.json` by default or a manifest `hooks` entry.
- Command hooks are the supported handler type today.
- Commands run with the session `cwd`; repo-local hooks should resolve from `git rev-parse --show-toplevel` rather than a fragile relative path.
- `PostToolUse` can match `apply_patch`, `Edit`, or `Write` for file edits.
- `Stop` can block/continue with feedback for final gates.
- Plugin hooks require review/trust before execution.

Example `hooks/hooks.json` or equivalent project hook object:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|apply_patch",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env bash -lc '\"$(git rev-parse --show-toplevel)\"/.agents/hooks/quality-gate.sh format-changed'",
            "timeout": 30,
            "statusMessage": "Formatting edited files"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env bash -lc '\"$(git rev-parse --show-toplevel)\"/.agents/hooks/quality-gate.sh check'",
            "timeout": 120,
            "statusMessage": "Running quality gate"
          }
        ]
      }
    ]
  }
}
```

If writing TOML instead, use `[[hooks.PostToolUse]]` and nested `[[hooks.PostToolUse.hooks]]`.

## OpenCode

Official docs: https://opencode.ai/docs/plugins

Current useful facts:

- Project plugins live in `.opencode/plugins/` and auto-load at startup.
- Plugins export a function that returns hook handlers.
- Useful events include `file.edited`, `tool.execute.after`, and `session.idle`.
- The plugin context exposes Bun's `$` shell API and project/worktree paths.

Example `.opencode/plugins/quality-gate.js`:

```js
export const QualityGate = async ({ $, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`${worktree}/.agents/hooks/quality-gate.sh check`
      }
    },
    "file.edited": async (input) => {
      const file = input?.file || input?.path
      if (file) {
        await $`${worktree}/.agents/hooks/quality-gate.sh format-file ${file}`
      }
    },
  }
}
```

Keep OpenCode plugin code small. If the exact event payload is unclear, log a sample during local testing or use `session.idle` only.

## Generic Agent Pattern

When an agent has no hook system:

- document the runner in `AGENTS.md` and the agent-specific rules file;
- add package scripts such as `quality:check` only if they match repo style;
- use pre-commit hooks or CI only when the user wants human workflow enforcement too;
- avoid claiming that unsupported agents will auto-run the checks.
