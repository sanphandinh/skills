# smode on Oh My Pi

Read this once per session when the agent is Oh My Pi (OMP), then map each smode action with the tables below.

## Finding skills

| smode step | OMP |
|---|---|
| 1. Skill already loaded | A skill in the session's skill list: load it the way OMP loads skills (`skill://<name>`). |
| 3. Skill locations | In order, as OMP discovers them: `.omp/skills/<skill>/` from the working directory up (closest first); `~/.omp/agent/skills/<skill>/`; `.claude/skills/`, `.agents/skills/` and `.codex/skills/` up from the working directory, then `~/.agents/skills/` and `~/.codex/skills/`; then the installed plugins in `.omp/plugins/installed_plugins.json` (project scope) and `~/.omp/plugins/installed_plugins.json` (user scope): every `<plugin>@<marketplace>` entry, whatever the marketplace, read as `<installPath>/skills/<skill>/SKILL.md`. Each plugin is its own folder, such as `~/.omp/plugins/cache/plugins/<marketplace>___core___0.4.0/`, so a relative path from `software` never reaches `core`. |

The folders OMP scans for skills were read from its source, not run. Because OMP also reads `.claude/skills/` and `.agents/skills/`, skills installed there by `npx skills add` reach OMP too.

Read a skill's `SKILL.md` with `read` and follow it.

## Actions

| smode action | OMP |
|---|---|
| Spawn a worker | The `task` tool with the bundled agent `task` (general purpose), the work order as its task. No agent definition is needed. |
| Spawn a read-only worker | The bundled agent `scout` (fast, read-only tools) or `reviewer` (deep review, read-only tools, structured verdict). The work order still says "change no file and make no commit". |
| Choose the model | `model` on the call takes one exact `provider/model-id`, optionally with `:level`, mapped from the role's first runnable candidate (**Candidates** below). Role aliases such as `@slow` are refused. It works only with `task.perCallModel: on` in the **user** config (the default is `off`; a project config can turn it off but never on), and OMP approves the model only when a user-level role names it (**Grants** below). Without a per-call model, the bundled agent runs on its own role (`task` on `@task`, `scout` on `@smol`, `reviewer` on `@slow`). |
| A separate checkout | Workers share the session's checkout. When the work needs its own, create a worktree, name it in the work order, and remove it after the push check. |
| Ask the user | The `ask` tool. |
| Open a todo list | The `todo` tool. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line; look again on the next step. |

## Models on offer

`omp models` lists the exact `provider/model-id` values this machine can run.

## Candidates

OMP runs a candidate when `omp models` lists a model for its channel (`via`, else the provider) with that id. For `roles.mjs show`, pass the channels `omp models` lists as `--channels`, named the way `roles.md` names them.

- **Selector:** `<OMP provider>/<model id>:<level>`. The OMP provider is the channel's: `antigravity` → `antigravity-cli`; the others keep their name (`anthropic`, `openai`, `google`, `cursor`). Take the exact id `omp models` lists.
- **Effort:** `effort=<level>` → `:<level>`.
- **Grants.** OMP accepts a per-call model only when a role in the **user** config names it (verified: any key under `modelRoles` grants, project config never does), and only with `task.perCallModel: on` there. So smode's `setup` playbook (step 7), after asking, adds to `~/.omp/agent/config.yml` one key per runnable candidate, named for this project so it never overwrites another project's: `smode-<repository name>-<role>-<n>: <selector>`. It replaces only this project's `smode-<repository name>-*` keys, leaves every other key alone, and sets `perCallModel: on` under `task:`. Rerun it after `roles.md` changes.

## Migration

Before `docs/agents/roles.md`, smode's roles were the plain keys `scout`, `worker`, `thinker`, `reviewer`, `coordinator` under `modelRoles` in the user config. Convert each `<OMP provider>/<model>:<level>` back: `antigravity-cli` and `cursor` become `via` unless they are the model's maker (the maker comes from the model id as `harness/t3.md` says under **Migration**), and `:<level>` becomes `effort=<level>`. After the project's file is committed, offer to remove the plain keys; nothing reads them any more.
