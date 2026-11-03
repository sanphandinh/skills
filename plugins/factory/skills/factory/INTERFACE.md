# Agent-manager interface

The factory needs ten operations from an agent manager. Each file in `references/` maps them to one manager's commands and lists that manager's traps. A reference is ready when the setup smoke test passes every operation on it.

## Vocabulary

- **Workspace**: one checkout, a git worktree on its own branch, for one ticket. Only the manager creates and removes workspaces.
- **Worker**: one fresh agent session in a workspace, doing one step of one ticket under one **work order** (its self-contained instructions). Its name is `<ticket> <role>`.
- **Event**: what the manager reports about workers. Every event is one of `done`, `failed`, `question`, `blocked`, `message` or `timeout`.
- **Result**: the JSON file a worker writes, at the path its work order names, before it reports `done` or `failed`.

## Operations

| Operation | Input | Output and guarantees |
|---|---|---|
| open-workspace | ticket, branch name, base branch | a workspace on that branch, with the repository's setup hooks run |
| start-worker | workspace, worker name, work order, model role | a worker id; the worker runs the work order in a fresh session on the model the role resolves to |
| wait-events | timeout | the next events, or `timeout`; waiting costs no tokens |
| send | worker id, text | the text reaches the worker at its next checkpoint, and wakes it when it is idle |
| inspect | worker id, or none for every worker | each worker's state (`working`, `idle`, `done`, `failed`, `stopped`), its last output, and its result path |
| flag-human | workspace, one-line reason | the workspace shows as waiting for a person, on the desktop and on the phone; clearing it removes the mark |
| stop-worker | worker id | the worker's session ends; whatever it pushed stays |
| close-workspace | workspace | the workspace is removed, after the push check below passed |
| resume | none | a new coordinator session receives the events of every live worker |
| schedule-wakes | coordinator session, interval, prompt | every interval, the prompt arrives in the coordinator's session as a person's message would, starting a wake even after the coordinator ended its turn; cancelling it stops the wakes |

## Rules every reference keeps

- **Done means reported.** A worker is `done` or `failed` only when it reports so through the manager. A heartbeat, a progress line, an idle terminal or a written file is not completion.
- **Blocked is found by looking.** A worker that stopped working without reporting (idle at a prompt, waiting on a permission, a turn that ended without a report) never sends an event. On every wake, inspect all live workers; each such worker is `blocked`.
- **Questions carry options.** A `question` event holds the worker's question and its options; the answer goes back through the manager's reply or `send`.
- **Push check before close.** In the workspace, `git status --porcelain` prints nothing, and after `git fetch origin`, `git log origin/<branch>..HEAD` prints nothing, where `<branch>` is the ticket's branch on the remote (for a branch never pushed, `git log origin/<trunk>..HEAD` instead). Otherwise keep the workspace and say what is unpushed.
- **Acknowledge after handling.** When the manager batches events with an acknowledgment, handle every event of the batch first, then acknowledge.
- **One coordinator per repository.** A second coordinator on the same repository takes events away from the first.
