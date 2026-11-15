# smode on Codex

Read this once per session when the agent is Codex (the CLI, the app, or the Codex provider inside T3 Code), then map each smode action with the tables below. Rows marked **unchecked** were written from Codex's documentation and have not been run on this machine yet; when one does not hold, fix this file.

## Finding skills

| smode step | Codex |
|---|---|
| 1. Skill already loaded | A skill Codex lists for the session: invoke it by name (`$tdd`). Skills with `policy.allow_implicit_invocation: false` in `agents/openai.yaml` are not started implicitly; read their file instead. |
| 3. Installed plugin | **Unchecked.** The plugin cache under the Codex home (`~/.codex`, or `CODEX_HOME`): find the folder of `<plugin>@sanphan-skills` and read `skills/<skill>/SKILL.md` in it. |
| 4. Marketplace clone | **Unchecked.** The marketplace clone Codex keeps for `sanphan-skills` under the Codex home: `plugins/<plugin>/skills/<skill>/SKILL.md`. |

## Actions

| smode action | Codex |
|---|---|
| Spawn a worker | `spawn_agent` with the work order, then wait for it. Codex does not spawn workers on its own: say so explicitly. |
| Spawn a read-only worker | `spawn_agent` with "change no file and make no commit" in the work order, and a `git status` check afterwards. A custom agent's `sandbox_mode = "read-only"` is not relied on. |
| Choose the model | **Unchecked.** A custom agent in `~/.codex/agents/<role>.toml` (or `.codex/agents/`) carries `model` and `model_reasoning_effort`; spawn the agent named after the role. Without one, the worker runs on the session's model: say so. |
| A separate checkout | Create a worktree, name it in the work order, remove it after the push check. |
| Ask the user | Ask in the reply and end the turn. |
| Open a todo list | Codex's plan tool when the session has it; otherwise keep the list in the reply. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line, or use `harness/t3.md` when inside T3. |

## Role configuration

**Unchecked.** One custom agent per smode role in `~/.codex/agents/`, `<role>.toml`, with `name`, `description`, `developer_instructions` ("Run the work order you are given."), `model` and `model_reasoning_effort`. The Setup playbook writes them. A missing agent means the session's model.
