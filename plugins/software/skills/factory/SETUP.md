# Setup

Prepare one project for the factory, then prove the setup with a smoke test against the real agent manager. Run it from the project's main checkout, in a terminal of the agent manager. Running it again is safe: every step looks before it writes.

## Converting older settings

Do this first, in `setup` and in `setup override`, before reading any setting:

- **`docs/agents/factory-v2.md` exists** (written by the factory when it was called `factory-v2`): rename it to `docs/agents/factory.md` with `git mv`, drop its `Factory: v2` line and any `Routes:` line, and keep every other line as it is, `Memory:` included, so the journal, the wiki and the results carry on. In the memory index, drop the `Factory: v2` line. Commit on trunk as "Convert factory settings from factory-v2" and push.
- **`docs/agents/factory.md` has an `Agent:` line and no `Coordinator:` line** (the version 1 factory, which ran on Orca): it no longer runs. Tell the user, stop its Orca wakes if they still run (the user removes the automation in Orca), and propose a new file from section 3 that keeps `Trunk`, `Max workers`, `Scarce resources`, `Fix rounds`, `Required checks`, `Trunk checks`, `Wake timeout` and `Memory` as they are. Write it only on the user's yes; then go on with setup from section 2.

## Override

`setup override` changes settings of a project already set up, instead of setting it up again. Read `docs/agents/factory.md`, list every setting with its value, and ask which ones to change; the default is to keep each one. Propose a new value only for the settings picked, the way section 3 proposes it (reading CI for the checks, asking for scarce resources), and leave every other line byte for byte. A leftover `Routes:` line (from before `docs/agents/roles.md`) is dropped. Show the diff, then commit it on trunk on its own as "Override factory config: <settings>" and push. The coordinator rereads the file on its next wake. When `Manager:` or `Memory:` changed, run sections 4 and 5 again; otherwise stop here. The same override also lists the roles of `docs/agents/roles.md`: change only the roles picked, proposed as section 2 says, leave the other lines byte for byte, check the file, and commit it on its own as "Override factory roles: <roles>".

## 1. Check the documents the factory reads

