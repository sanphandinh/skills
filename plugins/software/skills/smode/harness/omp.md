# smode on Oh My Pi

Read this once per session when the agent is Oh My Pi (OMP), then map each smode action with the tables below.

## Finding skills

| smode step | OMP |
|---|---|
| 1. Skill already loaded | A skill in the session's skill list: load it the way OMP loads skills (`skill://<name>`). |
| 3. Installed plugin | `~/.omp/plugins/installed_plugins.json` (user scope) or `.omp/plugins/installed_plugins.json` (project scope): `plugins["<plugin>@sanphan-skills"][0].installPath`. Each plugin is its own folder, such as `~/.omp/plugins/cache/plugins/sanphan-skills___core___0.4.0/`, so a relative path from `software` never reaches `core`. |
| 4. Marketplace clone | `~/.omp/plugins/cache/marketplaces/sanphan-skills/` is a full clone of the repository: `plugins/<plugin>/skills/<skill>/SKILL.md`. |

Read a skill's `SKILL.md` with `read` and follow it.

## Actions

| smode action | OMP |
|---|---|
| Spawn a worker | The `task` tool with the bundled agent `task` (general purpose), the work order as its task. No agent definition is needed. |
| Spawn a read-only worker | The bundled agent `scout` (fast, read-only tools) or `reviewer` (deep review, read-only tools, structured verdict). The work order still says "change no file and make no commit". |
| Choose the model | `model` on the call takes one exact `provider/model-id`, optionally with `:level`. Role aliases such as `@slow` are refused. It works only with `task.perCallModel: on` in the **user** config (the default is `off`; a project config can turn it off but never on), and OMP approves the model only when a user-level role names it, so take it from there (Role configuration below). Without a per-call model, the bundled agent runs on its own role (`task` on `@task`, `scout` on `@smol`, `reviewer` on `@slow`). |
| A separate checkout | Workers share the session's checkout. When the work needs its own, create a worktree, name it in the work order, and remove it after the push check. |
| Ask the user | The `ask` tool. |
| Open a todo list | The `todo` tool. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line; look again on the next step. |

## Models on offer

`omp models` lists the exact `provider/model-id` values this machine can run.

## Role configuration

`modelRoles` in `~/.omp/agent/config.yml`, the user config. smode's roles (`scout`, `worker`, `thinker`, `reviewer`, `coordinator`) are keys there next to OMP's own roles, each with an exact `provider/model-id:level`; `templates/roles.omp-config.yml` in this repository shows the shape. Keep them in the user config, not in a project's `.omp/config.yml`: OMP grants per-call models only from user-level settings. The Setup playbook also sets `perCallModel: on` under `task:` in the same file, after asking the user: OMP then accepts a per-call model, still only one the configuration already routes to. A missing role, or `perCallModel` left `off`, means the bundled agent's own role.

OMP's rules from `software-omp` (the TDD guards) keep running in every worker; smode does not replace them.
