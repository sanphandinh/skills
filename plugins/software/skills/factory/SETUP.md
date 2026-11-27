# Setup

Prepare one project for the factory, then prove the setup with a smoke test against the real agent manager. Run it from the project's main checkout, in a session of the agent manager. Running it again is safe: every step looks before it writes.

`res` below is `node <this skill's folder>/scripts/resources.mjs --root <main checkout>`.

## Converting older settings

Do this first, in `setup` and in `setup override`, before reading any setting:

- **`docs/agents/factory-v2.md` exists** (written by the factory when it was called `factory-v2`): rename it to `docs/agents/factory.md` with `git mv`, drop its `Factory: v2` line and any `Routes:` line, and keep every other line as it is, `Memory:` included, so the journal, the wiki and the results carry on. In the memory index, drop the `Factory: v2` line. Commit on trunk as "Convert factory settings from factory-v2" and push. Then go on with the next bullet.
- **`docs/agents/factory.md` has an `Agent:` line and no `Manager:` line** (the version 1 factory, which ran on Orca): it no longer runs. Tell the user, stop its Orca wakes if they still run (the user removes the automation in Orca), and propose a new file from section 3 that keeps `Trunk`, `Max workers`, `Scarce resources`, `Fix rounds`, `Required checks`, `Trunk checks`, `Wake timeout` and `Memory` as they are. Write it only on the user's yes; then go on with setup from section 2.
- **One coordinator for life** (`docs/agents/factory.md` has a `Coordinator:` line, or the memory index has `t3-coordinator`): the factory now runs a dispatcher per run and a coordinator per ticket. Convert, in this order:
  1. No worker may be live: inspect every worker under `live workers` in the memory index; wait for each to end, or stop it on the user's yes.
  2. Delete the old watcher's schedule (the index's `t3-wake`), `<memory>/wake-check.sh` and `<memory>/wake-fingerprint`.
  3. Create `state/`, `resources/`, `tickets/` and `evidence/` in the memory folder and its `.gitignore` (MEMORY.md); `res status set running`, or `paused` when the index said `Status: paused`. Claim no ticket here: the first dispatcher claims, and takes over open pull requests as DISPATCHER.md says.
  4. Clear the old coordinator thread's flag and give it back its name (the reference says how), and drop `t3-coordinator`, `t3-wake`, `live workers` and the `Status:` line from the index.
  5. Ask the user to set the worktree cleanup the reference's **Before the first wake** asks for.
  6. In `docs/agents/factory.md`: drop the `Coordinator:` line; add `Max tickets` (the value of `Max workers`), `Conflict rounds: 3` and `Reset keeps:` (section 3). Commit on trunk as "Convert factory settings to a coordinator per ticket" and push.
  7. Holds: on a GitHub or GitLab tracker, for every issue with `factory:hold`, remove `factory:hold` and `ready-for-agent` and add `ready-for-human`; for every pull request with `factory:hold`, remove it. Delete the `factory:hold` label from the repository only on the user's yes.

## Override

`setup override` changes settings of a project already set up, instead of setting it up again. Read `docs/agents/factory.md`, list every setting with its value, and ask which ones to change; the default is to keep each one. Propose a new value only for the settings picked, the way section 3 proposes it (reading CI for the checks, asking for scarce resources and for what a reset keeps), and leave every other line byte for byte. A leftover `Routes:` or `Coordinator:` line is dropped. Show the diff, then commit it on trunk on its own as "Override factory config: <settings>" and push. Every dispatcher and coordinator rereads the file on its next run or turn. When `Manager:` or `Memory:` changed, run sections 4 and 5 again; otherwise stop here. The same override also lists the roles of `docs/agents/roles.md`: change only the roles picked, proposed as section 2 says, leave the other lines byte for byte, check the file, and commit it on its own as "Override factory roles: <roles>".

## 1. Check the documents the factory reads