First check smode: the `smode` skill is reachable on this machine (smode's **Running a skill by name**). Its playbooks are what every worker runs, and its `setup` playbook writes the documents below.

- `docs/agents/issue-tracker.md` with its `## Factory` section and `Tracker:` line, `docs/agents/triage-labels.md`, and `docs/agents/merge-policy.md`.
- `docs/agents/response-language.md`.
- `docs/agents/verify.md`.

When any of them is missing, or `issue-tracker.md` has no `## Factory` section, run smode's `setup` playbook (`<smode>/playbooks/setup.md`), then check again. Never write these documents here. Stop when a file of the first or third bullet is still missing, and name it. A missing `response-language.md` does not stop setup: wakes use `match-user` with no live user message (the language of the ticket or spec when it has prose, else the latest human comment, else English), the journal notes the gap, and the user can add the file with `smode setup override`.

## 2. Pick the agent manager

Each file in `references/` is one supported manager. Recommend the one whose own check answers (each reference's **Before the first wake** says how) and confirm it with the user.

Then the roles. Only the factory reads `docs/agents/roles.md`: the model each step's worker runs on.

- **The file exists:** check it with `node <this skill's folder>/scripts/roles.mjs check`, and show the user `show`'s table, with `--channels` from the reference's **Candidates**. Keep it as it is.
- **It is missing:** look for old roles the way the reference's **Migration** says, and convert what you find. Otherwise propose a route per role from the models the manager offers (the reference says how), two or three candidates in order on different providers where possible, so a provider out of quota has a fallback:
  - `scout`: the cheapest fast model (the watcher);
  - `worker`: a reliable coding model (`build`);
  - `thinker`: the strongest reasoning model (`plan`);
  - `reviewer`: strong reasoning, **another model family than `worker`** (`verify`, `review`); say so when none is offered;
  - `coordinator`: a steady, cheap model.

  Ask the user to accept the table or change roles, then write the file from [roles-template.md](roles-template.md) (its explanation, then one line per role), run `roles.mjs check` until it passes, show the diff, and commit it on trunk on its own as "Configure factory roles" and push.
- When an old file was converted, ask whether to delete it now; delete it only on a yes.

The routes must cover `thinker`, `worker` and `reviewer` before section 5's provider checks.

## 3. Write `docs/agents/factory.md`

Fill the template and show it to the user before writing:

- **Coordinator**: the model this session runs on, written as a candidate id the way `docs/agents/roles.md` writes it (`anthropic/claude-opus-5-5`); the coordinator stays on it.
- **Trunk**: the branch pull requests merge into.
- **Required checks**: the CI checks a pull request must pass, by name. Read them from the latest merged pull request (`gh pr checks <number>`) or the job names in the CI configuration, and confirm them with the user; `none` when pull requests get no CI.
- **Trunk checks**: the CI checks whose failure on trunk stops merging, by name. Read them from trunk's latest commits (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs`); usually the same as the required checks, but some CI runs only on trunk (an archive or deploy build). `none` when trunk gets no CI.
- **Scarce resources**: ask whether checking a change needs something only some workers can use at once (a simulator, a device, a GPU, a port). Write each as `<resource>: <how many at once>, held by <roles>`, or `none`. For each one, `docs/agents/verify.md` must say how to bring it to a clean state and how to stop a command left hanging on it (a stuck runner, a leftover process); a verifier follows both. When it does not, show the user what is missing and suggest adding it with the `setup-verification` skill before the first run.
- **Memory**: a folder outside the repository; default `~/.local/share/factory/<repository name>`.

```markdown
# Factory

Settings for the `factory` skill. The coordinator rereads this file on every wake, so a change applies on the next wake. Merge rules live in `merge-policy.md`.

Manager: <reference name>
Coordinator: <candidate id>
Trunk: main
Max workers: 3
Scarce resources: none
Fix rounds: 2
Required checks: test
Trunk checks: test
Wake timeout: 15 minutes
Memory: ~/.local/share/factory/<repository name>
```

Commit it on trunk as "Configure the software factory" and push.

## 4. Prepare

- Create the memory folder as [MEMORY.md](MEMORY.md) lays it out (`index.md` with `Status: running`, `journal.md`, `wiki/`, `results/`, `providers.md`, `quota.md`) and `git init` it.
- When the folder already exists, look before you write. A folder without `providers.md` and `quota.md` is a version 1 memory: its layout is a subset of this one, so add the two files and keep `journal.md`, `wiki/` and `results/` as they are; drop identifiers in `index.md` that belong to another manager (`orca-run`, `orca-wake`). Commit the folder as `upgrade <time>`.
- Follow the reference's **Before the first wake** section, and write the identifiers it asks to keep into `index.md`.
- On a GitHub tracker, create the labels the factory uses: `gh label create <name> --force` for `factory:hold`, `priority:p1`, `priority:p2` and `priority:p3`.

## 5. Smoke test

Prove every interface operation on the real manager with a throwaway workspace. Run each command the reference gives for the operation. Report one line per check: the operation, `PASS` or `FAIL`, and the evidence (ids, states, file contents).

1. **open-workspace**: workspace `factory-smoke` on a new branch `factory/smoke` from trunk.
2. **start-worker**, **wait-events**, **send** and **inspect**: start worker `smoke worker` in it with this work order, on the model role the reference names for workers:

   > Factory smoke test. 1. Say the model this session runs on. 2. Ask your coordinator one question through the manager: "alpha or beta?", with those two options, and wait for the answer. 3. Run `sleep 60`. 4. Read your coordinator's follow-ups. 5. Write a JSON object with the keys `model`, `answer` and `followups` to `<memory>/results/smoke.json`. 6. Report completion through the manager with that path. Change no file in the repository.

   - Wait for events. The `question` event comes first: answer `beta`.
   - While it sleeps, inspect it (`working`), and send it "Record the word gamma."
   - Wait for its `done` and read its result.
   - PASS when the answer is `beta`, the follow-ups hold `gamma`, and the model matches the one start-worker was given.
3. **flag-human**: flag the workspace with "factory smoke test"; confirm through the manager that it shows as waiting for a person; clear it.
4. **resume**: start worker `smoke sleeper` told to run `sleep 600`, then report. Run the reference's resume test while it sleeps.
5. **stop-worker**: stop `smoke sleeper`; inspect it: `stopped`.
6. **close-workspace**: commit a scratch file in the workspace without pushing; the push check must refuse to close it. Drop the commit (`git reset --hard <trunk>` in the workspace), run the push check again, close the workspace, and delete the `factory/smoke` branch.
7. **schedule-wakes**: schedule wakes for this session every minute with the prompt `factory smoke wake: reply with the word pong and nothing else`, end your turn, and let a person confirm the prompt arrived and was answered after your turn ended; then cancel the schedule. (Setup asks the person to watch; `run` schedules the real wakes the way the reference describes, with its quiet-wake check.)
8. **Providers**: for every candidate of every route in `docs/agents/roles.md` that the manager can run, start one worker in a throwaway workspace on that candidate with this work order, then write one line to `providers.md` per candidate:

   > Factory provider check. Your checkout is the git checkout the manager gave you: run every command there, never inside a folder this order names by absolute path. 1. Say the provider and model you run on. 2. Read `<smode>/SKILL.md` and quote its `name:` line. 3. Write `{"model": …, "name_line": …, "pwd": …}` to `<memory>/results/provider-<candidate>.json`. 4. Ask your coordinator "alpha or beta?" with those two options; when you have no way to ask, write `"asks": false` into the same file and go on. 5. Run `git push --dry-run origin HEAD:refs/heads/factory/provider-check` and put its exit code in the file. 6. Run `git status --short` and put its output in the file. 7. Report completion through the manager. Change no file in the repository.

   - `<candidate>` in the file name is the candidate's id with `/` and spaces written as `-` (`provider-google-gemini-4-hydrogen-via=antigravity.json`); its line in `providers.md` starts with the id as `roles.md` writes it, without `effort`.
   - PASS when the file exists with the quote, `pwd` is inside the workspace, the dry run exits 0 and `git status` is empty. `asks` and whether the worker needed the shell for step 2 or 3 go into the line as facts, not as a failure.
   - A FAIL keeps that candidate out of every route until the check is rerun and passes. Close the throwaway workspaces with the push check.

End with the table of results. Setup is done when every line is `PASS`; for a `FAIL`, say what to fix and run the failed check again after the fix.
