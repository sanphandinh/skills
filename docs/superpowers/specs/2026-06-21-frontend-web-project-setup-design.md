# Frontend Web Project Setup Skill Design

## Goal

Create a reusable skill that chooses and scaffolds frontend web projects with stack defaults:

- landing/content/SEO sites: Astro;
- high-performance interactive apps: SvelteKit or SolidStart;
- normal React/full-stack apps: TanStack Start.

Also enforce project-wide frontend defaults:

- TypeScript only;
- latest stable framework packages at scaffold time;
- latest Tailwind CSS for styling;
- latest React plus React Compiler for React projects;
- built-in or framework-native state management first;
- Oxc for linting and formatting;
- Vitest or framework-appropriate testing.

## Research Summary

- Astro is the preferred default for landing pages because its official docs emphasize content-driven sites, server-first rendering, zero JavaScript by default, typed content collections, and islands for opt-in interactivity.
- TanStack Start is the preferred normal app default because official docs describe a React full-stack framework built on TanStack Router, with SSR, streaming, server/API routes, server functions, middleware, universal deployment, and end-to-end TypeScript.
- SvelteKit is the preferred high-performance non-React default when maturity matters because official docs include app creation, route conventions, server-rendered first visits, and dedicated performance guidance.
- SolidStart remains a good high-performance option when fine-grained reactivity is the product reason, but its own docs describe it as intentionally less opinionated and note that documentation is still being expanded.
- Tailwind CSS is the default CSS layer because current docs expose framework guides and a Vite plugin path that works well across Astro, SvelteKit, Solid, and React-family projects.
- React Compiler is now a first-class React docs topic and should be configured for React projects instead of relying on manual memoization patterns by default.
- Oxc provides both Oxlint and Oxfmt, including package scripts for linting/fixing and formatting/checking, so new projects should prefer Oxc over ESLint/Prettier unless compatibility blocks it.
- Vitest is the default test runner for these Vite-oriented stacks, with framework-specific testing libraries added only when component tests are needed.

## Skill Shape

- Keep `SKILL.md` procedural and concise.
- Put framework-specific stack details and scaffold commands in `references/stack-selection.md`.
- Include agent UI metadata in `agents/openai.yaml`.
- Do not add templates or scripts yet; official CLIs are more likely to stay current than bundled boilerplate.

## Validation Plan

- Run skill quick validation.
- Check `agents/openai.yaml` default prompt references `$frontend-web-project-setup`.
- Confirm plugin discovery is automatic through `skills/`, with only root docs and Codex long description updated.
