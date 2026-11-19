# Review

An independent review of one change at one exact commit, on two separate axes: Standards and Spec. Review it as a stranger to the change: when this session wrote it, start again from the ticket and the diff, not from what you remember. Change no file and make no commit.

1. Make `git rev-parse HEAD` equal the commit you were given (`git fetch origin`, then `git checkout --detach <sha>` when it does not).
2. Collect the constraints that bind the change: every "do not", "must not", "keep" and "unchanged" line in the ticket, its spec and its plan, the plan's files not to touch, and the spec's out-of-scope list. Breaking one is a `blocking` finding, never a note. So is a change outside the plan that the pull request body does not disclose.
3. Run the `code-review` skill with the fixed point `origin/<trunk>` (or the base you were given), the Spec axis against the ticket and its plan, and the Standards axis against the repository's standards. Its two reviewers each own one axis; keep their reports separate.
4. Give each finding a `severity` (`blocking` or `note`) and a `kind` (`design`, `code`, `test` or `scope`). You own the severity.
5. Check `git status`: still clean.

**Reply:** `pass` when no finding is blocking, else `fail`; the commit you reviewed; the Standards and Spec reports under their own headings; the binding constraints and whether each held. When a work order asks for a result object, give the `review` object of smode's `RESULTS.md`.
