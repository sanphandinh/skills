# Setup

Prepare one project for the factory, then prove the setup with a smoke test against the real agent manager. Run it from the project's main checkout, in a terminal of the agent manager. Running it again is safe: every step looks before it writes.

## 1. Check the documents the factory reads

- `docs/agents/issue-tracker.md` with its `## Factory` section and `Tracker:` line, `docs/agents/triage-labels.md`, and `docs/agents/merge-policy.md`: written by the `setup-software-context` skill.
- `docs/agents/response-language.md`: written by the same skill. When it is missing, do not stop. Wakes use `match-user` with no live user message (the language of the ticket or spec when it has prose, else the latest human comment, else English) and the journal notes the gap. Tell the user they can add the file by re-running `setup-software-context`.
- `docs/agents/verify.md`: written by the `setup-verification` skill.

Stop at the first missing file in the first and third bullets and tell the user which skill writes it. A missing `response-language.md` does not stop setup.

Then check the version: when `docs/agents/factory.md` exists, read its `Manager:` and `Memory:` lines and look up version 1's wake schedule for this repository with that manager (the `factory` skill's reference for it says how, under schedule-wakes). When a schedule exists and is enabled, stop and tell the user to stop version 1 first ("stop" to its coordinator). A memory index that says `Status: running` with no schedule behind it is a leftover: say so and go on. One repository runs one version.

Then check smode: the `smode` skill is reachable on this machine (smode's **Running a skill by name**), and its role configuration has a route for `thinker`, `worker` and `reviewer`. Without one, run smode's `setup` playbook first.

## 2. Pick the agent manager

Each file in `references/` is one supported manager. Recommend the one whose own check answers (each reference's **Before the first wake** says how) and confirm it with the user.

## 3. Write `docs/agents/factory-v2.md`

Fill the template and show it to the user before writing:

- **Coordinator**: the provider and model this session runs on; the coordinator stays on it.
- **Trunk**: the branch pull requests merge into.
- **Required checks**: the CI checks a pull request must pass, by name. Read them from the latest merged pull request (`gh pr checks <number>`) or the job names in the CI configuration, and confirm them with the user; `none` when pull requests get no CI.
- **Trunk checks**: the CI checks whose failure on trunk stops merging, by name. Read them from trunk's latest commits (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs`); usually the same as the required checks, but some CI runs only on trunk (an archive or deploy build). `none` when trunk gets no CI.
- **Scarce resources**: ask whether checking a change needs something only some workers can use at once (a simulator, a device, a GPU, a port). Write each as `<resource>: <how many at once>, held by <roles>`, or `none`. For each one, `docs/agents/verify.md` must say how to bring it to a clean state and how to stop a command left hanging on it (a stuck runner, a leftover process); a verifier follows both. When it does not, show the user what is missing and suggest adding it with the `setup-verification` skill before the first run.
- **Memory**: a folder outside the repository; default `~/.local/share/factory-v2/<repository name>`.
- **Routes**: where the coordinator's smode role configuration lives (the smode harness doc for the coordinator's harness names the file). The routes themselves stay there, not in this file, because they are per machine.

```markdown
# Factory

Settings for the `factory-v2` skill. The coordinator rereads this file on every wake, so a change applies on the next wake. Merge rules live in `merge-policy.md`.

Factory: v2
Manager: <reference name>
Coordinator: <provider>/<model>
Trunk: main
Max workers: 3
Scarce resources: none
Fix rounds: 2
Required checks: test
Trunk checks: test
Wake timeout: 15 minutes
Memory: ~/.local/share/factory-v2/<repository name>
Routes: <path of the coordinator's smode role file>
```

Commit it on trunk as "Configure the software factory v2" and push.

## 4. Prepare

- Create the memory folder as [MEMORY.md](MEMORY.md) lays it out (`index.md` with `Status: running` and `Factory: v2`, `journal.md`, `wiki/`, `results/`, `providers.md`, `quota.md`) and `git init` it.
- When version 1's memory folder exists, offer to copy its `wiki/` pages in, keeping their dates and sources.
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
8. **Providers**: for every candidate of every route, start one worker in a throwaway workspace on that candidate with this work order, then write one line to `providers.md` per candidate:

   > Factory provider check. Your checkout is the git checkout the manager gave you: run every command there, never inside a folder this order names by absolute path. 1. Say the provider and model you run on. 2. Read `<smode>/SKILL.md` and quote its `name:` line. 3. Write `{"model": …, "name_line": …, "pwd": …}` to `<memory>/results/provider-<provider>-<model>.json`. 4. Ask your coordinator "alpha or beta?" with those two options; when you have no way to ask, write `"asks": false` into the same file and go on. 5. Run `git push --dry-run origin HEAD:refs/heads/factory/provider-check` and put its exit code in the file. 6. Run `git status --short` and put its output in the file. 7. Report completion through the manager. Change no file in the repository.

   - PASS when the file exists with the quote, `pwd` is inside the workspace, the dry run exits 0 and `git status` is empty. `asks` and whether the worker needed the shell for step 2 or 3 go into the line as facts, not as a failure.
   - A FAIL keeps that candidate out of every route until the check is rerun and passes. Close the throwaway workspaces with the push check.

End with the table of results. Setup is done when every line is `PASS`; for a `FAIL`, say what to fix and run the failed check again after the fix.
