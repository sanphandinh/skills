# Setup

Prepare this project for smode: its agent docs, and `docs/agents/roles.md`, the model each role runs on in this project (ADR-0004). The file is committed with the project, so it holds every candidate the team may use; a harness skips the candidates it cannot run. Running it again is safe: every step looks before it writes. With `override` in the task (`setup override`), it changes only the roles the user picks.

1. When `docs/agents/issue-tracker.md` is missing, run the `setup-software-context` skill. When `docs/agents/verify.md` is missing, run the `setup-verification` skill.
2. Read what is there. When `docs/agents/roles.md` exists, check it with `node <this skill's folder>/scripts/roles.mjs check` and show the user `show`'s table. Without `override`, keep it as it is: report it, go to step 7 for any harness sync it still needs, and stop. When it is missing, look in the old places each harness doc lists under **Migration** and convert what you find to candidates, as that section says.
3. With `override`, list every role with its current line and ask which ones to change; the default is to keep each one. Propose only for the roles picked; leave the others byte for byte.
4. Find out which models this harness can run, the way its doc says. Never propose a model you have not seen offered. Propose a route per role, two or three candidates in order on different providers where possible, so a provider out of quota has a fallback:
   - `scout`: the cheapest fast model;
   - `worker`: a reliable coding model;
   - `thinker`: the strongest reasoning model;
   - `reviewer`: strong reasoning, and **a different model family from `worker`** when one is offered; say so when it is not;
   - `coordinator`: a steady, cheap model.

   A role whose value came from an old place (step 2) is proposed as it was, marked as migrated.
5. Ask the user to accept the table or change roles. Change only what they name.
6. Write `docs/agents/roles.md` from `roles-template.md` next to this skill's `SKILL.md` (its explanation, then one line per role). Run `roles.mjs check` and fix every error. Show the diff, then commit it on trunk on its own: "Configure smode roles", or "Override smode roles: <roles>" with `override`. A project that runs the factory drops any `Routes:` line from `docs/agents/factory.md` in the same commit; the factory reads this file now.
7. Do what the harness doc's **Candidates** section asks for this harness beyond reading the file (Oh My Pi needs its user config to grant the models; Codex reads generated agent files). Ask before you write anything outside the repository.
8. When step 2 migrated from an old place, ask whether to delete that old file now; delete it only on a yes. A file there that a harness loads into every session (the harness doc says which) keeps steering sessions in every project until it is gone.
9. Prove it: spawn one `scout` worker with the role's first candidate this harness can run, and compare the model it reports.

**Reply:** `roles.mjs show`'s table as committed, the commit, what was written outside the repository and what was deleted, the proof from step 9 (measured), and how to undo it (`git revert` of the commit).
