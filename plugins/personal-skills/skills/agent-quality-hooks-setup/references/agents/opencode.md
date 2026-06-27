# OpenCode Adapter

Official documentation: https://opencode.ai/docs/plugins/  
Last verified: 2026-06-25

## Detection

- `opencode.json` or `opencode.jsonc`
- `.opencode/plugins/`

## Native Mapping

| Shared profile | OpenCode event |
|---|---|
| `after-edit` | `file.edited` |
| `turn-complete` | `session.idle` |

Implement a small project plugin that translates OpenCode event payloads into runner arguments. Use the plugin context's project/worktree path and process APIs; do not embed project quality commands in the plugin.

OpenCode's plugin lifecycle and error behavior are not identical to `Stop` hooks. Do not claim blocking/retry parity unless current documentation and local verification prove it. If failures only surface as plugin errors or notifications, document that limitation.

Inspect existing plugins before adding one and avoid registering multiple idle checks. Re-check the official page before implementation.
