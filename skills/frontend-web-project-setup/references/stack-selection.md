# Frontend Stack Selection

Use this reference before choosing a frontend framework or writing scaffold commands.

## Decision Matrix

| User goal | Default stack | Why |
| --- | --- | --- |
| Landing page, marketing site, docs, blog, portfolio, SEO content | Astro | Content-first, server-first, static output by default, partial hydration through islands, low client JavaScript. |
| Normal web app, SaaS, dashboard, admin, CRUD, auth flows, API-backed product | TanStack Start | React full-stack app framework with TanStack Router, SSR, streaming, server routes, server functions, middleware, and end-to-end TypeScript. Use latest React and React Compiler. |
| High-performance app, non-React UI, route-level rendering control, mature docs | SvelteKit | Server-rendered first visit, client navigation after hydration, built-in performance work such as code-splitting, asset preloading, data loading controls, and per-route prerendering. |
| High-performance highly interactive UI, fine-grained reactivity, team wants Solid | SolidStart | Solid-based meta-framework with CSR, SSR, SSG, nested routing, deployment presets, and fine-grained reactivity. Less opinionated than SvelteKit. |
| Client-only prototype, embeddable widget, no SEO or server needs | Vite with Svelte or Solid | Only choose this when the user explicitly wants a SPA or widget. |

## Official Scaffold Commands

Prefer the user's existing package manager. Use `npm` only when no preference is visible.

Astro:

```bash
npm create astro@latest
pnpm create astro@latest
yarn create astro
```

TanStack Start:

```bash
npx @tanstack/cli@latest create
```

Official example fallback:

```bash
npx gitpick TanStack/router/tree/main/examples/react/start-basic my-app
cd my-app
npm install
npm run dev
```

SvelteKit:

```bash
npx sv create my-app
cd my-app
npm run dev
```

SolidStart:

```bash
npm init solid
pnpm create solid
yarn create solid
```

## Shared Tooling Defaults

- Use latest stable package versions at setup time. Prefer official `@latest` scaffolds and package-manager defaults instead of copying hardcoded versions from this file.
- Use TypeScript only. Choose TypeScript templates and use `.ts`/`.tsx` where applicable.
- Use latest stable Tailwind CSS for CSS unless the user explicitly chooses another styling system.
- Use Oxc for linting and formatting:
  - `oxlint` for linting;
  - `oxfmt` for formatting;
  - keep framework-specific checks as separate type/component checks.
- Use Vitest for tests unless a framework's official scaffold provides a better test path for the exact project type.
- Prefer built-in or framework-native state before external state libraries.

Recommended package scripts:

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

For framework type/component checks, add a separate `typecheck` script such as `astro check`, `svelte-check`, `tsc --noEmit`, or the framework scaffold's equivalent.

## CSS Defaults

- Use Tailwind CSS latest stable as the default CSS layer.
- For Vite-based frameworks, prefer the current Tailwind Vite plugin integration when supported.
- Keep Tailwind usage practical: use utilities for layout and styling, extract repeated component styles only when duplication becomes noisy, and avoid one-off arbitrary values when semantic theme tokens are clearer.
- Do not add a component library by default. Add shadcn, Skeleton, Melt UI, Kobalte, Bits UI, or similar only when requested or when the project clearly needs a maintained component system.

## React Defaults

- Use latest stable `react` and `react-dom`.
- Configure React Compiler for React projects, including TanStack Start projects, using the current official React installation docs.
- Do not add `useMemo`, `useCallback`, or `React.memo` by habit. Add manual memoization only when profiling, compiler diagnostics, or third-party integration constraints justify it.
- Prefer React built-ins and TanStack primitives for state:
  - local component state for local UI state;
  - URL/search params for shareable state;
  - route loaders, server functions, and TanStack Query for server state;
  - context/reducer only for shared client state that truly crosses route/component boundaries.
- Add Zustand, Jotai, Redux, XState, or other state libraries only after the app demonstrates a real state-model need.

## Astro Defaults

- Use Astro for public pages where speed, SEO, and content delivery matter more than app-like client state.
- Keep most UI in `.astro` components and HTML/CSS. Add Svelte, Solid, React, or another UI framework only for interactive islands.
- Use client directives sparingly; hydrate only the components that need browser interactivity.
- Use content collections for typed Markdown/content-heavy projects.
- Use Astro image components or `astro:assets` for local images when possible.
- Prefer static output unless the request needs sessions, dynamic server rendering, or backend actions.
- Use latest stable Astro through official scaffold commands.
- Use framework-native state inside islands and avoid global client state for mostly static pages.
- Use `astro check` for type/content validation when configured.
- Good fit examples: product landing page, waitlist, docs, blog, agency site, course site, local business site, portfolio, launch page.

