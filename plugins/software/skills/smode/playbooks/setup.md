# Setup

Prepare this project and this machine for smode: the project's agent docs, and the role → model configuration of each harness you use here. Running it again is safe: every step looks before it writes, and the role configuration is rewritten whole.

1. When `docs/agents/issue-tracker.md` is missing, run the `setup-software-context` skill. When `docs/agents/verify.md` is missing, run the `setup-verification` skill. Both are the project's; skip them on a machine-only setup.
2. Read the harness doc for this session's harness and find out which models it can run, the way that doc says. Never write a model you have not seen offered.
3. Propose one model per role, from those models, and show the table to the user. A role that already has a value in the configuration (another skill may share the name, as factory v1 shares `reviewer`) keeps it in the proposal, marked as kept:
   - `scout`: the cheapest fast model;
   - `worker`: a reliable coding model;
   - `thinker`: the strongest reasoning model;
   - `reviewer`: strong reasoning, and **a different model family from `worker`** when the harness offers one; say so when it does not;
   - `coordinator`: a steady, cheap model.

   On a manager that runs several providers, each role is a route: two or three candidates in order, on different providers where possible, so a provider out of quota has a fallback.
4. Ask the user to accept the table or change roles. Change only what they name.
5. Write the configuration where the harness doc says, in its format. Read the current file first. Keep every line that is not a smode role, replace the smode roles, and keep a copy of the previous file next to it with a `.bak` suffix.
6. Prove it: on a harness that loads the file into new sessions, read it back the way a new session would; on a harness that spawns workers with a per-call model, spawn one `scout` worker on the configured model and compare the model it reports.

**Reply:** the table as written, the file and its backup, the proof from step 6 (measured), and what to run to undo it.
