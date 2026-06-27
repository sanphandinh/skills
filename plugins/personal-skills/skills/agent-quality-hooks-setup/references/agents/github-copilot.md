# GitHub Copilot Adapter

Official documentation:

- https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks
- https://docs.github.com/en/copilot/reference/hooks-configuration

Last verified: 2026-06-25

## Detection

- `.github/hooks/*.json`
- `.github/copilot-instructions.md` indicates possible usage but not configured hooks.

## Native Mapping

| Shared profile | GitHub Copilot event |
|---|---|
| `after-edit` | `postToolUse` |
| `turn-complete` | `agentStop` |

Use repository hook configuration and call only the shared runner. Preserve Copilot-specific JSON input/output and decision semantics in this adapter.

Copilot hooks can be sourced from repository, user, policy, or plugin configuration depending on the product surface. Inventory active sources and remove or update stale quality hooks instead of stacking duplicates.

Re-check both official pages before implementation.