## TanStack Start Defaults

- Use TanStack Start when React is acceptable and the project is an application, not just a content site.
- Lean on file-based routing, typed route params/search params, route loaders, and router context instead of ad hoc global fetch code.
- Use server functions for type-safe client/server calls and server/API routes for HTTP endpoints.
- Use TanStack Query when the app needs server-state caching, mutations, or background refetching.
- Use latest stable React and React Compiler.
- Keep React Server Components experimental unless the user explicitly asks for them and the current framework docs support the target deployment.
- Good fit examples: SaaS dashboard, internal tool, CRM, admin panel, authenticated product, full-stack MVP.

## SvelteKit Defaults

- Use SvelteKit when the user wants high performance without React and wants a mature full-stack app framework.
- Use `src/routes` and `load` functions instead of a custom router.
- Prefer server `load` and form actions for data that should stay on the server.
- Use per-route `prerender` for static pages inside otherwise dynamic apps.
- Keep external scripts and large dependencies isolated or lazily loaded.
- Use latest stable Svelte and SvelteKit through official scaffold commands.
- Prefer Svelte runes, stores, route data, and form actions before adding external state libraries.
- Use `svelte-check` or the scaffold's typecheck script for Svelte-specific checks.
- Good fit examples: interactive product with strong first-load needs, lean dashboards, form-heavy apps, public/private hybrid apps.

## SolidStart Defaults

- Use SolidStart when fine-grained reactivity and high interaction density are central to the product.
- Choose a template that matches the request rather than adding many packages after scaffold.
- Keep the app isomorphic where possible so logic can run correctly on client or server.
- Use SSR or SSG according to the route's product need; do not default everything to CSR.
- Use latest stable Solid and SolidStart through official scaffold commands.
- Prefer Solid signals, memos, resources, context, and route data before adding external state libraries.
- Note when choosing SolidStart that the framework is less opinionated and official docs may require more confirmation than SvelteKit.
- Good fit examples: complex calculators, editors, realtime-feeling interfaces, highly interactive tools.

## Shared Best Practices

- Start from official docs or official examples; avoid stale third-party templates unless the user selected them.
- Use TypeScript, not JavaScript.
- Do not install auth, database, ORM, CMS, analytics, or payment libraries unless the request requires them.
- Put public static assets in the framework's public/static location and source-processed assets in `src`.
- Add root instructions for agents with exact dev/build/check commands when creating a new repo.
- Run a production build before claiming the scaffold is ready.
- For UI tasks, inspect the rendered page; passing build output alone is not enough.

## Source Notes

- Astro docs position Astro for content-driven sites, server-first rendering, zero JavaScript by default, content collections, and islands architecture: https://docs.astro.build/en/concepts/why-astro/ and https://docs.astro.build/en/concepts/islands/
- Astro install docs list `npm create astro@latest`, `pnpm create astro@latest`, and `yarn create astro`: https://docs.astro.build/en/install-and-setup/
- TanStack Start docs list TanStack Router plus Vite/Rsbuild foundations and features such as SSR, streaming, server/API routes, server functions, middleware, universal deployment, and end-to-end type safety: https://tanstack.com/start/latest/docs/framework/react/overview
- TanStack Start getting started docs list `npx @tanstack/cli@latest create` and official example paths: https://tanstack.com/start/latest/docs/framework/react/getting-started
- SvelteKit docs describe `npx sv create my-app`, route files under `src/routes`, server-rendered first visits, and a performance page covering code-splitting, asset preloading, request coalescing, parallel loading, prerendering, and link preloading: https://svelte.dev/docs/kit/creating-a-project and https://svelte.dev/docs/kit/performance
- SolidStart docs describe `npm init solid`/`pnpm create solid`, CSR/SSR/SSG support, fine-grained reactivity, nested routing, deployment presets, and less-opinionated framework boundaries: https://docs.solidjs.com/solid-start and https://docs.solidjs.com/solid-start/getting-started
- Tailwind CSS docs show the current Vite plugin setup, package install, and `@import "tailwindcss"` CSS entry: https://tailwindcss.com/docs/installation/using-vite
- React docs describe React Compiler as automatically optimizing React apps by handling memoization, with official installation and incremental adoption guidance: https://react.dev/learn/react-compiler
- Oxc docs recommend installing `oxlint` and `oxfmt` as dev dependencies and adding package scripts for linting, fixing, formatting, and format checks: https://oxc.rs/docs/guide/usage/linter.html and https://oxc.rs/docs/guide/usage/formatter.html
- Vitest docs describe installing `vitest`, adding a `test` script, and using Vite config by default: https://vitest.dev/guide/
