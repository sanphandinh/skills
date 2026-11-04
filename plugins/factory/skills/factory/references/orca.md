# Orca

Verified on Orca 1.4.244 (macOS) with Oh My Pi workers. Orca ships a guide matched to its version; read it when a command here fails or a case is not covered: `orca skills get orchestration`, and its files with `--reference references/<file>.md`. Use the same `orca` executable for the whole run, and `--json` on every call.

## Before the first wake

- The coordinator runs inside an Orca terminal: the `ORCA_TERMINAL_HANDLE` environment variable is set.
- The repository is registered: `orca repo list --json` lists it; otherwise `orca repo add --path <main checkout> --json`. Keep its `id` as `<repoId>`.
- The factory works inside one Orca **Run** per repository. Find its id in the memory folder (`orca-run` in the index). With none, create it with `orca orchestration run-create --objective "factory: <owner>/<repo>" --json` and record `result.run.id`; with one, take it with resume.

## Operations

| Operation | Orca |
|---|---|
| open-workspace | `git fetch origin` in the main checkout, then `orca worktree create --repo id:<repoId> --name <ticket>-<slug> --branch <branch> --base-branch origin/<trunk> --no-parent --setup run --issue <ticket number> --json`. On an existing pull request's branch, use `--branch <its branch> --base-branch origin/<its branch>` (add `--pr <number>` to link it). Keep `result.worktree.id` (`<repoId>::<path>`, the selector is `id:` plus it), `result.worktree.path`, and `result.worktree.branch`: when the main checkout already has a branch by that name, the local branch gets a numeric suffix, so workers push with `HEAD:<branch>`. |
| start-worker | `orca orchestration worker-start --spec "<work order>" --worktree id:<worktreeId> --agent <Agent> --model @<role> --task-title "<worker name>" --json`. Keep `result.dispatchId` (the worker id) and `result.taskId`. Then name the worker's terminal (the `result.effects` entry with `kind` `terminal` and `role` `agent`): `orca terminal set-pane-title --terminal <handle> --title "<worker name>" --json`; the agent repaints its tab title, the pane title stays. |
| wait-events | `orca orchestration check --wait --types "worker_done,escalation,question" --timeout-ms <wake timeout in ms> --json` |
| send | `orca orchestration send --to dispatch:<dispatchId> --subject "Follow-up" --body "<text>" --json`. Answer a question with `orca orchestration reply --id <message id> --body "<answer>" --json`. |
| inspect | every worker: `orca orchestration worker-list --run <runId> --json`; one: `orca orchestration worker-show --dispatch <dispatchId> --json`, and its transcript tail with `orca orchestration worker-read --dispatch <dispatchId> --limit 50 --json` |
| flag-human | `orca worktree set --worktree id:<worktreeId> --workspace-status in-review --unread --comment "<reason>" --json`; clear the mark with `--read` |
| stop-worker | `orca orchestration worker-stop --dispatch <dispatchId> --json` |
| close-workspace | after the push check: `orca worktree rm --worktree id:<worktreeId> --json` |
| resume | `orca orchestration run-use --id <runId> --json`, then inspect every worker. Name each one by joining `worker-list` rows (`taskId`) to `orca orchestration task-list --run <runId> --json` (`id`, and `task_title`, the worker name). A live worker keeps its step: never start a second worker for it. |
| schedule-wakes | One automation per repository in the main checkout's workspace: `orca automations create --name "factory wake: <repo>" --trigger "*/<wake timeout in minutes> * * * *" --prompt "/skill:factory once" --provider <Agent> --workspace id:<main checkout worktree id> --workspace-mode existing --reuse-session --enabled --json`; record `result.automation.id` as `orca-wake` in the memory index. Look first (`orca automations list --json`) and keep the one that exists. The first run starts a fresh agent session in that workspace, on the agent's default model, and later runs reuse it; that session takes the Run (resume) and is the coordinator from then on. `--extra-agent-args` (a model) cannot be combined with `--reuse-session`. Cancel with `orca automations remove <id> --json`; check runs with `orca automations runs --id <id> --json`. A wake that arrives mid-turn waits as a queued message. |

**Model role.** `--model @<role>` takes an Oh My Pi model role, resolved by the machine's role mapping. Start workers on `@smol`: the worker session follows the work order and delegates the step to the role agent the work order names, and that agent runs on its own role's model. `result.launch.effective.model` echoes the role; the model it resolved to is the worker's `projection.provider.model` in `worker-list`.

## Events

`check --wait` prints a `{"_keepalive":true,...}` line every 15 seconds, then one result: read the last JSON object. Its `result.deliveryId` names the batch and `result.messages[]` holds the events, mapped by `type`:

