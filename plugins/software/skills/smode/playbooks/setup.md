# Setup

Prepare this project for smode: the agent docs its playbooks read. smode chooses no model and keeps no roles; the model per role is the factory's (`factory setup`). Running it again is safe: every step looks before it writes. With `override` in the task (`setup override`), each skill below changes only the parts the user picks.

1. When `docs/agents/issue-tracker.md` is missing, or with `override`, run the `setup-software-context` skill (with `override` when given). It also writes the project's `### Entry point` rule into `AGENTS.md`.
2. When `docs/agents/verify.md` is missing, or with `override`, run the `setup-verification` skill the same way.
3. When the harness doc lists an old smode file under **Migration** and it exists, say what it still does and ask whether to delete it; delete it only on a yes. A file the harness loads into every session keeps steering sessions in every project until it is gone.
4. When the project runs the factory (`docs/agents/factory.md` exists), the model each of its workers runs on is the factory's setting: for a change there, suggest `factory setup override`.

**Reply:** which docs were written or kept, what was deleted outside the repository, and how to undo it (`git revert` of each commit).
