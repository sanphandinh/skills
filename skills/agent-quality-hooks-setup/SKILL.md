---
name: agent-quality-hooks-setup
description: Set up repository quality gates for AI coding agents by discovering existing typecheck, lint, and formatting commands, creating a small shared quality-runner contract, and wiring it into Claude Code, Codex, OpenCode, or other agent hook/plugin surfaces. Use when a project needs agent-enforced TypeScript checks, linting, format-on-edit, final quality checks, or cross-agent hook setup for frontend, backend, Go, Rust, Python, Java, or mixed-language repositories.
---

# Agent Quality Hooks Setup

## Overview

Install or document AI-agent hooks that keep generated code aligned with the repository's real quality commands. Prefer a repo-owned quality contract plus thin adapters for each agent runtime, so Claude Code, Codex, OpenCode, and future tools share the same command list instead of duplicating policy.

## Workflow

1. Inspect the project before editing:
   - read root instructions such as `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or tool-specific docs;
   - identify languages, package managers, monorepo layout, and existing quality commands;
   - run `scripts/detect_quality_commands.py <repo>` for a first-pass command inventory, then verify against real files.
2. Load `references/quality-command-detection.md` before choosing or inventing commands.
3. Load `references/agent-hook-adapters.md` before writing Claude Code, Codex, OpenCode, or generic agent hook config.
4. Reuse existing scripts first. Do not add TypeScript, ESLint, Prettier, golangci-lint, clippy, ruff, or similar tooling unless the user asked for toolchain installation.
5. Create a shared quality runner when multiple agents need the same checks:
   - put it under a repo-owned path such as `.agents/hooks/quality-gate.sh`, `.agents/hooks/quality-gate.py`, or an existing scripts directory;
   - keep commands explicit, static, and reviewable;
   - separate write-format commands from check-only commands.
6. Wire thin adapters:
   - format-on-edit hooks should run only targeted safe formatters when the agent edits files;
   - final/idle hooks should run check-only commands such as typecheck, lint, format check, and compile checks;
   - destructive or slow commands should require user confirmation or be documented as opt-in.
7. Update root agent documentation with the quality contract and exact commands.
8. Verify by running lightweight parser checks, the changed hook script with a dry run when available, and at least one representative quality command when safe.

## Command Policy

- Treat `typecheck`, `lint`, and `format` as roles, not fixed command names.
- Prefer package scripts or repo docs over language defaults.
- For final gates, use check-only format commands (`prettier --check`, `cargo fmt --check`, `gofmt -l`, `ruff format --check`) rather than write-format commands.
- For edit hooks, only run write-format commands that can be safely scoped to edited files. If a formatter is project-wide, prefer running it at `Stop`/idle or documenting it as manual.
- Avoid shell interpolation of hook input. Parse hook JSON with a structured parser and pass paths as arguments.
- If existing quality commands fail before your changes, report that as pre-existing drift and keep hook wiring separate from cleanup.
- Keep hook timeouts realistic. Put quick targeted formatters on edit hooks; put slower typecheck/lint/build checks on final hooks.

## Adapter Policy

Use the agent's native hook/plugin surface when it exists:

- Claude Code: project `.claude/settings.json` command hooks, normally `PostToolUse` for `Edit|Write` and `Stop` for final checks.
- Codex: project or plugin hook config, normally `PostToolUse` for `apply_patch`/`Edit|Write` and `Stop` for final checks.
- OpenCode: project `.opencode/plugins/*` plugin events such as `file.edited`, `tool.execute.after`, and `session.idle`.
- Other agents: if no hook surface exists, document the same quality runner in `AGENTS.md`/tool docs and add package manager scripts or pre-commit/CI integration only when appropriate.

Do not duplicate the full command matrix into each adapter. Each adapter should call the shared runner or a narrowly scoped formatter.

## Verification

After editing, run checks appropriate to the repo:

- parse JSON/TOML/YAML files that changed;
- run `bash -n` or `python -m py_compile` for hook scripts;
- run the detector script and compare output to the configured runner;
- run at least one representative quality command, or state why it was skipped;
- for Claude Code and Codex, tell the user hooks may need review/trust in the agent UI before they execute.

## Failure Handling

- If no quality commands exist, propose commands and docs, but do not silently install new toolchains.
- If the repo is a monorepo, configure per-package commands or workspace scripts instead of one misleading root command.
- If a hook API is unknown or unsupported, preserve the shared runner and document exact manual invocation until the tool-specific adapter is researched.
- If hook execution needs network, credentials, or write access outside the repo, ask or escalate according to the current environment rules.
