# Framework Presets

Use these presets after inspecting `package.json` and the project files. Preserve the raw dev command as `dev:raw`, but make Portless the default `dev` command unless the user explicitly asks for opt-in Portless.

## Detection

Prefer dependency and file evidence over project names.

| Framework | Strong signals | Typical raw dev command |
| --- | --- | --- |
| TanStack Start | `@tanstack/react-start`, `app.config.ts`, `vite.config.*` with TanStack Start | `vite dev` or the repo's existing `dev` script |
| Vite | `vite` dependency, `vite.config.*`, `index.html` | `vite dev` |
| Next.js | `next` dependency, `next.config.*`, `app/` or `pages/` | `next dev` |
| Astro | `astro` dependency, `astro.config.*`, `src/pages/` | `astro dev` |

If multiple signals exist, prefer the existing `dev` script as the raw command and wrap it through Portless.

## Script Patterns

Prefer making Portless the default `dev` script and preserving the raw command:

```json
{
  "scripts": {
    "dev": "portless run <raw command>",
    "dev:raw": "<raw command>"
  }
}
```

Use `portless.json` for the stable app name instead of relying on inferred directory names:

```json
{
  "name": "<app-name>"
}
```

Use explicit `--name` only for temporary one-off commands. Prefer `portless.json` for committed project setup.

For monorepos, configure each web app explicitly:

```json
{
  "apps": {
    "apps/web": {
      "name": "<app-name>"
    }
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

## Agent Documentation Snippet

Add a concise section to `AGENTS.md` or `CLAUDE.md`:

```markdown
## Local Development With Portless

- Use `npm run dev` for the web dev server. It runs through Portless by default.
- Expect the app at `https://<app-name>.localhost`; use `portless list` to confirm the active route.
- Do not accept `https://<app-name>.localhost:1355` as the normal setup. That means the clean HTTPS proxy on port 443 is not active.
- Do not guess or hardcode `localhost:<port>` for browser checks.
- If Portless is blocked by proxy, TLS, sudo, no-TTY, or route-lock issues, run `npm run dev:raw` only as a temporary verification fallback, then report that Portless runtime verification is still pending.
```

Adjust `npm` to the detected package manager.
