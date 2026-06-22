# Agent Quality Hooks Setup Skill Design

## Purpose

Create a reusable skill for installing AI-agent quality gates across projects. The skill should help agents discover existing typecheck, lint, and formatting commands, then wire those commands into agent hook/plugin systems so generated code follows the repository's quality contract.

## Scope

The skill supports frontend and backend repositories, including TypeScript/JavaScript, Go, Rust, Python, JVM projects, and mixed-language monorepos. It should help an agent:

- inspect repo docs, scripts, package managers, CI, and tool configs;
- classify commands into typecheck, lint, format-write, format-check, and build-check roles;
- create a repo-owned quality runner when multiple agent adapters need the same commands;
- configure Claude Code, Codex, OpenCode, or generic agent surfaces with thin adapters;
- document exact commands and verification expectations in root agent docs.

## Architecture

Keep `SKILL.md` as the workflow entry point. Put ecosystem command discovery in `references/quality-command-detection.md`, and put hook API patterns in `references/agent-hook-adapters.md`. Include a read-only detector script for first-pass command inventory, but require agents to verify script output against repo files before editing hooks.

The skill must keep command ownership in the target repository. Agent-specific configs should call a shared runner or narrow formatter wrapper instead of duplicating a full command matrix.

## Error Handling

The skill must distinguish hook setup from unrelated project drift:

- do not install new lint/type/format tools unless requested;
- report pre-existing quality command failures separately from hook wiring;
- use check-only commands for final hooks unless the user asks for write-format behavior;
- ask for confirmation before adding slow, networked, destructive, or toolchain-changing commands.

## Verification

After setup, the agent should verify:

- changed JSON/TOML/YAML parses;
- hook scripts pass shell or Python syntax checks;
- the detector output matches the configured runner;
- at least one representative quality command runs, or the skip reason is explicit;
- Claude Code and Codex hook trust/review steps are mentioned when relevant.

## Out Of Scope

The first version does not provide a full project generator, CI migration, pre-commit rollout, or automatic installation of language-specific lint/type/format tooling.
