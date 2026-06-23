---
name: portless-web-project-setup
description: Integrate Portless into new or early-stage web projects by detecting the framework, making Portless the default dev server, adding stable app-name configuration, and documenting AGENTS.md or CLAUDE.md local-development instructions. Use when setting up stable clean HTTPS .localhost dev-server URLs for TanStack Start, Vite, Next.js, or Astro projects, especially when agents should stop guessing localhost ports or accepting fallback :1355 URLs.
---

# Portless Web Project Setup

## Overview

Set up Portless as the stable local dev-server entry point for a web project. Prefer small, reviewable edits: `package.json`, `portless.json`, and agent documentation.

Use `references/framework-presets.md` for framework detection, script patterns, and documentation snippets. Use `references/portless-cli-usage.md` for Portless CLI commands and clean-URL requirements.
 
## Workflow

1. Inspect project files before editing:
   - read `package.json`;
   - identify the package manager from lockfiles and existing commands;
   - check for `AGENTS.md` or `CLAUDE.md`;
   - detect TanStack Start, Vite, Next.js, or Astro from dependencies and config files.
2. Load `references/framework-presets.md` and select the matching preset. If detection is unclear, stop and ask the user which raw dev command Portless should wrap.
3. Load `references/portless-cli-usage.md` before writing Portless commands or documenting proxy behavior.
4. Decide script policy:
   - prefer making `dev` run through Portless;
   - preserve the previous raw command as `dev:raw`;
   - avoid hardcoded ports unless the project already requires one.
5. Add stable app-name config:
   - create or update `portless.json` with a stable `name`;
   - use the product or app slug, not a temporary directory or branch name;
   - for monorepos, configure app names under `apps`.
6. Add Portless:
   - if the repo manages all dev tools locally, add `portless` as a dev dependency;
   - if the repo explicitly relies on global tools, document that expectation instead of adding a dependency.
7. Update agent documentation:
   - update `AGENTS.md` when present;
   - update `CLAUDE.md` when present or when the user asks for Claude Code-specific setup;
   - create `AGENTS.md` only when no repo-level agent instruction file exists.
8. Verify the setup and report exact status.

## Editing Rules

- Preserve existing scripts and comments where possible.
- Do not replace a working custom `dev` script without user approval.
- Do not leave raw `dev` as the default unless the user explicitly asks for opt-in Portless.
- Do not claim Portless runtime success unless the clean named URL was actually verified.
- Treat `https://<app>.localhost:1355` as a fallback failure for this skill. The target state is `https://<app>.localhost` on standard HTTPS port 443.
- Keep raw fallback instructions explicit so agents can still inspect the app when proxy, TLS, sudo, no-TTY, or route-lock issues block Portless.
- Keep agent docs concise. Add a single "Local Development With Portless" section rather than duplicating instructions across many files.

## Verification

Run checks appropriate to the repo:

- parse `package.json` after editing;
- run the package manager's script listing command when available;
- start the Portless script when the environment supports it;
- use `portless list` to confirm the route is `https://<app>.localhost` without `:1355` when runtime verification succeeds;
- if Portless cannot run in the current environment, run the raw fallback only when needed and state that Portless runtime verification is pending.

## Failure Handling

- If `package.json` is missing, stop; this skill is for Node-based web projects.
- If the framework is unsupported, add no scripts until the user confirms the raw dev command.
- If Portless is not installed globally and cannot be added locally, document the blocker and the exact install command.
- If Portless falls back to `:1355`, do not accept that as the configured success state. Instruct the user to run an interactive clean-URL setup such as `portless service install` or `portless proxy start` with permission to bind port 443.
- If the app itself fails after Portless starts the raw dev command, switch to app debugging; do not treat that as a Portless setup issue.
