# smode on Codex

Read this once per session when the agent is Codex (the CLI, the app, or the Codex provider inside T3 Code), then map each smode action with the tables below. This doc keeps only what has been run; Codex chooses no model per worker here.

## Finding skills

| smode step | Codex |
|---|---|
| 1. Skill already loaded | A skill Codex lists for the session: invoke it by name (`$tdd`). Skills with `policy.allow_implicit_invocation: false` in `agents/openai.yaml` are not started implicitly; read their file instead. |
| 3. Skill locations | In order: `.agents/skills/<skill>/` from the working directory up to the repository root, then `~/.agents/skills/<skill>/`. |

`npx skills add` with `-a codex` copies or links every skill, with its `agents/openai.yaml`, into `.agents/skills/` (or `~/.agents/skills/` with `-g`), side by side, so step 2 finds them (verified).

## Actions

| smode action | Codex |
|---|---|
| Spawn a worker | `spawn_agent` with the work order, then wait for it. Codex does not spawn workers on its own: say so explicitly. |
| Spawn a read-only worker | `spawn_agent` with "change no file and make no commit" in the work order, and a `git status` check afterwards. A custom agent's `sandbox_mode = "read-only"` is not relied on. |
| Choose the model | Not supported: every worker runs on the session's model. Say so in the reply, once per task. |
| A separate checkout | Create a worktree, name it in the work order, remove it after the push check. |
| Ask the user | Ask in the reply and end the turn. |
| Open a todo list | Codex's plan tool when the session has it; otherwise keep the list in the reply. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line, or use `harness/t3.md` when inside T3. |

## Candidates

Codex runs no candidate of `docs/agents/roles.md`: every role runs on the session's model, and a `reviewer` is a fresh worker of the same family. For `roles.mjs show`, pass `--channels none`.
