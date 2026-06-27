# Quality Contract

Store the AI-produced contract at `.agents/quality/contract.json` unless the repository already has a canonical location.

```json
{
  "schemaVersion": 1,
  "commands": [
    {
      "id": "quality-fast",
      "roles": ["lint", "typecheck"],
      "command": "pnpm quality:fast",
      "cwd": ".",
      "evidence": [
        "package.json:scripts.quality:fast",
        ".github/workflows/ci.yml"
      ],
      "confidence": "confirmed",
      "cost": "fast",
      "automaticPolicy": "allowed"
    },
    {
      "id": "quality-full",
      "roles": ["test", "build"],
      "command": "pnpm quality:full",
      "cwd": ".",
      "evidence": ["package.json:scripts.quality:full"],
      "confidence": "confirmed",
      "cost": "expensive",
      "automaticPolicy": "confirmation-required"
    }
  ],
  "profiles": {
    "after-edit": [],
    "turn-complete": ["quality-fast"],
    "full": ["quality-full"]
  },
  "unresolved": []
}
```

Allowed roles: `lint`, `typecheck`, `format-check`, `format-write`, `test`, `build`.

Allowed policies:

- `allowed`: confirmed lightweight read-only command;
- `scoped-only`: mutating formatter restricted to edited files;
- `confirmation-required`: not allowed in automatic profiles;
- `approved`: user approved automatic test/build execution with stated frequency and cost.

Validate with:

```bash
python3 scripts/validate_quality_contract.py .agents/quality/contract.json
```

The repo-owned runner reads this contract or implements the same static profiles. It must never evaluate arbitrary hook input as shell code.
