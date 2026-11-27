# Platforms

This repo ships two shared plugins, `core` and `software`, to four harnesses:
Claude Code, OpenCode, Antigravity and Cursor (ADR-0006). Each installs them
with what its maker ships; nothing is copied into projects by a script of ours.

| | Claude Code | Cursor | Antigravity | OpenCode |
|---|---|---|---|---|
| Installs from | `.claude-plugin/marketplace.json` | `.cursor-plugin/marketplace.json` | `plugins/<p>/.antigravity-plugin/plugin.json` | the skills folders (`.agents/skills/`) |
| Plugin manifest | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` | `.antigravity-plugin/plugin.json` | none: OpenCode plugins are JS modules and carry no skills |
| smode harness doc | `harness/claude-code.md` | `harness/cursor.md` | `harness/antigravity.md` | `harness/opencode.md` |
| Checked | plugin install and `npx skills` (yes) | through T3; plugin install not yet | `agy plugin validate --strict`, `agy plugin install` and an `agy -p` session (yes) | `npx skills` and an `opencode run` session (yes) |

No plugin carries agents (ADR-0005). smode works alone: it starts no worker
and picks no model; a skill that uses sub-agents by design runs them on the
harness's default sub-agent and the session's model. Choosing a model per step
is the factory's job (`docs/agents/roles.md`, ADR-0006).

## Plugin layout

```
plugins/<domain>/            shared: skills every harness loads
  .claude-plugin/plugin.json
  .cursor-plugin/plugin.json
  .antigravity-plugin/plugin.json
  skills/<skill>/SKILL.md            name, description, disable-model-invocation, argument-hint
plugins/<domain>-claude/     Claude Code only (hooks); none today
```

All three manifests of a plugin carry the same version; the validator checks it.

A user-invoked skill sets `disable-model-invocation: true` in `SKILL.md`; all
four harnesses honour it. In `software`, every skill except `smode` is
user-invoked, so `smode` is the one entry point; it reads the other skills'
files directly, which runs them even when a harness's skill command would refuse.

Claude Code shows `argument-hint` after the skill's name when a person types
`/`; on every harness the text after the skill's name is its argument. `smode`
takes `[<playbook>] <task>`.

## Install in a project

### Claude Code

```bash
claude plugin marketplace add sanphandinh/skills
claude plugin install core@sanphan-skills --scope project
claude plugin install software@sanphan-skills --scope project
```

Commit `.claude/settings.json`; teammates run the install commands once.

### Cursor (not yet installed by hand)

```bash
cursor-agent plugin marketplace add sanphandinh/skills
```

Then install `core` and `software` from `/plugin` in `cursor-agent` (or
Customize in the app), choosing project scope. Cursor has no non-interactive
install command yet.

### Antigravity

```bash
git clone https://github.com/sanphandinh/skills ~/src/sanphan-skills
agy plugin install ~/src/sanphan-skills/plugins/core
agy plugin install ~/src/sanphan-skills/plugins/software
```

`agy plugin validate --strict <folder>` checks a manifest, and `agy plugin list`
shows what is installed. Installed plugins live in `~/.gemini/config/plugins/`
and load in every workspace.

### OpenCode, and any harness without plugins

```bash
npx skills add sanphandinh/skills --skill '*' -a opencode
```

`-a opencode`, `-a cursor` and `-a antigravity` all write `.agents/skills/`
(measured), which the three harnesses read; `-a claude-code` writes
`.claude/skills/`. Every skill lands side by side, without the plugin prefix
and without per-plugin versions; `npx skills update` updates them. Install all
of them, or at least `smode` with every skill it runs: smode finds a skill by
name (its **Running a skill by name**), next to its own folder first.

Then, on any harness, run smode's `setup` playbook ("smode setup"): it writes
the project's agent docs and its `### Entry point` rule.

## Running the factory

The factory is the only part that delegates. It runs on one agent manager
today, T3 Code (`references/t3.md` of the `factory` skill); another manager is
one more reference plus a passing setup smoke test.

Each project needs, from `setup-software-context` and `setup-verification`:
`docs/agents/issue-tracker.md` with its `## Factory` section,
`triage-labels.md`, `merge-policy.md`, `response-language.md`, and `verify.md`.
Each machine needs T3 Code with the providers the routes name, and `gh` signed
in. Then, in a T3 thread on the project root, in full-access mode:

```text
factory setup    write docs/agents/factory.md and docs/agents/roles.md, check each provider, smoke-test T3
factory run      schedule the watcher and keep building
factory once     one dispatcher run now
factory pause    start nothing new; resume and stop work the same way
```

`docs/agents/roles.md` maps the five roles (`scout`, `worker`, `thinker`,
`reviewer`, `coordinator`) to candidates in order; `factory setup override`
changes chosen roles, and `node <factory>/scripts/roles.mjs show --channels
anthropic,cursor,antigravity` shows where each role runs now. `setup` also
converts older settings: a `docs/agents/factory-v2.md` is renamed and keeps its
memory, version 1 settings (Orca) get a proposed new file, a factory with one
coordinator for life is converted (its `factory:hold` labels become
`ready-for-human`), and old roles in `~/.claude/rules/smode-roles.md` become
the project's `roles.md`.

A watcher on T3's scheduler, on the `scout` route, looks at the board every
`Wake timeout` and starts a dispatcher only when the issues, the pull requests
or trunk's checks changed, or when something in the memory folder is due. The
dispatcher, a fresh thread each run, claims ready tickets and launches one
coordinator per ticket, on the `coordinator` route, in that ticket's own
worktree; its workers share it. Finished workers, worker questions and watched
pull requests wake the coordinator directly; the dispatcher wakes it when a
hold is released, a due passed, or someone with write access commented. The
factory asks you through a `## Factory brief` on the ticket and the
`ready-for-human` role; answer there and hand the ticket back. Set the T3
project's worktree cleanup as the reference asks, so a held ticket keeps its
worktree.

State lives in three places: the tracker and the git host (tickets, plans,
briefs, pull requests and the verdict statuses `factory/verify` and
`factory/review`), T3 (sessions in flight), and the memory folder outside the
repository (default `~/.local/share/factory/<repo>`: claims, resources and dues
written through `scripts/resources.mjs`, each ticket's story, the journal, the
wiki, worker results, `providers.md`, `quota.md`). A worker that stops on a usage limit
blocks that candidate in `quota.md`, and the step restarts on the next
candidate of its route.
