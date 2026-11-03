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

## Running the factory

`factory` runs a long-lived coordinator agent inside an agent manager. Every
step of every ticket (plan, build, verify, review, rework) is a fresh worker
that the manager starts in its own worktree. Orca is the only manager so far:
`references/orca.md` in the skill, verified on Orca 1.4.244 with Oh My Pi
workers (`Agent: omp`).

Each machine needs:

- Orca running, its `orca` CLI on the PATH, and `gh` signed in.
- The role agents at **user** scope, because the worktrees Orca creates do not
  see a project's `.omp/plugins/`: `omp plugin install software-omp@sanphan-skills`
  (planner, implementer, verifier, reviewers). An agent file with the same name
  in `~/.omp/agent/agents/` takes precedence over the plugin's.
- Role models in `.omp/config.yml` (`templates/roles.omp-config.yml`). Workers
  start on `@smol` and delegate their step to the role agent.

Each project needs, from `setup-software-context` and `setup-verification`:
`docs/agents/issue-tracker.md` with its `## Factory` section,
`triage-labels.md`, `merge-policy.md`, and `verify.md`. Then, in an Orca
terminal on the project's main checkout, run the `factory` skill
(`/skill:factory` in Oh My Pi):

```text
factory setup   write docs/agents/factory.md and smoke-test the manager
factory once    one wake, to watch what it does
factory run     schedule wakes (an Orca automation) and keep building
```

`run` creates one Orca automation per repository ("factory wake: <repo>") that
types `/skill:factory once` into the coordinator's session every
`Wake timeout`, so the factory keeps going after the agent ends its turn;
Orca's mail cues start a wake as soon as a worker reports. Talk to the
coordinator by typing in its terminal, on the desktop or in Orca's mobile app
("pause", "resume", "stop", or an answer); "stop" removes the automation. It
asks you through `factory:hold` briefs on the ticket and an unread mark on the
workspace in Orca.

State lives in three places: GitHub (tickets, plans, briefs, pull requests and
the verdict statuses `factory/verify` and `factory/review`), Orca (workers in
flight), and the memory folder outside the repository
(`~/.local/share/factory/<repo>`: journal, wiki, worker results). A provider
rate limit ends a wake early; the next scheduled wake picks up where it
stopped, and a worker that failed on the limit is restarted once.

