# Setup

Prepare one project for the factory, then prove the setup with a smoke test against the real agent manager. Run it from the project's main checkout, in a terminal of the agent manager. Running it again is safe: every step looks before it writes.

## 1. Check the documents the factory reads

- `docs/agents/issue-tracker.md` with its `## Factory` section and `Tracker:` line, `docs/agents/triage-labels.md`, and `docs/agents/merge-policy.md`: written by the `setup-software-context` skill.
- `docs/agents/verify.md`: written by the `setup-verification` skill.

Stop at the first one missing and tell the user which skill writes it.

## 2. Pick the agent manager

Each file in `references/` is one supported manager. Recommend the one whose command-line tool answers (for Orca, `orca --version`) and confirm it with the user.

## 3. Write `docs/agents/factory.md`

Fill the template and show it to the user before writing:

- **Agent**: the agent command-line tool the manager starts for workers; recommend the one this session runs in.
- **Trunk**: the branch pull requests merge into.
- **Required checks**: the CI checks a pull request must pass, by name. Read them from the latest merged pull request (`gh pr checks <number>`) or the job names in the CI configuration, and confirm them with the user; `none` when pull requests get no CI.
- **Trunk checks**: the CI checks whose failure on trunk stops merging, by name. Read them from trunk's latest commits (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs`); usually the same as the required checks, but some CI runs only on trunk (an archive or deploy build). `none` when trunk gets no CI.
- **Scarce resources**: ask whether checking a change needs something only some workers can use at once (a simulator, a device, a GPU, a port). Write each as `<resource>: <how many at once>, held by <roles>`, or `none`.
- **Memory**: a folder outside the repository; default `~/.local/share/factory/<repository name>`.

```markdown
# Factory

Settings for the `factory` skill. The coordinator rereads this file on every wake, so a change applies on the next wake. Merge rules live in `merge-policy.md`.

Manager: orca
Agent: omp
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

- Create the memory folder as [MEMORY.md](MEMORY.md) lays it out (`index.md` with `Status: running`, `journal.md`, `wiki/`, `results/`) and `git init` it.
- Follow the reference's **Before the first wake** section, and write the identifiers it asks to keep into `index.md`.
- On a GitHub tracker, create the labels the factory uses: `gh label create <name> --force` for `factory:hold`, `priority:p1`, `priority:p2` and `priority:p3`.

## 5. Smoke test

Prove every interface operation on the real manager with a throwaway workspace. Run each command the reference gives for the operation. Report one line per check: the operation, `PASS` or `FAIL`, and the evidence (ids, states, file contents).

1. **open-workspace**: workspace `factory-smoke` on a new branch `factory/smoke` from trunk.
2. **start-worker**, **wait-events**, **send** and **inspect**: start worker `smoke worker` in it with this work order, on the model role the reference names for workers:

   > Factory smoke test. 1. List by name the agents you can delegate to in this session, and the model this session runs on. 2. Ask your coordinator one question through the manager: "alpha or beta?", with those two options, and wait for the answer. 3. Run `sleep 60`. 4. Read your coordinator's follow-ups. 5. Write a JSON object with the keys `agents`, `model`, `answer` and `followups` to `<memory>/results/smoke.json`. 6. Report completion through the manager with that path. Change no file in the repository.

   - Wait for events. The `question` event comes first: answer `beta`.
   - While it sleeps, inspect it (`working`), and send it "Record the word gamma."
   - Wait for its `done` and read its result.
   - PASS when the answer is `beta`, the follow-ups hold `gamma`, the model matches what the manager reports for the worker, and the agents include `planner`, `implementer`, `verifier`, `review-spec` and `review-standards`. Missing agents mean the plugins that ship them are not reachable from a new workspace: install those plugins at user scope and repeat this check. An agent file with the same name in the user's own agents folder (for Oh My Pi, `~/.omp/agent/agents/`) takes precedence over the plugin's, so an old copy there must be moved aside.
3. **flag-human**: flag the workspace with "factory smoke test"; confirm through the manager that it shows as waiting for a person; clear it.
4. **resume**: start worker `smoke sleeper` told to run `sleep 600`, then report. Run the reference's resume test while it sleeps.
5. **stop-worker**: stop `smoke sleeper`; inspect it: `stopped`.
6. **close-workspace**: commit a scratch file in the workspace without pushing; the push check must refuse to close it. Drop the commit (`git reset --hard <trunk>` in the workspace), run the push check again, close the workspace, and delete the `factory/smoke` branch.
7. **schedule-wakes**: schedule wakes for this session every minute with the prompt `factory smoke wake: reply with the word pong and nothing else`, end your turn, and let a person confirm the prompt arrived and was answered after your turn ended; then cancel the schedule. (Setup asks the person to watch; `run` schedules the real wakes.)

End with the table of results. Setup is done when every line is `PASS`; for a `FAIL`, say what to fix and run the failed check again after the fix.
