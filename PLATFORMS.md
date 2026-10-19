# Platforms

This repo is one marketplace with three catalogs. Each agent installs plugins
with its own plugin commands; nothing is copied into projects by a script.

| | Claude Code | Codex | Oh My Pi |
|---|---|---|---|
| Catalog it reads | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` | `.omp-plugin/marketplace.json` (preferred over the Claude one) |
| Plugin manifest | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | `.omp-plugin/plugin.json` (preferred over `.claude-plugin`) |
| Plugins it sees | shared + `*-claude` | shared | shared + `*-omp` |
| Agents | `agents/*.md`, `model: opus\|sonnet\|haiku\|inherit` | not pluggable; skills fall back to sequential work | `agents/*.md`, `model: ["@role", ...]`, `thinking-level`, `tools`, `spawns`, `output` schema, `autoloadSkills` |
| Extra components | hooks, Claude-only skill keys (`model`, `effort`, `context: fork`, `agent`) | `agents/openai.yaml` per skill | `rules/` (regex/AST interrupts, judged questions), `commands/` (markdown or TypeScript), `tools/`, `hooks/`, `package.json#omp` extensions |
| Project scope | `.claude/settings.json` `enabledPlugins` (commit it) | `.codex/config.toml` `[plugins."x@sanphan-skills"] enabled = true` (commit it) | `.omp/plugins/installed_plugins.json` (machine paths: do not commit) |

## Plugin layout

```
plugins/<domain>/            shared: skills every agent loads
  .claude-plugin/plugin.json
  .codex-plugin/plugin.json
  skills/<skill>/SKILL.md            name, description, disable-model-invocation, argument-hint
  skills/<skill>/agents/openai.yaml  Codex UI metadata and implicit-invocation policy
plugins/<domain>-claude/     Claude Code only
  .claude-plugin/plugin.json
  agents/*.md
plugins/<domain>-omp/        Oh My Pi only
  .omp-plugin/plugin.json            required: without it OMP treats agents as Claude-dialect and drops `model`
  agents/*.md  rules/*.md  commands/  tools/  hooks/
```

A user-invoked skill sets `disable-model-invocation: true` in `SKILL.md`
(Claude Code and OMP honour it) and `policy.allow_implicit_invocation: false`
in `agents/openai.yaml` (Codex).

## How skills, agents, and roles fit

- A **skill** describes the process and names the agents it would like to use,
  always with a fallback: "if a `review-standards` agent is available, give it
  the Standards axis; otherwise do it yourself".
- An **agent** lives in a platform plugin and names a **role** from
  [ROLES.md](ROLES.md), never a concrete model.
- The **role** maps to a model in your own agent config.

Verified on OMP 18.6: with `software-omp` installed, OMP loads its
`review-*` agents with the role chain, output schema, and autoloaded skills,
and they take precedence over same-named agents from a Claude project plugin.
Without `software-omp`, OMP falls back to the Claude agents with their model
dropped (they run on the current model).

## Install in a project

Each machine registers the marketplace once:

```bash
claude plugin marketplace add sanphandinh/skills
codex plugin marketplace add sanphandinh/skills
omp plugin marketplace add sanphandinh/skills
```

Then, in the project:

```bash
claude plugin install software@sanphan-skills --scope project
claude plugin install software-claude@sanphan-skills --scope project
omp plugin install software@sanphan-skills --scope project
omp plugin install software-omp@sanphan-skills --scope project
```

For Codex, commit `.codex/config.toml`:

```toml
[plugins."software@sanphan-skills"]
enabled = true
```

Commit `.claude/settings.json` and `.codex/config.toml`; add `.omp/plugins/` to
`.gitignore`. Teammates run the same install commands once.

## Adding a platform component

1. Put it in the `<domain>-claude` or `<domain>-omp` plugin, never in a shared one.
2. For agents, pick a role from `ROLES.md` (add one there if needed).
3. If a shared skill should use it, mention it by name in the skill with a
   fallback for platforms that do not have it.
4. `npm run validate`.

## Running autopilot

`autopilot` runs one fresh, non-interactive agent session per role, through
the harness you name. Its script needs only Node 20+ and git; it runs from the
plugin's install folder with no dependencies.

| | Claude Code | Oh My Pi |
|---|---|---|
| Plugins | `software`, `software-claude` | `software`, `software-omp` |
| Session | `claude -p --output-format json` delegating to `software-claude:<agent>` | `omp -p --mode json` delegating to `<agent>` |
| Permissions | `--permission-mode bypassPermissions`: nobody can answer prompts, so each session runs inside a disposable worktree | `--auto-approve`, same reason |
| Role models | Agent aliases (implementer `inherit`, others `opus`); the parent session runs on `sonnet` so the implementer never shares the reviewers' model. Remap aliases per project with `env` in `.claude/settings.json` (`templates/roles.claude-settings.json`) | Custom roles `implementer`, `verifier`, `reviewer` in the project's `.omp/config.yml` (`templates/roles.omp-config.yml`); unassigned ones fall back to `@task` and `@slow` |

A project also needs, from `setup-software-context` and `setup-verification`:

- `docs/agents/issue-tracker.md` with the claim, close, and handoff conventions and a `Pull requests: github <owner>/<repo>` line. Every `gh` call passes that repository, so another remote never receives a pull request.
- `docs/agents/merge-policy.md` (optional; the built-in defaults apply without it).
- `docs/agents/verify.md`; without it nothing auto-merges.

Run it from the repository root:

```bash
node <plugin folder>/skills/autopilot/scripts/autopilot.mjs run .scratch/<feature>/spec.md
```

The harness is detected: the agent session the script runs inside (`omp` or `claude` among its parent processes, or `CLAUDECODE=1`), else the agent plugin the project installed, else the only agent CLI on PATH. `--harness` overrides it.

The adapters' smoke tests call the real CLIs only when asked:
`AUTOPILOT_SMOKE_OMP=1`, `AUTOPILOT_SMOKE_CLAUDE=1`, `AUTOPILOT_SMOKE_GH=1`.
