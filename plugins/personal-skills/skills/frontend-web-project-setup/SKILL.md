---
name: frontend-web-project-setup
description: "Choose and scaffold frontend web project stacks using current stable packages and a small decision matrix: Astro for landing pages, marketing sites, content sites, docs, portfolios, and SEO-heavy pages; TanStack Start with latest React and React Compiler for normal React/full-stack web apps; SvelteKit or SolidStart for high-performance interactive apps. Apply shared defaults for TypeScript-only code, latest Tailwind CSS, framework-native state management, Oxc linting/formatting, and Vitest or framework-appropriate testing. Use when creating a new web project, selecting a frontend framework, setting up initial scripts, or documenting stack choices for agents."
---

# Frontend Web Project Setup

## Overview

Create new frontend web projects with a bias toward simple, fast defaults. Select the stack from the user goal first, scaffold from official tooling, then add only the project conventions needed for development, verification, and future agents.

## Workflow

1. Clarify the project goal from the request and existing repo context:
   - landing page, marketing site, docs, portfolio, blog, or SEO content;
   - high-performance interactive experience;
   - normal app, dashboard, SaaS, admin, CRUD, auth, or API-backed product;
   - explicit framework, hosting, styling, package manager, or team preference.
2. Load `references/stack-selection.md` before choosing a framework or writing scaffold commands.
3. Choose the stack conservatively:
   - default landing/content projects to Astro;
   - default normal React/full-stack apps to TanStack Start;
   - default high-performance non-React apps to SvelteKit unless the user specifically wants Solid, fine-grained reactivity, or minimal opinions, then choose SolidStart;
   - avoid choosing a plain SPA unless the user explicitly asks for a client-only app.
4. Scaffold with the official CLI or official example path for the chosen stack. Use current stable versions at scaffold time and preserve the user's package manager when a repo already exists.
5. Add project basics only when they fit the request:
   - TypeScript only; do not choose JavaScript templates;
   - latest stable Tailwind CSS as the default CSS layer unless the user explicitly chooses another styling system;
   - Oxc linting and formatting scripts;
   - Vitest or the framework's preferred test runner;
   - `AGENTS.md` or `CLAUDE.md` setup notes when the repo uses agent instructions.
6. Keep generated UI usable on the first screen. Build the actual landing page, app shell, dashboard, or interactive surface rather than a placeholder marketing page.
7. Verify before finishing:
   - install dependencies if needed and allowed;
   - run the scaffold's typecheck/lint/build command when available;
   - start the dev server for apps that require one;
   - inspect the rendered UI with browser tooling when the task includes visual implementation.

## Stack Policy

- Prefer official scaffolds over hand-rolled project skeletons.
- Use latest stable framework packages at scaffold time. Prefer `@latest` scaffold commands and unpinned install commands over stale copied versions.
- Prefer server-rendered or static output over client-only rendering when SEO, first load, sharing, or content matters.
- Keep client JavaScript opt-in for landing and content pages.
- Treat TanStack Start as the default app stack when React is acceptable and the app needs routing, SSR, server functions, API routes, or end-to-end TypeScript. Use latest stable React and configure React Compiler for React projects.
- Treat SvelteKit as the default high-performance app stack when the user wants non-React ergonomics, mature app docs, adapters, forms, and route-level rendering control.
- Treat SolidStart as the high-performance choice for fine-grained reactivity and very interactive UI, while noting that SolidStart is intentionally less opinionated and its docs may be less complete than SvelteKit's.
- Do not add auth, database, ORM, component libraries, analytics, CMS, or payment dependencies unless requested or clearly required by the product brief.

## Project Defaults

- Use TypeScript for all projects. If a scaffold asks, choose the TypeScript option. If a user asks for JavaScript, confirm before deviating.
- Use latest stable Tailwind CSS for styling unless the user explicitly requests a different CSS approach or the target framework's official template already provides a stronger domain-specific styling choice.
- For state management, prefer built-in or framework-native solutions first: route loaders/actions, server functions, URL/search params, signals/stores, context, reducers, and local component state. Add external state libraries only when the app's complexity clearly requires them.
- For React projects, use latest stable React and React DOM. Configure React Compiler using the current official React docs and avoid manual memoization patterns unless the compiler cannot handle the case.
- For Astro, Solid, and Svelte projects, use the latest stable framework packages available through official scaffold commands.
- Use Oxc for linting and formatting:
  - add `oxlint` and `oxfmt` as dev dependencies when the project does not already have an equivalent Oxc setup;
  - prefer scripts such as `lint`, `lint:fix`, `format`, and `format:check`;
  - keep framework checks such as `astro check` or `svelte-check` as type/component checks, not as replacements for Oxc.
- Use Vitest for unit and lightweight integration tests unless the chosen framework scaffold has a more appropriate official testing path. Add testing-library packages only when component tests are actually needed.
- Use responsive CSS from the start. Avoid viewport-scaled font sizes and unstable layout dimensions.
- Add real visual assets for websites and games. Use local assets, official product media, generated images, or safe image search sources as appropriate.
- Keep package scripts conventional: `dev`, `build`, `preview` or framework equivalent, plus `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, and `test:run` when the scaffold/tooling supports them.
- Prefer environment examples such as `.env.example` over committed secrets.
- Record framework choice and local dev commands in `AGENTS.md` when creating a repo intended for coding agents.

## Verification

Run checks appropriate to the stack and report exact results:

- Astro: `astro check` when configured, then build.
- TanStack Start: React Compiler-enabled build, typecheck, Oxc lint/format check, tests, then build.
- SvelteKit: `svelte-check` or package script equivalent when configured, then build.
- SolidStart: typecheck, Oxc lint/format check, tests, then build.
- Any stack: run the dev server and inspect the rendered page when the task includes UI implementation.

If dependency installation or network access is blocked, verify static files and package configuration, then state that runtime verification is pending.

## Failure Handling

- If the request says "landing page" but includes substantial authenticated app workflows, explain the tradeoff and ask whether the first deliverable is the public site or the app.
- If the user asks for maximum performance but requires a React-only ecosystem, choose TanStack Start and optimize route/data boundaries instead of forcing Svelte or Solid.
- If official scaffolding commands changed or fail, check current official docs before inventing commands.
- If the repo already has a framework, do not migrate stacks without explicit approval.
- If React Compiler, Oxfmt, or another requested latest tool is not compatible with the selected framework at setup time, document the blocker and use the closest official integration path rather than silently falling back to older ESLint/Prettier/JavaScript defaults.
