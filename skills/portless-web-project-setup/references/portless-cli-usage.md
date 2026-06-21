# Portless CLI Usage

Use this reference when writing setup commands, package scripts, or agent documentation for Portless.

Source note: these commands were checked against the Portless docs at `https://portless.sh` and the installed `portless --help` output in this workspace.

## Install

Prefer a project dev dependency when the repo owns its toolchain:

```bash
npm install -D portless
```

Global install is acceptable only when the repo already relies on global tools:

```bash
npm install -g portless
```

## Default Clean URL Target

The target state for this skill is:

```text
https://<app-name>.localhost
```

Do not accept this as the normal state:

```text
https://<app-name>.localhost:1355
```

`:1355` means Portless could not bind the standard HTTPS proxy port. It can be useful as an explicit temporary fallback, but it is not the desired committed setup.

## Project Config

Create `portless.json` to make the route name stable:

```json
{
  "name": "<app-name>"
}
```

For a monorepo:

```json
{
  "apps": {
    "apps/web": {
      "name": "<app-name>"
    }
  }
}
```

## Package Scripts

Make Portless the default dev command:

```json
{
  "scripts": {
    "dev": "portless run <raw-dev-command>",
    "dev:raw": "<raw-dev-command>"
  }
}
```

Examples:

```json
{
  "scripts": {
    "dev": "portless run vite dev",
    "dev:raw": "vite dev"
  }
}
```

This pattern keeps `npm run dev` as the default project command while avoiding recursion. Do not set `"dev": "portless"` unless `portless.json` or the package `"portless"` key points at a different raw script such as `dev:app`.

```json
{
  "scripts": {
    "dev": "portless run next dev",
    "dev:raw": "next dev"
  }
}
```

## Common Commands

```bash
portless
portless run
portless run <cmd>
portless run --name <name> <cmd>
portless <name> <cmd>
portless list
portless get <name>
portless trust
portless prune
portless clean
```

`portless` and `portless run` run the configured package script, defaulting to `dev`. Avoid using them inside the `dev` script itself because that can recurse. Use `portless run <raw-dev-command>` in package scripts.

## Proxy Commands

```bash
portless proxy start
portless proxy stop
portless proxy start --foreground
portless proxy start --lan
portless proxy start --tld test
portless proxy start --wildcard
```

The clean default is HTTPS on port 443. On macOS and Linux, binding port 443 requires elevated privileges. If Portless falls back to port 1355, the setup is not complete for this skill.

For stable clean URLs across reboots, prefer installing the service:

```bash
portless service install
portless service status
portless service uninstall
```

## Hosts And Safari

Chrome, Firefox, and Edge handle `.localhost` subdomains directly. Safari may need `/etc/hosts` entries:

```bash
portless hosts sync
portless hosts clean
```

## Environment Variables

Use these only when the repo has a clear reason:

```bash
PORTLESS_PORT=<number>
PORTLESS_APP_PORT=<number>
PORTLESS_HTTPS=0
PORTLESS_LAN=1
PORTLESS_TLD=<tld>
PORTLESS_WILDCARD=1
PORTLESS_SYNC_HOSTS=0
PORTLESS_STATE_DIR=<path>
PORTLESS=0
```

`PORTLESS=0` bypasses the proxy and is only a temporary fallback for debugging or verification.
