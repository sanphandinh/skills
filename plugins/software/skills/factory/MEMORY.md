# Memory

The tracker and the git host hold the truth about the work: tickets, pull requests, checks, comments. The agent manager holds the sessions in flight. The memory folder holds what neither does: who claimed which ticket, who holds which resource, when each ticket is next due, the journal, the lessons, and every worker's result. The folder is on this machine, outside the repository; the repository keeps only its path, on the `Memory:` line of `docs/agents/factory.md` (default `~/.local/share/factory/<repository name>`).

Many sessions write here at once: one dispatcher at a time, and one coordinator per claimed ticket. So every shared file has one writer, or is written only through `scripts/resources.mjs`, which takes one lock (`state.lock`) for every write. Its header lists the commands; this file says what they mean.

## Layout and writers

| Path | What it holds | Written by |
|---|---|---|
| `index.md` | the identifiers the manager's reference asks to keep, the date of the last lint, one line per wiki page | the dispatcher (setup writes it first) |
| `journal.md` | one line per dispatcher run, newest last: `<time> \| claimed: … \| woke: … \| revived: … \| merged: … \| waiting on people: …` | the dispatcher |
| `wiki/<topic>.md` | lessons by topic (the build, the tests, CI, the verification environment, one area of the code) | the dispatcher |
| `tickets/<n>.md` | the ticket's story for a person to read back: one dated line per step, event and decision | the ticket's coordinator |
| `results/` | every worker's result, `<n>-<step>-<round>.json`, and a coordinator's own lessons, `<n>-coordinator-<k>.json`; a file is never changed after it is written | the worker, or the coordinator |
| `evidence/<n>/` | what a verifier saved (screenshots, logs); deleted at Close or by the sweep | the ticket's verifier |
| `state/tickets/<n>.json` | the ticket's **record**, which is also its claim | `resources.mjs` only |
| `state/status.json` | `running` or `paused` | `resources.mjs` only |
| `state/dispatcher.json` | the dispatcher lock and the dispatcher's own due | `resources.mjs` only |
| `state/lessons.json` | the results already ingested | `resources.mjs` only |
| `resources/<name>.json` | each resource's holders and queue | `resources.mjs` only |
| `quota.md` | one line per blocked candidate: `<candidate> \| blocked until <time> \| since <time> \| <ticket> <step> \| <the error's words>` | `resources.mjs` only |
| `providers.md` | one line per candidate the setup smoke test checked: `<candidate> \| asks: yes or no \| files: tool or shell \| result: PASS or FAIL <date>`; routing uses only `PASS` lines | setup |
| `wake-fingerprint` | the board as the last dispatcher run saw it | the dispatcher |

The record holds `claimed` and `claimedAt`; the coordinator's `thread`, `worktree`, `branch` and `pr`; the live `tasks` (task and session ids, step); `reworkRounds` and `conflictRounds`; the plan's `files_to_change` and `planCleared`; the `state` (`running`, `parked` with `parkedOn`, `waiting` with `waitingOn`, `held`, `closed_unmerged`); the `due`; and the comment ids already handled (`acked`). Read a ticket's record with `ticket get <n>`, change it with `ticket set`, and never edit the file by hand. `<n>` is the ticket's number, or on a tracker without numbers its key (letters, digits, `.`, `_`, `-`).

The folder is a git repository (`git init` on setup). Only the dispatcher commits, once per run, with the message `dispatch <time>`. Its `.gitignore` keeps out what changes under the lock and what can be rebuilt:

```
resources/
state/
evidence/
*.lock
*.tmp
wake-fingerprint
```

Every `<time>` is read from the clock when you write it (`date -u +%FT%RZ`), in UTC; never estimate or count it from earlier lines. An acceptance run that estimated wrote 01:10Z for a wake at 00:09Z, and the journal went out of order.