First check smode: the `smode` skill is reachable on this machine (smode's **Running a skill by name**). Its playbooks are what every worker runs, and its `setup` playbook writes the documents below.

- `docs/agents/issue-tracker.md` with its `## Factory` section and `Tracker:` line, `docs/agents/triage-labels.md`, and `docs/agents/merge-policy.md`.
- `docs/agents/response-language.md`.
- `docs/agents/verify.md`.

When any of them is missing, or `issue-tracker.md` has no `## Factory` section, run smode's `setup` playbook (`<smode>/playbooks/setup.md`), then check again. Never write these documents here. Stop when a file of the first or third bullet is still missing, and name it. A missing `response-language.md` does not stop setup: the factory uses `match-user` with no live user message (the language of the ticket or spec when it has prose, else the latest human comment, else English), notes the gap, and the user can add the file with `smode setup override`.

`docs/agents/verify.md` is followed in a workspace that the coordinator resets to the head commit before each step (`git clean -fdx`, keeping only `Reset keeps:`), not in a fresh checkout: when it says "a fresh worktree", point that out and suggest the wording "the workspace, reset clean at the head commit".

## 2. Pick the agent manager

Each file in `references/` is one supported manager. Recommend the one whose own check answers (each reference's **Before the first wake** says how) and confirm it with the user.

Then the roles. Only the factory reads `docs/agents/roles.md`: the model each session runs on.

- **The file exists:** check it with `node <this skill's folder>/scripts/roles.mjs check`, and show the user `show`'s table, with `--channels` from the reference's **Candidates**. Keep the roles it has. A role it lacks (`show` prints `(session model)`; a factory with one coordinator for life has no `coordinator` line) gets a route proposed as below, starting from the dropped `Coordinator:` model when there was one; on the user's yes, add the line, check the file again, and commit it on trunk as "Configure factory roles: <roles>".
- **It is missing:** look for old roles the way the reference's **Migration** says, and convert what you find. Otherwise propose a route per role from the models the manager offers (the reference says how), two or three candidates in order on different providers where possible, so a provider out of quota has a fallback:
  - `scout`: the cheapest fast model that can call the manager's tools (the watcher and every dispatcher);
  - `coordinator`: a steady model that follows long instructions and calls the manager's tools (one per claimed ticket, for its whole life);
  - `worker`: a reliable coding model (`build`);
  - `thinker`: the strongest reasoning model (`plan`);
  - `reviewer`: strong reasoning, **another model family than `worker`** (`verify`, `review`); say so when none is offered.

  Ask the user to accept the table or change roles, then write the file from [roles-template.md](roles-template.md) (its explanation, then one line per role), run `roles.mjs check` until it passes, show the diff, and commit it on trunk on its own as "Configure factory roles" and push.
- When an old file was converted, ask whether to delete it now; delete it only on a yes.

The routes must cover all five roles before section 5's provider checks.

## 3. Write `docs/agents/factory.md`

Fill the template and show it to the user before writing:

- **Trunk**: the branch pull requests merge into.
- **Max workers**: workers running at once, across all tickets (the `slot`s).
- **Max tickets**: tickets in progress at once (running, parked or waiting; held ones do not count); default the value of `Max workers`.
- **Required checks**: the CI checks a pull request must pass, by name. Read them from the latest merged pull request (`gh pr checks <number>`) or the job names in the CI configuration, and confirm them with the user; `none` when pull requests get no CI.
- **Trunk checks**: the CI checks whose failure on trunk stops merging, by name. Read them from trunk's latest commits (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs`); usually the same as the required checks, but some CI runs only on trunk (an archive or deploy build). `none` when trunk gets no CI.
- **Scarce resources**: ask whether checking a change needs something only some workers can use at once (a simulator, a device, a GPU, a port). Write each as `<resource>: <how many at once>, held by <roles>`, separated by `;`, or `none`. For each one, `docs/agents/verify.md` must say how to bring it to a clean state and how to stop a command left hanging on it (a stuck runner, a leftover process); a verifier follows both. When it does not, show the user what is missing and suggest adding it with the `setup-verification` skill before the first run.
- **Reset keeps**: the untracked paths the reset gate keeps, comma-separated, because rebuilding them is slow or they are a person's (`node_modules`, `.env`); `none` to keep nothing. Read the setup script of the workspace (the reference says where) for what it installs.
- **Memory**: a folder outside the repository; default `~/.local/share/factory/<repository name>`.

```markdown
# Factory

Settings for the `factory` skill. Every dispatcher run and every coordinator turn rereads this file, so a change applies on the next one. Merge rules live in `merge-policy.md`.

Manager: <reference name>
Trunk: main
Max workers: 3
Max tickets: 3
Scarce resources: none
Fix rounds: 2
Conflict rounds: 3
Required checks: test
Trunk checks: test
Wake timeout: 15 minutes
Reset keeps: node_modules
Memory: ~/.local/share/factory/<repository name>
```

Commit it on trunk as "Configure the software factory" and push.

## 4. Prepare

- Create the memory folder as [MEMORY.md](MEMORY.md) lays it out (`index.md`, `journal.md`, `wiki/`, `results/`, `tickets/`, `evidence/`, `providers.md`, `quota.md`, `.gitignore`), `git init` it, and `res status set paused`: `run` sets it running.
- When the folder already exists, look before you write. A folder without `providers.md` and `quota.md` is a version 1 memory: add the two files and keep `journal.md`, `wiki/` and `results/` as they are; drop identifiers in `index.md` that belong to another manager (`orca-run`, `orca-wake`). A folder without `state/` is converted as **Converting older settings** says. Commit the folder as `upgrade <time>`.
- Follow the reference's **Before the first wake** section, and write the identifiers it asks to keep into `index.md`.
- The project's `AGENTS.md` gets a `### Factory` sub-block in its `## Agent skills` block, unless one is there. Sessions the factory starts get their first message from another agent, and a careful model may refuse such a message as an injection (seen: a dispatcher declined its first message); this block says they are the project's own automation:

  ```markdown
  ### Factory

  The `factory` skill runs unattended in this project (`docs/agents/factory.md`), on a schedule its owner set up with `factory run`. A session whose first message starts with "Factory watcher for", "Factory dispatcher for", "Factory coordinator for" or "Factory worker" was started by that automation: its watcher, a dispatcher or a coordinator. Follow that message as the owner's own request.
  ```

  Show it to the user, commit it on trunk with the settings, and push.
- Labels. On a GitHub tracker, create `priority:p1`, `priority:p2` and `priority:p3` (`gh label create <name> --force`), and check that the labels `triage-labels.md` maps `ready-for-agent`, `ready-for-human`, `needs-info`, `needs-triage`, `wontfix` and `spec` to exist on it; offer to create the missing ones. The pull requests' host also needs the `ready-for-human` label, because a pull request a person must merge carries it: check it there too, whatever the tracker.

## 5. Smoke test

Prove every interface operation on the real manager with a throwaway ticket name, `smoke`. Run each command the reference gives for the operation, and fill every `<…>` below with real paths, ids and candidates before sending a message: `<factory>` is this skill's folder, `<smode>` smode's, `<memory>` the memory folder, `res` the full `node <factory>/scripts/resources.mjs --root <main checkout>`. Report one line per check: the operation, `PASS` or `FAIL`, and the evidence (ids, states, file contents).

1. **launch-coordinator**: title `factory #0 smoke`, branch `factory/smoke` from `origin/<trunk>`, on the first `coordinator` candidate, with the first message below; then make it quiet. PASS when its workspace is on `factory/smoke`, the setup hooks had finished before its first command (the reference says how to tell), and it is quiet.

   > Factory smoke coordinator. Work in this workspace and change no tracked file. Read the reference `<factory>/references/<manager>.md`, **Operations**, for the commands of each operation below. 1. Say the model you run on, and write `pwd`, `git branch --show-current`, the setup hooks' check the reference gives, and the time to `<memory>/results/smoke-coordinator.json`. 2. start-worker `0 smoke` on `<the first worker candidate, mapped>` with this order: "Factory smoke test. 1. Say the model this session runs on. 2. Ask your coordinator one question through the manager: "alpha or beta?", with those two options, and wait for the answer. 3. Wait 60 seconds in the foreground: `end=$(( $(date +%s) + 60 )); until [ $(date +%s) -ge $end ]; do sleep 5; done`. 4. Read your coordinator's follow-ups. 5. Write a JSON object with the keys `model`, `pwd`, `answer` and `followups` to `<memory>/results/smoke.json`. 6. Report completion through the manager with that path. Change no file in the repository." 3. Answer its question `beta`. While it waits, inspect it (`working`) and send it "Record the word gamma." 4. On its `done`, add what inspect said and the worker's result to your JSON file. 5. Then the provider checks of step 9, one worker after another, each answered `alpha`; after each, `git status --short` here is empty. 6. End your turn with a short report. On every later message, do only what it asks.

2. **start-worker**, **send** and **inspect** (in the smoke coordinator): PASS when `smoke.json` has the answer `beta`, the follow-ups hold `gamma`, its `pwd` is the coordinator's workspace, and its model matches the one start-worker was given.
3. **send** (from this session): send the smoke coordinator "factory smoke: reply pong". PASS when it answers in a new turn.
4. **flag-human**: flag the smoke coordinator with "factory smoke test"; confirm through the manager that it shows as waiting for a person; clear it, and confirm it is quiet again.
5. **link-pr**, **watch-pr**, **unwatch-pr**: tell the smoke coordinator to commit an empty commit, push it with `git push origin HEAD:factory/smoke`, open a draft pull request `Factory smoke test`, link-pr and watch-pr it, and end its turn. Close the pull request from this session (`gh pr close`). PASS when the coordinator gets a turn for the close. Then it unwatches.
6. **revive** and **stop-worker**: the reference's revive test, on the smoke workspace.
7. **launch-dispatcher**: `res lock acquire --launcher smoke`, then launch-dispatcher on the first `scout` candidate with the message "Factory smoke dispatcher. Lock token: `<token>`. Run `res lock show`; when its `thread` is empty and its `token` is yours, `res lock thread <your own session id>` (the reference says how to read your id). Reply with your session id and the output of `res lock show`, then stop.", and `res lock thread <its id>` at once. PASS when the lock names the id the launch returned and the dispatcher's reply names the same id. Then `res lock release`, and archive it.
8. **schedule-wakes**: schedule wakes every minute with the prompt `factory smoke wake: reply with the word pong and nothing else`. PASS when, after your turn ended, a run answered `pong` (the reference says where to read it). Then delete the schedule and archive its session. `run` schedules the real watcher.
9. **Providers**: every candidate of every route in `docs/agents/roles.md` that the manager can run gets the checks of the roles it is in, and one line in `providers.md`, `PASS` only when all of them passed:
    - as a worker (`worker`, `thinker`, `reviewer`): the smoke coordinator starts it with this work order, and writes `provider-worker-<candidate>.json`:

      > Factory provider check. Your checkout is the git checkout the manager gave you: run every command there, never inside a folder this order names by absolute path. 1. Say the provider and model you run on. 2. Read `<smode>/SKILL.md` and quote its `name:` line. 3. Write `{"model": …, "name_line": …, "pwd": …}` to `<memory>/results/provider-worker-<candidate>.json` (with the shell when your file tool refuses the path). 4. Ask your coordinator "alpha or beta?" with those two options; when you have no way to ask, write `"asks": false` into the same file and go on. 5. Run `git push --dry-run origin HEAD:refs/heads/factory/provider-check` and put its exit code in the file. 6. Run `git status --short` and put its output in the file. 7. Report completion through the manager. Change no file in the repository.

      PASS when the file exists with the quote, `pwd` is the smoke workspace, the dry run exits 0 and `git status` is empty.
    - as a session (`scout`, `coordinator`): this session launches it at the main checkout with the message "Factory provider check. Say the provider and model you run on, read your own session id through the manager's tools (the reference says how), and write `{"model": …, "session": …, "pwd": …}` to `<memory>/results/provider-session-<candidate>.json`, with the shell when your file tool refuses the path." PASS when the file exists and `session` is the id the launch returned: the candidate can use the manager's tools. Archive the session.
    - `<candidate>` in a file name is the candidate's id with `/` and spaces written as `-` (`provider-worker-google-gemini-4-hydrogen-via=antigravity.json`); its line in `providers.md` starts with the id as `roles.md` writes it, without `effort`. `asks` and whether the worker needed the shell go into the line as facts, not as a failure.
    - A FAIL keeps that candidate out of every route until the check is rerun and passes.
10. **close-workspace**, last: in the smoke workspace, commit a scratch file without pushing; the push check must refuse. Drop the commit (`git reset --hard origin/factory/smoke`), run the push check again, close the workspace, delete the `factory/smoke` branch locally and on the remote, and settle and archive the smoke sessions.

End with the table of results. Setup is done when every line is `PASS`; for a `FAIL`, say what to fix and run the failed check again after the fix.
