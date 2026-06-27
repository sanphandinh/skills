# Gemini CLI Adapter

Official documentation: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/index.md  
Last verified: 2026-06-25

## Detection

- `.gemini/settings.json`
- `GEMINI.md` indicates possible usage but does not prove hooks are configured.

## Native Mapping

| Shared profile | Gemini CLI event |
|---|---|
| `after-edit` | `AfterTool`, filtered to file-writing tools |
| `turn-complete` | `AfterAgent` |

Translate Gemini hook input/output to runner arguments. Keep Gemini-specific retry, halt, and decision fields in the adapter; the shared runner should only return quality results.

Inspect project and user-level settings for duplicate hooks. Re-check the official hook documentation and event schema before editing because Gemini CLI evolves quickly.