A `<candidate>` is the candidate's id as `docs/agents/roles.md` writes it, without `effort`: `<provider>/<model>`, then ` via=<channel>` when it has one (`google/gemini-4-hydrogen via=antigravity`). It never uses a manager's own ids, so `roles.mjs show` can match these files to the routes. Lines written before roles moved to `docs/agents/roles.md`, with a manager's ids, are converted the way smode's harness doc for that manager says under **Migration**.

## Claims

A ticket is **claimed** while its record says `claimed: true`; the record is the only claim, and the `## Factory claim` comment on the ticket is only history for people. `claim <n>` refuses a ticket already claimed, so two dispatchers never both win. `unclaim <n>` releases the claim, every resource the ticket holds or queues for, and its `planCleared`.

## Due

A ticket is **due** when its coordinator should get a turn although nothing woke it. The `due` follows the `state`: setting `running` sets it to now plus `Wake timeout` (or to the time given, such as the end of a quota block); `held`, `waiting`, `parked` and `closed_unmerged` clear it, so a ticket that waits on a person, another ticket or a resource makes no wake of its own.

`due` lists five sources: a running ticket past its due; a quota block past its time; the dispatcher's own due (`dispatcher-due set`, for trunk CI still running or not reported); a holding past its time; and the head of a resource queue that could take what is free now and was not told, or was told more than 5 minutes ago and has not taken it. `due --check` exits 0 when anything is due, 1 when nothing is: the watcher's test.

## Resources

The resources are `slot` (as many as `Max workers`), each of `Scarce resources`, and `merge` (one). A ticket asks for them in one order, `slot`, then the scarce resources by name, then `merge`; `acquire` refuses any other order, so no two tickets ever wait on each other.

- **Acquire** grants a resource when the ticket is at the head of its queue (or the queue is empty) and enough is free; otherwise the ticket joins the queue and is **parked** on it. The queue is first in, first out, and its head blocks it: a ticket asking for 2 slots is never overtaken by one asking for 1.
- **Release** returns the resource, or takes the ticket out of its queue (a parked coordinator that goes on hold or reworks instead), and names the head of that queue when it can now take it and nobody told it yet. Whoever released sends that coordinator a message, then runs `notified <ticket> <resource>`. A head nobody told becomes due, which is the net under a releaser that stopped in between. A ticket waits in one queue at a time, and asks for more of a resource it holds only after releasing it.
- **Renew** extends every holding of a ticket to now plus `Wake timeout`. A coordinator renews on each turn; the dispatcher renews for every live coordinator, parked ones included.
- **Reclaim** releases everything a ticket holds or queues for and drops its tasks from the record. It runs only when the dispatcher or a revive found the holder's session dead or failed: the clock never reclaims. A holding past its time only makes the dispatcher due, so a dead holder is found; a parked holder that is alive is renewed, however long it waits.

## Lessons

A lesson is a fact a later worker or ticket would want, written as one dated entry with its source:

```markdown
- 2026-11-01: `npm test` needs Node 20 or newer; Node 18 fails on the test runner flags. Source: https://github.com/<owner>/<repo>/pull/12
```

- **Ingest** (the dispatcher): `lessons pending` lists the results not yet read; add each one's `lessons` to the right page, starting a page and listing it in the index when none fits, merge a lesson into an entry that already says the same thing, then `lessons done <files>`. A coordinator that saw a lesson itself (a trap, a flaky check, a person's answer that applies beyond one ticket) writes it as a new result file, `<n>-coordinator-<k>.json` with a `lessons` list, for the next ingest.
- **Use** (the coordinator): before a work order, read the index and the pages that touch the ticket's area, and put the lessons that apply into the work order.
- **Check before trusting**: before relying on an entry about the code, open its source and confirm it still holds. When it no longer does, the dispatcher appends a dated correction with the new source and marks the old entry `(superseded <date>)`; keep the old entry.
- **Lint** (the dispatcher): on a run with nothing else to do, when the last lint in the index is at least seven days old: merge duplicates, mark entries whose source is gone, keep each page to what a worker can read in a minute, and update the lint date in the index.
