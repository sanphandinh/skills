---
name: portless-web-project-setup
description: Integrate Portless into new or early-stage web projects by detecting the framework, updating package scripts, and adding AGENTS.md or CLAUDE.md local-development instructions. Use when setting up stable named .localhost dev-server URLs for TanStack Start, Vite, Next.js, Astro, or React Router projects, especially when agents should stop guessing localhost ports.
---

# Portless Web Project Setup

## Overview

Set up Portless as the stable local dev-server entry point for a web project. Prefer small, reviewable edits: package scripts plus agent documentation.

Use `references/framework-presets.md` for framework detection, script patterns, and documentation snippets.

## Workflow

1. Inspect project files before editing:
   - read `package.json`;
   - identify the package manager from lockfiles and existing commands;
   - check for `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, or `.github/copilot-instructions.md`;
   - detect TanStack Start, Vite, Next.js, Astro, or React Router from dependencies and config files.
2. Load `references/framework-presets.md` and select the matching preset. If detection is unclear, stop and ask the user which raw dev command Portless should wrap.
3. Decide script policy:
   - prefer adding `dev:portless` while preserving the existing `dev` script;
   - use `dev:raw` only when changing `dev` to Portless by user request;
   - avoid hardcoded ports unless the project already requires one.
4. Add Portless:
   - if the repo manages all dev tools locally, add `portless` as a dev dependency;
   - if the repo explicitly relies on global tools, document that expectation instead of adding a dependency.
5. Update agent documentation:
   - update `AGENTS.md` when present;
   - update `CLAUDE.md` when present or when the user asks for Claude Code-specific setup;
   - create `AGENTS.md` only when no repo-level agent instruction file exists.
6. Verify the setup and report exact status.

## Editing Rules

- Preserve existing scripts and comments where possible.
- Do not replace a working custom `dev` script without user approval.
- Do not claim Portless runtime success unless the named URL was actually verified.
- Keep raw fallback instructions explicit so agents can still inspect the app when proxy, TLS, sudo, no-TTY, or route-lock issues block Portless.
- Keep agent docs concise. Add a single "Local Development With Portless" section rather than duplicating instructions across many files.

## Verification

Run checks appropriate to the repo:

- parse `package.json` after editing;
- run the package manager's script listing command when available;
- start the Portless script when the environment supports it;
- use `portless list` to confirm the route when runtime verification succeeds;
- if Portless cannot run in the current environment, run the raw fallback only when needed and state that Portless runtime verification is pending.

## Failure Handling

- If `package.json` is missing, stop; this skill is for Node-based web projects.
- If the framework is unsupported, add no scripts until the user confirms the raw dev command.
- If Portless is not installed globally and cannot be added locally, document the blocker and the exact install command.
- If the app itself fails after Portless starts the raw dev command, switch to app debugging; do not treat that as a Portless setup issue.
