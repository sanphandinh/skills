# smode on Cursor

Read this once per session when the agent is Cursor (the app, `cursor-agent`, or the Cursor provider inside T3 Code), then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18 through T3 Code: the `Task` schema, the sub-agent types `generalPurpose` and `explore`, that `Task` refuses a model slug outside the session's `<available_subagent_models>`, and that skills marked `disable-model-invocation` are not listed. Rows marked **docs** come from cursor.com/docs and have not been run here yet.

## Finding skills

| smode step | Cursor |
|---|---|
| 1. Skill already loaded | A skill in the session's list: the agent reads its `SKILL.md`. A skill with `disable-model-invocation: true` is not listed (measured); go to the next step for it. |
| 3. Skill locations | **Docs.** In order: `.cursor/skills/<skill>/`, `.agents/skills/<skill>/`, `.claude/skills/<skill>/` and `.codex/skills/<skill>/` in the project (nested folders too), then the same under `~/`, then the skills of installed plugins. |

Read a skill's `SKILL.md` with the file tool and follow it.

## Actions

| smode action | Cursor |
|---|---|
| Start a skill's sub-agent | `Task` with `description`, `prompt` and `subagent_type`: `generalPurpose` for work that writes or runs commands, `explore` for reading and searching only. Omit `model`: the sub-agent runs on the session's model, and the tool itself says to keep it unless the user asked for another listed model. A sub-agent that must stay read-only is told "change no file and make no commit", with a `git status` check afterwards. |
| A separate checkout for a skill's sub-agent | Create a worktree with git, name it in the prompt, and remove it after the push check. |
| Ask the user | Cursor's question tool when the session has one (**docs**). Through T3 it has none (measured): ask in the reply and end the turn. |
| Open a todo list | Cursor's todo tool when the session has one; otherwise keep the list in the reply. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line. |
