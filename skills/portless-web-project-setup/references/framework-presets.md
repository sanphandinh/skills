# Framework Presets

Use these presets after inspecting `package.json` and the project files. Preserve existing scripts unless the user explicitly asks to replace them.

## Detection

Prefer dependency and file evidence over project names.

| Framework | Strong signals | Typical raw dev command |
| --- | --- | --- |
| TanStack Start | `@tanstack/react-start`, `app.config.ts`, `vite.config.*` with TanStack Start | `vite dev` or the repo's existing `dev` script |
| Vite | `vite` dependency, `vite.config.*`, `index.html` | `vite dev` |
| Next.js | `next` dependency, `next.config.*`, `app/` or `pages/` | `next dev` |
| Astro | `astro` dependency, `astro.config.*`, `src/pages/` | `astro dev` |
| React Router | `@react-router/dev`, `react-router.config.*` | `react-router dev` |

If multiple signals exist, prefer the existing `dev` script as the raw command and wrap it through a Portless script.

## Script Patterns

Prefer adding a Portless-specific script instead of replacing `dev`:

```json
{
  "scripts": {
    "dev": "<existing raw command>",
    "dev:portless": "portless run <existing raw command>"
  }
}
```

If the repo already uses `dev` as its canonical agent command and the user wants Portless by default, use:

```json
{
  "scripts": {
    "dev": "portless run <raw command>",
    "dev:raw": "<raw command>"
  }
}
```

Use explicit names only when the user gives one or the repo has multiple web apps:

```json
{
  "scripts": {
    "dev:portless": "portless run --name <app-name> <raw command>"
  }
}
```

## Preset Notes

### TanStack Start

TanStack Start commonly runs through Vite. Do not add manual `--port` unless the repo already has a reason. Let Portless inject port handling.

### Vite

Portless handles Vite `--port` and host behavior. Avoid hardcoded `--host 0.0.0.0` unless the project already needs LAN or container access.

### Next.js

Use `next dev` as the raw command when no existing custom script exists. For LAN mode, Next.js may require `allowedDevOrigins`, but do not add that unless LAN is part of the request.

### Astro

Use `astro dev` as the raw command. Let Portless inject port flags.

### React Router

Use `react-router dev` as the raw command. Let Portless inject port flags.

## Agent Documentation Snippet

Add a concise section to `AGENTS.md` or `CLAUDE.md`:

```markdown
## Local Development With Portless

- Use `npm run dev:portless` for the web dev server unless this file says otherwise.
- Expect the app at `https://<project>.localhost`; use `portless list` to confirm the active route.
- Do not guess or hardcode `localhost:<port>` for browser checks.
- If Portless is blocked by proxy, TLS, sudo, no-TTY, or route-lock issues, run the raw fallback with `PORTLESS=0 npm run dev` or `npm run dev:raw` when available, then report that Portless runtime verification is still pending.
```

Adjust `npm` to the detected package manager.
