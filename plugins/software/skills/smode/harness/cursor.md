# smode on Cursor

Read this once per session when the agent is Cursor (the app, `cursor-agent`, or the Cursor provider inside T3 Code), then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18 through T3 Code: the `Task` schema, the sub-agent types `generalPurpose` and `explore`, that `Task` refuses a model slug outside the session's `<available_subagent_models>`, and that skills marked `disable-model-invocation` are not listed. 2026-11-19 on `cursor-agent` 2026.11.19 with plugins loaded by `--plugin-dir`: smode starts on its own from the plugin, reads this doc, runs a playbook named in its arguments, finds the other skills, and keeps its todo list with the todo tool; the `Task`, `TodoWrite` and `AskQuestion` schemas below. Rows marked **docs** come from cursor.com/docs and have not been run here yet.

## Finding skills

Find a skill in this order and use the first copy whose folder is named `<skill>` and holds a `SKILL.md` with `name: <skill>`:

| Order | Cursor |
|---|---|
| 1. Already loaded | A skill in the session's list: read its `SKILL.md`. A skill with `disable-model-invocation: true` is not listed (measured); go to step 2. |
| 2. Next to this skill | `<skill>/SKILL.md` in the folder that holds this skill's folder (sibling skills in a skills folder or in one plugin). |
| 3. Skill locations | **Docs.** In order: `.cursor/skills/<skill>/`, `.agents/skills/<skill>/`, `.claude/skills/<skill>/` and `.codex/skills/<skill>/` in the project (nested folders too), then the same under `~/`, then the skills of installed plugins (`~/.cursor/plugins/`) and of each `--plugin-dir` folder (measured). |
| 4. Up from this skill | Nearest ancestor folder holding `<any folder>/skills/<skill>/SKILL.md` (a checkout of a multi-plugin repository). |

Read a skill's `SKILL.md` with the file tool and follow it.

In `cursor-agent`, `Task` and `TodoWrite` are dynamic tools of the `cursor` namespace: load one with `GetDynamicTools` (`toolName`), then call it with `CallDynamicTool` (`namespace: "cursor"`, `toolName`, `arguments`) (measured). A tool missing from the session's list may be there; look it up before skipping its step.

## Actions

| smode action | Cursor |
|---|---|
| Start a skill's sub-agent | `Task` with `description`, `prompt` and `subagent_type` (`run_in_background` to run it while you work): `generalPurpose` for work that writes or runs commands, `explore` for reading and searching only. Omit `model`: the sub-agent runs on the session's model, and the tool itself says to keep it unless the user asked for another listed model. A sub-agent that must stay read-only is told "change no file and make no commit", with a `git status` check afterwards. |
| A separate checkout for a skill's sub-agent | Create a worktree with git, name it in the prompt, and remove it after the push check. |
| Ask the user | `AskQuestion` with a `title` and `questions`, each an `id`, a `prompt` and `options` (`id`, `label`), and `allow_multiple` when several fit (measured in `cursor-agent`). Through T3 it has none (measured): ask in the reply and end the turn. |
| Open a todo list | `TodoWrite` with `todos` (each `id`, `content`, `status`: `pending`, `in_progress`, `completed` or `cancelled`) and `merge` (measured in `cursor-agent`); without it, keep the list in the reply. |
