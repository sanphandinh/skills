# smode on OpenCode

Read this once per session when the agent is OpenCode, then map each smode action with the tables below. Never pass a field the tool schema rejects; drop it and say so.

**Verified** 2026-11-18: the tool list and the `task` and `skill` schemas, read from the OpenCode 1.15.13 and 1.19.6 binaries (`opencode agent list` shows `general` and `explore`); on 1.19.6, `opencode debug skill` lists the skills `npx skills add` put in `.agents/skills/`. 2026-11-19 on 1.19.6 with a free model: smode starts on its own through the `skill` tool, reads this doc, runs a playbook named in its arguments, finds the other skills in `.agents/skills/`, and starts a skill's sub-agents with `task` on `explore`, passing no model. Rows marked **docs** come from opencode.ai/docs.

## Finding skills

Find a skill in this order and use the first copy whose folder is named `<skill>` and holds a `SKILL.md` with `name: <skill>`:

| Order | OpenCode |
|---|---|
| 1. Already loaded | The `skill` tool with `name`, the skill's name as `available_skills` lists it (measured). A skill with `disable-model-invocation: true` is not listed (**docs**); go to step 2. |
| 2. Next to this skill | `<skill>/SKILL.md` in the folder that holds this skill's folder (sibling skills in a skills folder or in one plugin). |
| 3. Skill locations | In order: `.opencode/skills/<skill>/`, `.claude/skills/<skill>/` and `.agents/skills/<skill>/` (measured) from the working directory up to the git worktree root; then `~/.config/opencode/skills/`, `~/.claude/skills/` and `~/.agents/skills/` (measured); then every path in the `skills` array of `opencode.json` (**docs**). `opencode debug skill` prints every skill found and its location. |
| 4. Up from this skill | Nearest ancestor folder holding `<any folder>/skills/<skill>/SKILL.md` (a checkout of a multi-plugin repository). |

`npx skills add` with `-a opencode` puts every skill side by side in `.agents/skills/`, so step 2 finds them. Read a skill's `SKILL.md` with the `read` tool and follow it.

## Actions

| smode action | OpenCode |
|---|---|
| Start a skill's sub-agent | The `task` tool with `description`, `prompt` and `subagent_type` (1.19.6 adds `background`): `general` for work that runs commands or writes, `explore` for reading and searching only. It has no model parameter: the sub-agent runs on its agent's model, the session's unless the project defines otherwise. A sub-agent that must stay read-only is told "change no file and make no commit", with a `git status` check afterwards. |
| A separate checkout for a skill's sub-agent | Create a worktree with git, name it in the prompt, and remove it after the push check. |
| Ask the user | The `question` tool. |
| Open a todo list | The `todowrite` tool. |
