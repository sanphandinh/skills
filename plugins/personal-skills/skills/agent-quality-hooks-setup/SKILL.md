---
name: agent-quality-hooks-setup
description: Use when a repository needs consistent AI-agent quality hooks, especially when several coding agents are configured, existing hooks run different commands, project quality commands are ambiguous, or tests and builds may be expensive.
---

# Agent Quality Hooks Setup

## Overview

Build one evidence-backed quality contract and translate it into each detected coding agent's native hook protocol.

**Core principle:** AI analyzes project semantics; deterministic code collects evidence, enforces safety, and validates consistency. Agent adapters never choose project commands.

## Workflow

1. Run `scripts/collect_project_evidence.py <repo>`.
2. Read the evidence and `references/quality-analysis-guide.md`. Trace docs, scripts, CI, working directories, and monorepo boundaries. Do not infer commands from language markers.
3. Write `.agents/quality/contract.json` using `references/quality-contract.md`, then run `scripts/validate_quality_contract.py`.
4. Present the command profiles and request explicit confirmation before automatically running tests or builds.
5. Run `scripts/detect_agents.py <repo>`. Treat `configured` agents as implementation targets; ask before adding hooks for agents marked only `possible`.
6. For each target, load only its file under `references/agents/` and verify the linked official documentation before editing.
7. Inventory existing hook sources. Preserve unrelated hooks, replace stale quality entries, and prevent duplicate registrations.
8. Create one repo-owned runner, normally `.agents/quality/run`, with profiles:
   - `after-edit`: confirmed, file-scoped formatter;
   - `turn-complete`: confirmed lightweight read-only checks;
   - `full`: tests/builds, manual until approved.
9. Write `.agents/quality/adapter-plan.json` from `references/adapter-plan.md`; validate it with `scripts/validate_adapter_plan.py`.
10. Implement thin native adapters. Every adapter calls the same runner profile; no adapter contains `npm`, `pnpm`, `bun`, `go`, `cargo`, Gradle, or other project quality commands.
11. Parse changed configs, test adapters with representative payloads, and report capability differences such as block, retry, or notification-only behavior.

The contract, runner, and adapter plan are mandatory deliverables unless equivalent repo-owned artifacts already exist and are updated in place. Deadlines do not justify skipping them or putting project commands back into adapters.

## Supported Agents

| Agent | Edit lifecycle | Turn-complete lifecycle |
|---|---|---|
| Codex | `PostToolUse` | `Stop` |
| Claude Code | `PostToolUse` | `Stop` |
| OpenCode | `file.edited` | `session.idle` |
| Gemini CLI | `AfterTool` | `AfterAgent` |
| GitHub Copilot | `postToolUse` | `agentStop` |

These events are semantic mappings, not interchangeable protocols. Never copy one agent's configuration shape, payload parser, decision fields, or failure semantics into another.

## Red Flags

- A collector recommends commands instead of returning source evidence.
- A manifest such as `go.mod`, `tsconfig.json`, or `pyproject.toml` is treated as the quality contract.
- Codex and OpenCode adapters run different project commands.
- Test/build commands enter automatic profiles without documented approval.
- A new hook is appended without checking existing project, user, plugin, or policy sources.
- An adapter claims blocking or retry behavior that its native lifecycle does not support.
- “Only two agents” or “the deadline is short” is used to skip the contract or adapter plan.

If evidence is ambiguous or an agent protocol cannot be verified, leave the item unresolved and preserve manual runner invocation.
