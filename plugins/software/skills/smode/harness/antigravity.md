# smode on Antigravity

Read this once per session when the agent is Google Antigravity (the app, the IDE, the `agy` CLI, or the Antigravity provider inside T3 Code), then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18 through T3 Code: the built-in `research` and `self` sub-agents, the skill folders the session searched (`.agents/skills` and `.gemini/skills` in the workspace), and that `Model` `flash` and `pro` failed there (`PlatformClient is nil`). 2026-11-19 on the `agy` CLI 1.5.11: smode starts on its own from `.agents/skills/` and from a plugin installed with `agy plugin install` (`~/.gemini/config/plugins/<plugin>/`), finds the other skills, and runs a skill's sub-agents on `research`. 2026-11-24 through T3 Code: top-level `invoke_subagent` schema (`TypeName`, `Role`, `Prompt`, `Model`, `Workspace` with `"share"` and `"branch"`), plus `ask_question`. Rows marked **docs** come from antigravity.google/docs and have not been run here yet.

## Finding skills

Find a skill in this order and use the first copy whose folder is named `<skill>` and holds a `SKILL.md` with `name: <skill>`:

| Order | Antigravity |
|---|---|
| 1. Already loaded | A skill in the session's list: read its `SKILL.md` (measured). A skill with `disable-model-invocation: true` is not listed; go to step 2. |
| 2. Next to this skill | `<skill>/SKILL.md` in the folder that holds this skill's folder (sibling skills in a skills folder or in one plugin). |
| 3. Skill locations | In order: `.agents/skills/<skill>/` and `.gemini/skills/<skill>/` in the workspace (measured), `.agents/skills/` in each parent folder up to the repository root, then `~/.gemini/config/skills/<skill>/` (**docs**), and the `skills/` folder of each plugin in `~/.gemini/config/plugins/` (measured) or `.agents/plugins/` (**docs**). `agy plugin list` names the installed plugins. |
| 4. Up from this skill | Nearest ancestor folder holding `<any folder>/skills/<skill>/SKILL.md` (a checkout of a multi-plugin repository). |

Read a skill's `SKILL.md` with the file tool, or with the shell when the file tool refuses a path outside the workspace (measured through T3), and follow it.

## Actions

| smode action | Antigravity |
|---|---|
| Start a skill's sub-agent | `invoke_subagent` with `TypeName` (`research` for reading and searching only — read-only, no network — or `self` for work that writes or runs commands), a `Role` of two to five words, `Prompt`, and `Model: "inherit"`. Keep `inherit` unless the user asks for another tier (other tiers failed through T3). |
| A separate checkout for a skill's sub-agent | `Workspace: "share"` (preferred: shares repo storage like a git worktree) or `Workspace: "branch"` (isolated clone). |
| Ask the user | `ask_question` with `questions`, each a `question` and its `options` (no numbers and no "Other": the UI adds both), and `is_multi_select` when several fit. Without the tool, ask in the reply and end the turn. |
| Open a todo list | Keep the list in the reply and update it at each step. |
