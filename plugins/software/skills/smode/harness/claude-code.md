# smode on Claude Code

Read this once per session when the agent is Claude Code (the CLI, the desktop app, or the Claude provider inside T3 Code), then map each smode action with the tables below. Never pass a field or value the tool schema rejects; drop it and say so.

## Finding skills

| smode step | Claude Code |
|---|---|
| 1. Skill already loaded | The `Skill` tool, under the name the session lists: `software:tdd` from a plugin, `tdd` from a skills folder. It refuses skills marked `disable-model-invocation`; go to the next step for those. |
| 3. Skill locations | In order: `.claude/skills/<skill>/` from the working directory up to the repository root; `~/.claude/skills/<skill>/`; then the installed plugins in `~/.claude/plugins/installed_plugins.json`, whose `plugins` maps each `<plugin>@<marketplace>` (any marketplace) to installs with `scope`, `installPath` and, for `scope: "project"`, `projectPath`. Installs for this project come before `user` ones. A plugin may be installed but disabled in this project's `.claude/settings.json`; its files are still there to read. Get the path with `python3 -c 'import json,os,sys; s=sys.argv[1]; d=json.load(open(os.path.expanduser("~/.claude/plugins/installed_plugins.json")))["plugins"]; c=os.getcwd(); a=[i for v in d.values() for i in v]; a=[i for i in a if i.get("projectPath")==c]+[i for i in a if i.get("scope")=="user"]; p=[os.path.join(i["installPath"],"skills",s,"SKILL.md") for i in a]; print(next((x for x in p if os.path.exists(x)),""))' <skill>`. |

`npx skills add` with `-a claude-code` copies or links every skill into `.claude/skills/` (or `~/.claude/skills/` with `-g`), side by side, so step 2 finds them (verified). Plugins keep each `<version>` apart (`software` 0.9.0 beside `core` 0.5.0), so never build another plugin's path from this skill's own path: run the one-liner (a real run read `core/0.9.0`, which does not exist, and had to search). A plugin loaded with `--plugin-dir`, or from a marketplace added from a local folder, runs straight from that folder, which is not in the install record; step 4 finds the other plugins' skills there (verified).

Read a skill's `SKILL.md` with the `Read` tool and follow it.

## Actions

| smode action | Claude Code |
|---|---|
| Spawn a worker | The `Agent` tool, `subagent_type: "general-purpose"`, the work order as `prompt`. Background is the default; wait for the notification instead of polling. |
| Spawn a read-only worker | `subagent_type: "Explore"` for reading and searching only: it may be refused the shell. A worker that must run commands read-only (the `verify` and `review` playbooks) is `general-purpose`, with "change no file and make no commit" in its work order and a `git status` check afterwards. |
| Choose the model | `model` takes only `opus`, `sonnet`, `haiku`, `fable`: map the role's first runnable candidate as **Candidates** says (`anthropic/claude-opus-5-5 effort=high` is `model: "opus"`, `effort: "high"`). With no runnable candidate, omit `model` and say so. |
| A separate checkout | `isolation: "worktree"`. Name the branch or commit the worker starts from in the work order. |
| Ask the user | `AskUserQuestion`. In print mode (`-p`) it is absent: ask in plain text and end the turn. |
| Open a todo list | `TodoWrite` when the session has it; otherwise keep the list in the reply and update it at each step. |
| Schedule or loop | The `loop` or `schedule` skills of Claude Code when the user asked for them; otherwise skip with the line. |
| Watch a pull request | No native watch: skip with the line, or use `harness/t3.md` when inside T3. |

## Models on offer

The `Agent` tool's `model` values (`opus`, `sonnet`, `haiku`, `fable`) with the effort levels its schema lists; a candidate names the full model id behind the alias (`anthropic/claude-opus-5-5`).

## Candidates

Claude Code runs the candidates whose channel is `anthropic` (`via` absent, provider `anthropic`) and skips every other one. For `roles.mjs show`, pass `--channels anthropic`.

- **Model:** the `Agent` tool takes an alias, so map the model id to it: `claude-opus-*` → `opus`, `claude-sonnet-*` → `sonnet`, `claude-haiku-*` → `haiku`, `claude-fable-*` → `fable`. Which version an alias runs is Claude Code's setting (`ANTHROPIC_DEFAULT_OPUS_MODEL` and the like); when it differs from the candidate's version, say so in the reply.
- **Effort:** `effort=<level>` → the tool's `effort`, when its schema lists that level.
- A role whose candidates are all skipped runs on the session's model: say so.

## Migration

Before `docs/agents/roles.md`, the roles lived in `~/.claude/rules/smode-roles.md`, which Claude Code loads into every new session of every project. Its plain lines `<role>: <alias> <effort>` become `anthropic/<model id the alias runs> effort=<effort>`; its `route <role>: …` lines are T3 candidates, converted as `harness/t3.md` says under **Migration**. After the project's file is committed, offer to delete the old one (smode's `setup` playbook, step 8); until then it keeps steering sessions everywhere.
