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
| Choose the model | **Unchecked.** Spawn the project's generated agent named after the role (**Candidates** below), which carries `model` and `model_reasoning_effort`. Without one, the worker runs on the session's model: say so. |
| A separate checkout | Create a worktree, name it in the work order, remove it after the push check. |
| Ask the user | Ask in the reply and end the turn. |
| Open a todo list | Codex's plan tool when the session has it; otherwise keep the list in the reply. |
| Schedule or loop | Skip with the line. |
| Watch a pull request | Skip with the line, or use `harness/t3.md` when inside T3. |

## Candidates

**Unchecked.** Codex runs the candidates whose channel is `openai`. For `roles.mjs show`, pass `--channels openai`.

- **Model and effort:** `model` is the model id; `effort=<level>` → `model_reasoning_effort`.
- **Generated agents.** Codex picks a worker's model through a custom agent, so smode's `setup` playbook (step 7) writes one per role in the project, `.codex/agents/<role>.toml`, from the role's first `openai` candidate: `name`, `description`, `developer_instructions` ("Run the work order you are given."), `model`, `model_reasoning_effort`, under a first line `# Generated from docs/agents/roles.md by smode's setup playbook; do not edit.` Spawn the agent named after the role. Rerun setup after `roles.md` changes; a role with no `openai` candidate gets no file and runs on the session's model.

## Migration

Before ADR-0004, the agents were `~/.codex/agents/<role>.toml` in the user's Codex home. Each becomes `openai/<model> effort=<model_reasoning_effort>`. After the project's file and its generated agents are committed, offer to delete the old ones.
