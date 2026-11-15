# Plan ticket

Plan exactly one ticket so that whoever builds it never has to invent a design decision. Change no file and make no commit. Use a `thinker` worker when you delegate it.

1. Read the ticket the way `docs/agents/issue-tracker.md` says, its spec, the handoff of every ticket that blocked it, `GLOSSARY.md`, the ADRs that touch the area, and the code on the base branch around the seams the ticket names.
2. Write the plan, one heading per part:
   - **Decisions**: every technical choice the ticket leaves open (where the logic lives, which seam owns it, data shapes, errors, what to reuse), each with its reason and the ADR or existing code it follows. Name the data shape first.
   - **Change map**: the files to change, each with what changes; then the files not to touch, each with why (another ticket's scope, a public contract, generated code). Name the sibling tickets whose files stay untouched.
   - **Interfaces**: the signature of every function, type, endpoint or event the ticket adds or changes.
   - **Tests**: for each acceptance criterion and each of its branches (normal case, edges, errors), the test to write first and where it lives.
   - **Verify**: the commands from `docs/agents/verify.md` that prove each criterion on the real product. Check the environment can reach each one today. When it needs a fixture, account, file, device state or service it lacks, add a question naming what to stage, with test-only coverage as one option.
   - **Door**: `one-way` when the change is hard to walk back (a data migration, a published API, a deletion, an outside side effect), else `two-way`, with the reason.
   - **Questions**: every product question the ticket leaves open (what users see or get, scope, wording, which behaviour wins), each with options and your recommendation. A part that depends on an open question says `open until question <n> is answered`, never a default to build with.
   - **Split**: when the ticket changes more than one user-facing flow or more than one seam's ownership, so one review round cannot hold it, propose smaller tickets in build order, each with its own acceptance criteria, as a question. Otherwise `none`.
3. Keep it reviewable in one sitting: decisions and lists, not prose.

**Reply:** the plan. When a work order asks for a result object, also give `plan` (the markdown), `door`, `files_to_change`, `files_not_to_touch` and `questions` (empty when none).
