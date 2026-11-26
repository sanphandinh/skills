# smode on Claude Code

Read this once per session when the agent is Claude Code (the CLI, the desktop app, or the Claude provider inside T3 Code), then map each smode action with the tables below. Never pass a field or value the tool schema rejects; drop it and say so.

**Verified** 2026-11-18 on Claude Code 2.1.326: smode starts on its own with the project's Entry point rule; the `Skill` tool refuses `disable-model-invocation` skills; skills installed by `npx skills add` and by `--plugin-dir` are found as below.

## Finding skills

Find a skill in this order and use the first copy whose folder is named `<skill>` and holds a `SKILL.md` with `name: <skill>`:

| Order | Claude Code |
|---|---|
| 1. Already loaded | The `Skill` tool, under the name the session lists: `software:tdd` from a plugin, `tdd` from a skills folder. It refuses skills marked `disable-model-invocation`; go to step 2 for those. |
| 2. Next to this skill | `<skill>/SKILL.md` in the folder that holds this skill's folder (sibling skills in a skills folder or in one plugin). |
| 3. Skill locations | In order: `.claude/skills/<skill>/` from the working directory up to the repository root; `~/.claude/skills/<skill>/`; then the installed plugins in `~/.claude/plugins/installed_plugins.json`, whose `plugins` maps each `<plugin>@<marketplace>` (any marketplace) to installs with `scope`, `installPath` and, for `scope: "project"`, `projectPath`. Installs for this project come before `user` ones. A plugin may be installed but disabled in this project's `.claude/settings.json`; its files are still there to read. Get the path with `python3 -c 'import json,os,sys; s=sys.argv[1]; d=json.load(open(os.path.expanduser("~/.claude/plugins/installed_plugins.json")))["plugins"]; c=os.getcwd(); a=[i for v in d.values() for i in v]; a=[i for i in a if i.get("projectPath")==c]+[i for i in a if i.get("scope")=="user"]; p=[os.path.join(i["installPath"],"skills",s,"SKILL.md") for i in a]; print(next((x for x in p if os.path.exists(x)),""))' <skill>`. |
| 4. Up from this skill | Nearest ancestor folder holding `<any folder>/skills/<skill>/SKILL.md` (a checkout of a multi-plugin repository). |

`npx skills add` with `-a claude-code` copies or links every skill into `.claude/skills/` (or `~/.claude/skills/` with `-g`), side by side, so step 2 finds them (verified). Plugins keep each `<version>` apart (`software` 0.9.0 beside `core` 0.5.0), so never build another plugin's path from this skill's own path: run the one-liner (a real run read `core/0.9.0`, which does not exist, and had to search). A plugin loaded with `--plugin-dir`, or from a marketplace added from a local folder, runs straight from that folder, which is not in the install record; step 4 finds the other plugins' skills there (verified).

Read a skill's `SKILL.md` with the `Read` tool and follow it.

## Actions

| smode action | Claude Code |
|---|---|
| Start a skill's sub-agent | The `Agent` tool, `subagent_type: "general-purpose"`, or `"Explore"` for reading and searching only (it may be refused the shell). Pass no `model` and no `effort`: the sub-agent runs on the session's model. Background is the default; wait for the notification instead of polling. A read-only sub-agent that must run commands is `general-purpose`, told "change no file and make no commit", with a `git status` check afterwards. |
| A separate checkout for a skill's sub-agent | `isolation: "worktree"`. Name the branch or commit it starts from. |
| Ask the user | `AskUserQuestion`. In print mode (`-p`) it is absent: ask in plain text and end the turn. |
| Open a todo list | `TodoWrite` when the session has it; otherwise keep the list in the reply and update it at each step. |

## Migration

`~/.claude/rules/smode-roles.md` held smode's roles before they became the factory's. Claude Code loads every file in `~/.claude/rules/` into each new session of every project, so it still steers sessions until it is deleted; smode no longer reads it. `factory setup` converts its routes for a project that runs the factory.
