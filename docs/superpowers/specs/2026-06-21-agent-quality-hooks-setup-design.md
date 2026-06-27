# Agent Quality Hooks Setup Skill Design

## Purpose

Create consistent quality hooks across the coding agents actually configured in a repository. AI understands project semantics; deterministic tooling collects evidence and validates safety and cross-agent consistency.

## Architecture

```text
repository evidence
  → AI quality analysis
  → .agents/quality/contract.json
  → coding-agent detection
  → .agents/quality/adapter-plan.json
  → native adapters
  → one shared runner
```

The evidence collector must not recommend language commands. The AI traces repository docs, task scripts, CI, working directories, and monorepo boundaries to produce an evidence-backed quality contract.

The agent detector identifies configured or possible Codex, Claude Code, OpenCode, Gemini CLI, and GitHub Copilot usage. Only configured agents are automatic implementation targets.

Each native adapter translates its lifecycle and payload into one of three shared profiles:

- `after-edit`: confirmed file-scoped formatter;
- `turn-complete`: confirmed lightweight read-only checks;
- `full`: tests/builds, manual until explicitly approved.

Adapters never embed project quality commands. Codex and OpenCode, for example, use different native events but call the same runner profile.

## Safety

- Every command requires repository evidence.
- Language manifests and tool configs are context, not command authority.
- Tests and builds require explicit approval before automatic execution.
- Existing hooks must be inventoried to prevent duplicate registrations.
- Adapter-specific blocking, retry, and notification semantics must remain explicit.
- Unknown or unverifiable behavior stays unresolved with manual runner fallback.

## Verification

- Unit-test evidence collection, agent detection, quality-contract validation, and adapter-plan validation.
- Validate changed JSON, TOML, YAML, scripts, and agent payload handling.
- Confirm each detected agent has exactly one intended adapter.
- Confirm all adapters call the same shared runner profiles.
- Verify official agent documentation immediately before implementation.
