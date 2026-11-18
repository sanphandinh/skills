# smode on OpenCode

Read this once per session when the agent is OpenCode, then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18: the tool list and the `task` and `skill` schemas, read from the OpenCode 1.15.13 binary (`opencode agent list` shows `general` and `explore`). Rows marked **docs** come from opencode.ai/docs and have not been run here yet.

## Finding skills

| smode step | OpenCode |
|---|---|
| 1. Skill already loaded | The `skill` tool with `name`, the skill's name as `available_skills` lists it. A skill with `disable-model-invocation: true` is not listed (**docs**); go to the next step for it. |
| 3. Skill locations | **Docs.** In order: `.opencode/skills/<skill>/`, `.claude/skills/<skill>/` and `.agents/skills/<skill>/` from the working directory up to the git worktree root; then `~/.config/opencode/skills/`, `~/.claude/skills/` and `~/.agents/skills/`; then every path in the `skills` array of `opencode.json`. |

`npx skills add` with `-a opencode` puts every skill side by side in `.agents/skills/`, so step 2 finds them. Read a skill's `SKILL.md` with the `read` tool and follow it.

## Actions

| smode action | OpenCode |
|---|---|
| Start a skill's sub-agent | The `task` tool with `description`, `prompt` and `subagent_type`: `general` for work that runs commands or writes, `explore` for reading and searching only. It has no model parameter: the sub-agent runs on its agent's model, the session's unless the project defines otherwise. A sub-agent that must stay read-only is told "change no file and make no commit", with a `git status` check afterwards. |
| A separate checkout for a skill's sub-agent | Create a worktree with git, name it in the prompt, and remove it after the push check. |
| Ask the user | The `question` tool. |
| Open a todo list | The `todowrite` tool. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line. |
