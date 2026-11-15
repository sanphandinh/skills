# smode on Claude Code

Read this once per session when the agent is Claude Code (the CLI, the desktop app, or the Claude provider inside T3 Code), then map each smode action with the tables below. Never pass a field or value the tool schema rejects; drop it and say so.

## Finding skills

| smode step | Claude Code |
|---|---|
| 1. Skill already loaded | The `Skill` tool, with the plugin prefix: `software:tdd`, `core:grilling`. It refuses skills marked `disable-model-invocation`; go to the next step for those. |
| 3. Installed plugin | `~/.claude/plugins/installed_plugins.json`, `plugins["<plugin>@sanphan-skills"]`: a list of installs, each with `scope`, `installPath` (`~/.claude/plugins/cache/sanphan-skills/<plugin>/<version>`) and, for `scope: "project"`, `projectPath`. Take the install whose `projectPath` is this project, else the `user` one. The plugin may be installed but disabled in this project's `.claude/settings.json`; its files are still there to read. Get the path with `python3 -c 'import json,os,sys; d=json.load(open(os.path.expanduser("~/.claude/plugins/installed_plugins.json")))["plugins"].get(sys.argv[1]+"@sanphan-skills",[]); c=os.getcwd(); m=[i for i in d if i.get("projectPath")==c] or [i for i in d if i.get("scope")=="user"]; print(m[0]["installPath"] if m else "")' <plugin>`. |
| 4. Marketplace clone | `installLocation` of `sanphan-skills` in `~/.claude/plugins/known_marketplaces.json`: a clone of the repository under `~/.claude/plugins/marketplaces/` for a GitHub marketplace, or the source folder itself for a local one. Read `plugins/<plugin>/skills/<skill>/SKILL.md` there, only when step 3 found nothing. |

Read a skill's `SKILL.md` with the `Read` tool and follow it.

## Actions

| smode action | Claude Code |
|---|---|
| Spawn a worker | The `Agent` tool, `subagent_type: "general-purpose"`, the work order as `prompt`. Background is the default; wait for the notification instead of polling. |
| Spawn a read-only worker | `subagent_type: "Explore"` for reading and searching only: it may be refused the shell. A worker that must run commands read-only (the `verify` and `review` playbooks) is `general-purpose`, with "change no file and make no commit" in its work order and a `git status` check afterwards. |
| Choose the model | `model` takes only `opus`, `sonnet`, `haiku`, `fable`. A role value `opus high` is `model: "opus"` and `effort: "high"`. A non-Claude model cannot run here: omit `model` and say so. |
| A separate checkout | `isolation: "worktree"`. Name the branch or commit the worker starts from in the work order. |
| Ask the user | `AskUserQuestion`. In print mode (`-p`) it is absent: ask in plain text and end the turn. |
| Open a todo list | `TodoWrite` when the session has it; otherwise keep the list in the reply and update it at each step. |
| Schedule or loop | The `loop` or `schedule` skills of Claude Code when the user asked for them; otherwise skip with the line. |
| Watch a pull request | No native watch: skip with the line, or use `harness/t3.md` when inside T3. |

## Models on offer

The `Agent` tool's `model` values (`opus`, `sonnet`, `haiku`, `fable`) with the effort levels its schema lists. Write a role as `<model> <effort>`.

## Role configuration

`~/.claude/rules/smode-roles.md`, written by the `setup` playbook. Claude Code loads every file in `~/.claude/rules/` into each new session, so the role lines are already in context; if they are not, read the file. The file holds only smode's roles, one line each: `<role>: <model> <effort>`, such as `thinker: opus high`, under a first line `# smode roles (written by the smode setup playbook)`. A missing file or line means the session's model.
