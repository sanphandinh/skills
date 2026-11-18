# Platforms

This repo is one marketplace with three catalogs. Each agent installs plugins
with its own plugin commands; nothing is copied into projects by a script.
There are two plugins, both shared: `core` and `software`.

| | Claude Code | Codex | Oh My Pi |
|---|---|---|---|
| Catalog it reads | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` | `.omp-plugin/marketplace.json` (preferred over the Claude one) |
| Plugin manifest | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | `.omp-plugin/plugin.json`, else `.claude-plugin/plugin.json` |
| Model per worker | chosen at delegation (`harness/claude-code.md`) | the session's model (no model per worker) | per-call model, granted by user-level keys (`harness/omp.md`) |
| Extra components | hooks, Claude-only skill keys (`model`, `effort`, `context: fork`, `agent`) | `agents/openai.yaml` per skill | `rules/`, `commands/`, `tools/`, `hooks/`, `package.json#omp` extensions |
| Project scope | `.claude/settings.json` `enabledPlugins` (commit it) | `.codex/config.toml` `[plugins."x@sanphan-skills"] enabled = true` (commit it) | `.omp/plugins/installed_plugins.json` (machine paths: do not commit) |

No plugin carries agents (ADR-0005): a skill delegates by role, and the model
comes from the project's `docs/agents/roles.md` when the work is delegated.

## Plugin layout

```
plugins/<domain>/            shared: skills every agent loads
  .claude-plugin/plugin.json
  .codex-plugin/plugin.json
  skills/<skill>/SKILL.md            name, description, disable-model-invocation, argument-hint
  skills/<skill>/agents/openai.yaml  Codex UI metadata and implicit-invocation policy
plugins/<domain>-claude/     Claude Code only (hooks); none today
plugins/<domain>-omp/        Oh My Pi only (rules, commands); none today
  .omp-plugin/plugin.json            required for an OMP plugin
```

A user-invoked skill sets `disable-model-invocation: true` in `SKILL.md`
(Claude Code and OMP honour it) and `policy.allow_implicit_invocation: false`
in `agents/openai.yaml` (Codex). In `software`, every skill except `smode` is
user-invoked, so `smode` is the one entry point; it reads the other skills'
files directly, which runs them even when a harness's skill command would refuse.

Claude Code shows `argument-hint` after the skill's name when a person types
`/`; OMP reads the field only for prompt templates, and Codex has no hint
field. On every harness the text after the skill's name is its argument.
`smode` takes `[<playbook>] <task>`.

## Install in a project

Each machine registers the marketplace once:

```bash
claude plugin marketplace add sanphandinh/skills
codex plugin marketplace add sanphandinh/skills
omp plugin marketplace add sanphandinh/skills
```

Then, in the project:

```bash
claude plugin install core@sanphan-skills --scope project
claude plugin install software@sanphan-skills --scope project
omp plugin install core@sanphan-skills --scope project
omp plugin install software@sanphan-skills --scope project
```

For Codex, commit `.codex/config.toml`:

```toml
[plugins."core@sanphan-skills"]
enabled = true

[plugins."software@sanphan-skills"]
enabled = true
```

Commit `.claude/settings.json` and `.codex/config.toml`; add `.omp/plugins/` to
`.gitignore`. Teammates run the same install commands once. Then run smode's
`setup` playbook ("smode setup") to write `docs/agents/roles.md`.

### Without plugins

Skills also run when a tool copies them into an agent's skills folder:

```bash
npx skills add sanphandinh/skills --skill '*' -a claude-code -a codex
```

This puts every skill side by side in `.claude/skills/` and `.agents/skills/`
(OMP reads both), without the plugin prefix and without per-plugin versions;
`npx skills update` updates them. Install all of them, or at least `smode` with
every skill it runs: smode finds a skill by name (its **Running a skill by
name**), next to its own folder first, so the result is the same as with
plugins. Verified on Claude Code with a project install.

## Harnesses and managers

The roles live in the project, in `docs/agents/roles.md` (ADR-0004), on every
harness; each smode harness doc maps a role's candidates to its tools and skips
the ones it cannot run.

| Harness (runs a session) | smode harness doc | Runs candidates via | Also needs | Checked |
|---|---|---|---|---|
| Claude Code | `harness/claude-code.md` | `anthropic` | nothing | yes |
| Oh My Pi | `harness/omp.md` | every channel `omp models` lists | grant keys `smode-<repo>-<role>-<n>` in `~/.omp/agent/config.yml`, `task.perCallModel: on` | yes |
| Codex | `harness/codex.md` | none: every worker runs on the session's model | nothing | no Codex session run yet |
| a provider inside T3 Code | `harness/t3.md`, on top of the provider's own doc | every provider T3 offers | nothing | yes (Claude, Cursor, Antigravity) |

smode's `setup` playbook writes `docs/agents/roles.md` (and what the table's
last column asks), and `setup override` changes chosen roles. To see where each
role runs now:

```bash
node <smode>/scripts/roles.mjs show --channels anthropic,cursor,antigravity
```

The factory runs on one agent manager today: T3 Code (`references/t3.md` of the
`factory` skill). Another manager is one more reference plus a passing setup
smoke test.

## Running the factory

Each project needs, from `setup-software-context` and `setup-verification`:
`docs/agents/issue-tracker.md` with its `## Factory` section,
`triage-labels.md`, `merge-policy.md`, `response-language.md`, and `verify.md`;
and `docs/agents/roles.md` with a route for `thinker`, `worker` and `reviewer`
(smode's `setup` playbook). Each machine needs T3 Code with the providers those
routes name, and `gh` signed in. Then, in a T3 thread on the project root, in
full-access mode:

```text
factory setup   write docs/agents/factory.md, check each provider, smoke-test T3
factory once    one wake
factory run     start the watcher and keep building
```

`setup` also converts older settings: a `docs/agents/factory-v2.md` is renamed
and keeps its memory, and version 1 settings (Orca) get a proposed new file and
an in-place upgrade of their memory folder.

The coordinator is that thread for life. A watcher thread on T3's scheduler, on
the `scout` route, runs `wake-check.sh` every `Wake timeout` and wakes the
coordinator only when the tracker, the pull requests or the results changed, or
after an hour; finished workers, worker questions and watched pull requests wake
it directly. Talk to the coordinator in its thread ("pause", "resume", "stop",
or an answer); it asks you through `factory:hold` briefs on the ticket.

State lives in three places: the tracker and the git host (tickets, plans,
briefs, pull requests and the verdict statuses `factory/verify` and
`factory/review`), T3 (workers in flight), and the memory folder outside the
repository (default `~/.local/share/factory/<repo>`: journal, wiki, worker
results, `providers.md`, `quota.md`). A worker that stops on a usage limit
blocks that candidate in `quota.md`, and the step restarts on the next
candidate of its route.
