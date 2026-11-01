# Memory

GitHub holds the truth about the work: tickets, pull requests, checks, comments. The agent manager holds the workers in flight. The memory folder holds what neither does: the journal, the lessons, and every worker's result. It lives outside the repository, at the `Memory:` folder of `docs/agents/factory.md`, and you are its only writer.

## Layout

- `index.md`: the status line (`Status: running` or `Status: paused since <time>`), the identifiers the manager's reference asks to keep, the date of the last lint, and one line per wiki page: its name and what it holds.
- `journal.md`: one line per wake, newest last: `<time> | events: <…> | started: <…> | merged: <…> | waiting on people: <…>`.
- `wiki/<topic>.md`: lessons by topic, such as the build, the tests, CI, the verification environment, or one area of the code.
- `results/`: every worker's result, named by ticket, role and round.

The folder is a git repository (`git init` on setup). Commit once per wake, with the message `wake <time>`.

## Lessons

A lesson is a fact a later worker or wake would want, written as one dated entry with its source:

```markdown
- 2026-11-01: `npm test` needs Node 20 or newer; Node 18 fails on the test runner flags. Source: https://github.com/<owner>/<repo>/pull/12
```

- **Ingest**: after each result, add its `lessons`, and what you saw yourself (a trap, a flaky check, a person's answer that applies beyond one ticket), to the right page; start a page and list it in the index when none fits. Merge a lesson into an entry that already says the same thing.
- **Use**: before a work order, read the index and the pages that touch the ticket's area, and put the lessons that apply into the work order.
- **Check before trusting**: before relying on an entry about the code, open its source and confirm it still holds. When it no longer does, append a dated correction with the new source and mark the old entry `(superseded <date>)`; keep the old entry.
- **Lint**: on a timeout wake at least seven days after the last lint: merge duplicates, mark entries whose source is gone, keep each page to what a worker can read in a minute, and update the lint date in the index.
