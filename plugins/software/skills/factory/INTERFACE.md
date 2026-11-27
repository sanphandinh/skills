# Agent-manager interface

The factory needs the operations below from an agent manager. Each file in `references/` maps them to one manager's commands and lists that manager's traps. A reference is ready when the setup smoke test passes every operation on it.

## Vocabulary

- **Session**: one agent conversation the manager runs, on one model. A session gets **turns**: each turn starts with a message or an event, and ends when the session stops to wait.
- **Dispatcher**: a session started fresh for one run, at the project's main checkout. It claims tickets, wakes and revives coordinators, and tidies up; it never reads code.
- **Coordinator**: the session of one claimed ticket, from its claim to its Close, in that ticket's workspace. It decides, delegates and records; workers read and write code.
- **Workspace**: one checkout, a git worktree on the ticket's branch. The manager creates it when it launches the coordinator, runs the repository's setup hooks before the coordinator's first turn, and removes it only on close-workspace or by its own cleanup. The coordinator and every worker of the ticket share it.
- **Worker**: a child session of a coordinator, in the coordinator's workspace, doing one step of one ticket under one **work order** (its self-contained instructions). Its name is `<ticket> <step>`, the step being `plan`, `build`, `verify` or `review`.
- **Event**: what starts a coordinator's turn without a message: a worker reports `done`, `failed` or a `question`; a watched pull request changes (checks failed or passed, a conflict, merged, closed). There is no waiting call: the turn is the event.
- **Result**: the JSON file a worker writes, at the path its work order names, before it reports `done` or `failed`.

## Operations

| Operation | Input | Output and guarantees |
|---|---|---|
| launch-coordinator | ticket, title `factory #<number> <slug>`, branch name, base ref (or an existing workspace), model (one candidate of the `coordinator` route), first message | a new session in a new workspace on that branch, with setup hooks finished before its first turn and permission to run commands without asking; its turns raise no notification for people; returns the session id and the workspace path |
| launch-dispatcher | model (one candidate of the `scout` route), message | a new session at the main checkout; returns its id at once. The watcher, `once` and `resume` call it, each after taking the dispatcher lock |
| start-worker | worker name, work order, model (one candidate of the step's route) | a worker id; the worker runs the work order in a fresh session on exactly that model, in the calling coordinator's workspace; its report is an event of that coordinator |
| send | session id (a worker or a coordinator), text | the text reaches the session; an idle session starts a turn with it, a working one reads it at its next checkpoint |
| inspect | session id, or none | the session's state (`working`, `idle`, `done`, `failed`, `stopped`), its last output (including the provider's error text when it failed), and for a coordinator its live workers; with none, the providers and models that can take work now |
| link-pr | session, pull request | the session shows the pull request as its own |
| watch-pr | session, pull request | the pull request's changes (checks failed, required checks passed, a conflict, merged, closed) become events of that session, until unwatch-pr |
| unwatch-pr | session, pull request | no more events from it |
| settle | session | the session is marked finished; its workspace may now go to the manager's cleanup |
| archive | session | the session leaves the list people look at |
| list-workspaces | none | every workspace with its path, its branch and the session it was created for |
| close-workspace | workspace | the workspace is removed, after the push check below passed |
| revive | a dead coordinator's ticket, its workspace (or, when that is gone, its branch) | a new coordinator session in that workspace, or in a new one on that branch; the new session can read the old session's workers and stop them |
| schedule-wakes | interval, prompt | on each interval the manager starts a fresh session with the prompt (the **watcher**); cancelling the schedule stops it |
| flag-human | session, one-line reason | the session shows as waiting for a person, on the desktop and on the phone; clearing it removes the mark and makes the session quiet again |
| stop-worker | worker id | the worker's session ends; whatever it pushed stays |

## Rules every reference keeps

- **Done means reported.** A worker is `done` or `failed` only when it reports so through the manager. A heartbeat, a progress line, an idle terminal or a written file is not completion.
- **Blocked is found by looking.** A worker that stopped working without reporting (idle at a prompt, waiting on a permission, a turn that ended without a report) sends no event. On every turn, the coordinator inspects its live workers; each such worker is `blocked`.
- **Questions carry options.** A `question` event holds the worker's question and its options; the answer goes back through the manager's reply or `send`.
- **Workers belong to their coordinator.** Only the session that started a worker receives its events. Another session may read a worker and stop it only through revive.
- **One dispatcher at a time, one coordinator per ticket.** The manager does not enforce either: the dispatcher lock and the claim in the memory folder do. A coordinator whose claim names another session stops at once.
- **Push check before close.** In the workspace, `git status --porcelain` prints nothing, and after `git fetch origin`, `git log origin/<branch>..HEAD` prints nothing (for a branch never pushed, `git log origin/<trunk>..HEAD`). When the pull request is merged or closed, its head is the reference instead, so a deleted remote branch still passes: `git fetch origin refs/pull/<number>/head`, then `git log FETCH_HEAD..HEAD` prints nothing. Otherwise keep the workspace and say what is unpushed.
- **The model is the one asked for.** launch-coordinator, launch-dispatcher and start-worker run on the model they were given or fail; they never fall back on their own, because routing and quota are the factory's.