- `worker_done`: `payload.outcome` `succeeded` is `done`, `failed` is `failed`. `payload.dispatchId` names the worker, `payload.reportPath` is its result, `body` is its three-sentence summary.
- `question`: `question`. `body` is the question, `payload.options` the choices; answer with `reply --id <message id>`.
- `escalation`: `blocked`, with the worker's reason in `subject` and `body`.
- anything else (`heartbeat`, `status`): `message`; it proves the worker is alive and nothing more.

`result.timedOut: true`, or no messages, is `timeout`. A batch carries every waiting message whatever its type, and repeats until acknowledged: after handling all of it, and releasing every finished worker, acknowledge with `orca orchestration check --ack <deliveryId> --json` (or pass `--ack <deliveryId>` on the next wait).

When mail arrives while you are not waiting, Orca types `You have N orchestration message(s). Run orca orchestration check --run <runId>.` into your terminal. It is a cue, not a wake: in `run` mode the next wait returns the same mail; in `once` mode leave it for the next wake the person asks for.

On a `timeout`, list every worker (`worker-list --run <runId>`). Two rows are `blocked`, both with `projection.outcome` `in_progress`:

- `projection.stage.activity` `blocked`: the worker waits at a prompt in its own terminal (a permission prompt, or a question dialog it opened instead of asking you). Read the prompt with `orca terminal read --terminal <agentTerminalHandle> --screen --json`. Cancel it with Escape (`orca terminal send --terminal <agentTerminalHandle> --text $'\x1b' --json`), `send` the worker the answer or the instruction, then nudge it: `orca terminal send --terminal <agentTerminalHandle> --text "Your coordinator sent you a message: read it with your Orca check command and continue." --enter --json`.
- `projection.stage.activity` `done`: the worker ended its turn without reporting. Read its transcript tail, then `send` it what it needs; `send` wakes an idle Oh My Pi worker.

`agentTerminalHandle` is on the same row. `projection.liveness.verdict` is `live`, `exited` or `unverifiable`; only `exited` proves the session is gone.

## After a worker finishes

Release its terminal once its `done` or `failed` is handled: `orca orchestration worker-release --dispatch <dispatchId> --json`. Release only settled workers; a stopped worker is settled.

## Visibility

- A new workspace starts with status `in-progress`. Set `--workspace-status in-review` while checks run or a person is needed, `completed` after the merge, and keep `--comment` on the current step in a few words. The status and the unread mark show in Orca's sidebar and in the Orca mobile app.
- Each worker's terminal opens in its workspace; `--task-title` names its task, and the pane title names its terminal (`terminals[].paneTitle` in `orca terminal list --json`).

## Resume test (setup smoke test)

1. Open a second terminal: `orca terminal create --worktree path:<main checkout> --title "factory resume test" --json`; keep its handle.
2. Run there: `orca terminal send --terminal <handle> --text "orca orchestration run-use --id <runId> --json > <file>; orca orchestration worker-list --run <runId> --json >> <file>" --enter --json`, with `<file>` in the memory folder's `results/`.
3. PASS when `<file>` shows the Run's `coordinator_handle` as the new terminal and lists the live worker as `live`.
4. Take the Run back from the coordinator's own terminal (`run-use --id <runId>`), close the test terminal (`orca terminal close --terminal <handle> --json`), and handle the replayed batch: it comes back under a new `deliveryId`, with events already handled; recognise them by `payload.dispatchId` and acknowledge.

## Traps

- `orca worktree rm` removes the checkout even when it holds unpushed commits; the branch stays in the main checkout only when it has commits of its own. The push check is the only guard.
- Orca's worker preamble tells workers not to post to GitHub or other channels during the run. Workers push their branch and write their result; the coordinator writes every comment, pull request, label and commit status.
- `--branch` with a name the main checkout already has creates a new local branch with a numeric suffix. `--pr <number>` only links the pull request to the workspace; it does not check out its branch. For a ticket whose pull request exists, base the workspace on `origin/<its branch>` (open-workspace row).
- Repository setup hooks run only when the workspace is created; a worker started in an existing workspace skips them.
- `worker-show`'s `observation.status` reports the terminal, not the agent: a live terminal can hold a stuck agent. `worker-list` is the authority.
- `run-use` from another terminal moves the Run's events there; run one coordinator per repository.
- `orca orchestration` finds the caller from the terminal's `ORCA_*` environment. Run it from the coordinator's own shell; a process without that environment (a script runner, a sandboxed kernel) fails with `no_active_sender_terminal` unless it passes `--from <coordinator terminal handle>` (and `check` passes `--terminal <handle>`).
- The main checkout's local trunk goes stale as the factory merges on GitHub. Base workspaces on `origin/<trunk>` after a fetch, never on the local branch.
