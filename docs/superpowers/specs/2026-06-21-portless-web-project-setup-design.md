# Portless Web Project Setup Skill Design

## Purpose

Create the first personal skill in this repository: a small, reusable workflow for integrating Portless into new web projects so humans and agents use stable named local URLs instead of guessing `localhost` ports.

## Scope

The skill focuses on project setup, not live debugging. It should help an agent:

- inspect a web project and detect the framework;
- add or recommend Portless dependency and package scripts;
- document the local dev convention in `AGENTS.md` or `CLAUDE.md`;
- preserve a raw dev fallback for verification when Portless proxy, TLS, sudo, or sandbox limitations block runtime checks.

The initial framework presets are TanStack Start, Vite, Next.js, Astro, and React Router.

## Architecture

Use a concise `SKILL.md` as the workflow entry point. Keep framework-specific commands and documentation snippets in `references/framework-presets.md` so the main skill stays small and future presets can be added without rewriting the whole skill.

The skill must prefer scoped, reviewable changes:

- update `package.json` scripts conservatively;
- avoid hardcoding dev ports unless the repo already requires them;
- add Portless instructions to existing agent docs when present;
- create `AGENTS.md` only when no repo-level agent instruction file exists and the user has not requested `CLAUDE.md` specifically.

## Error Handling

The skill must distinguish setup failures from runtime failures:

- missing package manager or invalid `package.json`;
- unknown framework or custom dev script;
- Portless not installed;
- proxy, TLS, sudo, no-TTY, route-lock, or Safari `.localhost` issues.

When Portless cannot be runtime-verified, the skill should not claim success from a raw dev server alone. It should report that the package/docs integration is complete and that Portless runtime verification remains pending.

## Verification

After setup, the agent should verify:

- `package.json` remains valid JSON;
- the chosen package manager can parse scripts;
- the agent docs contain the Portless convention;
- a Portless command is available to run;
- runtime verification either succeeds through Portless or falls back to raw dev with an explicit caveat.

## Out Of Scope

The first version does not implement a generator, hooks, or multi-agent plugin installers. Those belong to later skills once the initial Portless setup workflow proves useful.
