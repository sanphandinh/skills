# AI Quality Analysis Guide

The evidence collector is deliberately non-semantic. The AI agent must understand the repository before proposing commands.

## Analysis Order

1. Read repository instructions and contribution docs.
2. Trace package/task scripts to their actual command bodies.
3. Inspect CI jobs, working directories, matrices, services, and environment requirements.
4. Resolve monorepo ownership and package boundaries.
5. Compare documentation, scripts, and CI. Record conflicts instead of choosing silently.
6. Produce the canonical quality contract described in `quality-contract.md`.

## Evidence Rules

- Every command requires source locations and a short explanation.
- A manifest or config file proves that a technology may exist, not which quality command the project wants.
- Prefer an existing aggregate script only after inspecting what it runs.
- Preserve the repository's package manager, task runner, flags, working directory, and environment.
- Do not invent language defaults to fill empty roles.
- Put ambiguity in `unresolved`; an incomplete truthful contract is better than a complete fictional one.

## Cost And Safety Analysis

For every command assess:

- expected frequency and runtime;
- repository or package scope;
- whether it mutates files;
- CPU and memory cost;
- network, containers, credentials, databases, browsers, or external services.

`test` and `build` roles require explicit user confirmation before automatic execution. Commands combining roles inherit the strictest policy. For example, a command that compiles and runs tests remains a test command.

## Shared Profiles

- `after-edit`: confirmed formatter commands safe for one edited file.
- `turn-complete`: confirmed, lightweight, read-only checks.
- `full`: expensive tests/builds, manual until approved.

Do not put different quality commands in agent adapters. Adapters invoke these profiles through the same runner.
