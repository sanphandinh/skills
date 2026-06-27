# Adapter Plan

Create `.agents/quality/adapter-plan.json` before editing agent configuration:

```json
{
  "schemaVersion": 1,
  "runner": ".agents/quality/run",
  "adapters": [
    {
      "agent": "codex",
      "config": ".codex/hooks.json",
      "afterEditEvent": "PostToolUse",
      "afterEditArgs": ["after-edit"],
      "turnCompleteEvent": "Stop",
      "turnCompleteArgs": ["turn-complete"]
    },
    {
      "agent": "opencode",
      "config": ".opencode/plugins/quality-gate.ts",
      "afterEditEvent": "file.edited",
      "afterEditArgs": ["after-edit"],
      "turnCompleteEvent": "session.idle",
      "turnCompleteArgs": ["turn-complete"]
    }
  ]
}
```

Validate with:

```bash
python3 scripts/validate_adapter_plan.py .agents/quality/adapter-plan.json
```

Every adapter must call the same runner and profile names. Agent-specific files contain protocol translation only—never `npm`, `pnpm`, `bun`, `cargo`, `go`, or other project quality commands.

Do not skip this plan for a small number of agents or a short deadline. It is the machine-checkable proof that native adapters remain semantically aligned.

Before editing:

- inventory all existing hook/config sources;
- locate previous quality hooks and duplicate registrations;
- preserve unrelated hooks;
- update or replace stale quality entries instead of appending another copy.

After editing:

- parse every changed config;
- verify each detected agent has exactly one intended quality adapter;
- confirm the adapter's native lifecycle and input/output protocol;
- report capability differences such as blocking, retry, or notification-only behavior.
