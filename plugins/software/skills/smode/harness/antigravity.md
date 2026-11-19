# smode on Antigravity

Read this once per session when the agent is Google Antigravity (the app, the IDE, the `agy` CLI, or the Antigravity provider inside T3 Code), then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18 through T3 Code: the `invoke_subagent` and `define_subagent` schemas, the built-in `research` and `self` sub-agents, the skill folders the session searched (`.agents/skills` and `.gemini/skills` in the workspace), and that `Model` `flash` and `pro` fail there (`PlatformClient is nil`). 2026-11-19 on the `agy` CLI 1.5.11: smode starts on its own from `.agents/skills/` and from a plugin installed with `agy plugin install` (`~/.gemini/config/plugins/<plugin>/`), finds the other skills, and runs a skill's sub-agents on `research`; the `invoke_subagent`, `ask_question` and `schedule` schemas below. Rows marked **docs** come from antigravity.google/docs and have not been run here yet.

## Finding skills

| smode step | Antigravity |
|---|---|
| 1. Skill already loaded | A skill in the session's list: the agent reads its `SKILL.md` (measured). A skill with `disable-model-invocation: true` is not listed; go to the next step for it. |
| 3. Skill locations | In order: `.agents/skills/<skill>/` and `.gemini/skills/<skill>/` in the workspace (measured), `.agents/skills/` in each parent folder up to the repository root, then `~/.gemini/config/skills/<skill>/` (**docs**), and the `skills/` folder of each plugin in `~/.gemini/config/plugins/` (measured) or `.agents/plugins/` (**docs**). `agy plugin list` names the installed plugins. |

Read a skill's `SKILL.md` with the file tool, or with the shell when the file tool refuses a path outside the workspace (measured through T3), and follow it.

## Actions

| smode action | Antigravity |
|---|---|
| Start a skill's sub-agent | `invoke_subagent` with `TypeName` `research` for reading and searching only (read-only, no network) or `self` for work that writes or runs commands, a `Role` of two to five words, the `Prompt`, and `Model: "inherit"`. The tool itself says to keep `inherit` unless the user asks for another tier, and other tiers failed through T3. The `agy` CLI takes these fields at the top level; through T3 they sat in one entry of `Subagents`, with `toolSummary` and `toolAction` beside it. Fill the fields your schema has. |
| A separate checkout for a skill's sub-agent | `Workspace: "branch"`. |
| Ask the user | `ask_question` with `questions`, each a `question` and its `options` (no numbers and no "Other": the UI adds both), and `is_multi_select` when several fit. Without it (through T3 none was seen), ask in the reply and end the turn. |
| Open a todo list | Keep the list in the reply and update it at each step. |
| Schedule or loop | When the user asked for it: `schedule` with the `Prompt` to wake on, and `DurationSeconds` for one timer or `CronExpression` for a recurring one. Without the tool, skip with the line. |
| Watch a pull request | Skip with the line. |
