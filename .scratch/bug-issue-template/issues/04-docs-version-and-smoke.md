# 04: Docs, plugin version, and end-to-end smoke

**What to build:** the repository's docs and metadata describe the bug issue template, and the whole spec is proven end to end once. `AGENTS.md`'s contents list mentions the bug template in `setup-software-context` and the bug-issue behaviour in `diagnosing-bugs`. The `software` plugin version is bumped everywhere it is recorded. Then the five smoke scenarios from the spec are run by hand on a sandbox repository, against the skills as merged on the integration branch.

**Blocked by:** 01, 03

**Status:** closed

**Door:** two-way

- [x] `AGENTS.md` mentions the bug template in `setup-software-context` and the bug-issue behaviour in `diagnosing-bugs`, in the existing contents list, without a new skill entry
  Verify: read `AGENTS.md`; both mentions exist and no new skill is listed
- [x] The `software` plugin version is bumped consistently in every plugin manifest and marketplace file that records it
  Verify: search the repository for the old version string next to the `software` plugin; none remains, and every recorded value is the same new one
- [x] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root
- [x] Smoke 1: setup on a GitHub-style sandbox writes a bug issue form with the right required fields and creates the `bug` label
  Verify: run setup on the sandbox and read the form; record the result in the ticket's `## Comments`
- [x] Smoke 2: setup on a local-markdown sandbox creates the bugs folder and a template file and leaves existing files untouched
  Verify: run setup and compare the tree; record the result in `## Comments`
- [x] Smoke 3: an agent following `diagnosing-bugs` on a seeded bug whose `Verify:` goes red runs Phase 1 from that check
  Verify: run it and record the agent's output in `## Comments`
- [x] Smoke 4: on a seeded bug whose `Verify:` does not reproduce, the agent stops, comments with the structure, and sets `needs-info`
  Verify: run it and record the comment and status in `## Comments`
- [x] Smoke 5: on a bug with no runnable `Verify:`, the agent comments and sets `needs-info` instead of guessing
  Verify: run it and record the comment and status in `## Comments`
- [x] The sandbox repositories and any seeded bug files are removed afterwards and none is left in this repository
  Verify: list the repository's untracked files; no sandbox or seeded bug remains

## Comments

Smokes were run on 2026-11-05 against the skills as merged on `integration/bug-issue-template` (this branch's `plugins/software/skills/`), in sandboxes under `/tmp/bug-template-smoke/` that were deleted afterwards. The agent-behaviour runs used fresh `omp -p` sessions started with `--no-session --no-skills --no-extensions --no-rules`, each given only the path of the skill file and a one-paragraph instruction; the task tool could not spawn subagents in this session, so a separate CLI agent process stood in for the fresh subagent. Smokes 1 and 2 were also run as fresh agents following `setup-software-context` instead of by hand. Model: the omp default.

**Automated:** `npm run validate` printed `27 skills, 10 agents, 0 issue(s)`; `npm test` passed 13 of 13 (the worktree used the main checkout's `node_modules` through a temporary symlink, removed before commit).

**Smoke 1 (GitHub-style sandbox, pass).** Sandbox: git repo with remote `https://github.com/example/widgets.git`, an existing `.github/ISSUE_TEMPLATE/feature.yml`, an `AGENTS.md`. There is no real GitHub, so a stub `gh` was first on `PATH`; it logged every call and its `gh label list` printed only `needs-triage` and `spec`. Result: `.github/ISSUE_TEMPLATE/bug.yml` written, byte-identical to the `bug-template-github.yml` seed. It has `labels: ["bug"]` and `required: true` on exactly Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment and Reproduction criteria; Evidence, Frequency, Since and Out of scope carry `required: false`. The stub log shows `gh label list`, then `gh label create` for `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` and `bug`. `feature.yml` was untouched. Other writes: `docs/agents/{issue-tracker,domain,triage-labels}.md` and an `## Agent skills` block appended to `AGENTS.md`. Not proven: that real `gh label create bug` succeeds on GitHub (stubbed).
Note: my instructions said "triage is not installed, skip Section B", but the agent found `triage` beside the skill and ran Section B anyway, so the label list above includes the triage labels. The skill's own check overrode my answer; it does not affect the bug-template result.

**Smoke 2 (local-markdown sandbox, pass).** Sandbox: git repo with `AGENTS.md`, `.scratch/foo/spec.md` and `.scratch/foo/issues/01-thing.md`, no remote. Result: `.scratch/bugs/issues/TEMPLATE.md` created, byte-identical to the `bug-template-local.md` seed; no `spec.md` in `.scratch/bugs/`; `git diff` shows `.scratch/foo/**` untouched. The only pre-existing file modified is `AGENTS.md` (14 lines appended: the `## Agent skills` block, the existing setup behaviour); no bug template was added to it. Other writes: `docs/agents/{issue-tracker,domain,triage-labels}.md`. Same Section B note as Smoke 1.

**Smoke 3 (`Verify:` goes red, pass).** Sandbox: local tracker, `math.js` with `average` dividing by `xs.length - 1`, bug file `.scratch/bugs/issues/01-average-wrong.md` (`Status: needs-triage`) whose one `Verify:` is a `node -e` check that exits 0 when `average([2,4,6])` is 4. Instruction: "Pick up the next open bug and fix it." Observed: the agent listed `.scratch/bugs/issues/`, found the one open unclaimed bug, added `Claimed-by: agent` and committed it before any other work, ran the `Verify:` line (printed `6`, exit 1, reproduced), then used that same command as its Phase 1 loop, ran it twice, minimised the input, wrote ranked hypotheses, probed with a `[DEBUG-a4f2]`-tagged log, wrote `math.test.js` which failed `6 !== 4`, fixed the divisor, got the test and the original `Verify:` green, grepped out the debug tag, and committed the fix on a new branch with the cause in the message. File state after: `math.js` divides by `xs.length`; `math.test.js` added; the bug file has `Claimed-by: agent`, `Status: closed`, the checkbox ticked and a `## Handoff` the agent wrote in the ticket style it saw in the tracker doc. Closing the bug and writing a handoff are not in `diagnosing-bugs`; they came from the sandbox's `docs/agents/issue-tracker.md` (the local tracker seed's close and handoff rules).

**Smoke 4 (`Verify:` does not reproduce, pass).** Sandbox: same bug file, but `math.js` is correct, so the `Verify:` passes. Observed: the agent claimed the bug (`Claimed-by` line, committed), ran the `Verify:` line (printed `4`, exit 0), recorded it as not reproduced, stopped before Phase 1 and changed no code. It appended under `## Comments` a `### Cannot fix yet` entry with `What was run` (the command, not reproduced, output `4`, exit 0), `What was tried` (nothing further, no nearby failure substituted) and `What is needed from the reporter` (a `Verify:` that fails while the bug exists, or the environment or artifact that shows 6), and set `Status: needs-info`. File state after: only the bug file modified, `Status: needs-info`, the issue open, `math.js` untouched. The agent changed the claim line from `Claimed-by: n` to `Claimed-by: San Phan` and left it in place.

**Smoke 5 (no runnable `Verify:`, pass).** Sandbox: bug file `01-slow-ui.md` whose only `Verify:` is "open it in the browser and look at whether it feels fast"; no dashboard code in the repo. Observed: the agent claimed the bug (`Claimed-by: agent`, left uncommitted because git identity was unset), read the issue, recorded the `Verify:` as could not run (not unattended, no URL, no threshold), checked the repo for anything runnable and found nothing, did not invent a reproduction or start Phase 1, and appended a dated comment with the three parts (`What was run`, `What was tried`, `What is needed from the reporter`), then set `Status: needs-info`. File state after: only the bug file modified (`Status: needs-info`, `Claimed-by: agent`, comment appended), issue open, no code changed.

**Cleanup.** `/tmp/bug-template-smoke/` and its run scripts and logs were deleted; `git status` in this worktree lists no sandbox or seeded bug file.

**Post-smoke review fixes (2026-11-05):** (1) `diagnosing-bugs` local find now lists only numbered `<NN>-<slug>.md` files in `.scratch/bugs/issues/`, not `TEMPLATE.md`. (2) the cannot-fix-yet path now releases the agent's claim when setting `needs-info` (remove assignee on GitHub/GitLab, remove `Claimed-by:` locally), addressing Smokes 4 and 5 leaving a claim in place. (3) the local seed `bug-template-local.md` uses plain `Status:` and `Category:` lines, not bold. Smokes were not re-run.

## Handoff

**Delivered:** `AGENTS.md`'s existing contents list now mentions the bug template under `setup-software-context` and the bug-issue behaviour under `diagnosing-bugs`, with no new skill entry. The `software` plugin is 0.8.0 in every file that records it. `npm run validate` and `npm test` pass. The five smokes ran against the merged skills and all behaved as the spec describes; the record is under `## Comments`.
**Interfaces introduced:** none.
**Deviations from spec:** none. No `GLOSSARY.md` entry was added: the spec makes it conditional on the maintainer agreeing, and that was not asked here.
**Decisions:** minor bump (0.7.0 to 0.8.0) because skill behaviour changed, as prior feature changes did; only `software` is bumped, since `software-claude` and `software-omp` carry agents, not these skills, and earlier skill-only changes (for example the factory 0.2.1 change) bumped only the plugin whose skills changed. The 0.7.0 string existed in the `software` entry of `.omp-plugin/marketplace.json`, `plugins/software/.claude-plugin/plugin.json` and `plugins/software/.codex-plugin/plugin.json`; the other two marketplace files record no versions.
**Gotchas:**
- Claims are never released. In Smokes 4 and 5 the agent left `Claimed-by` on the bug after setting `needs-info`. `diagnosing-bugs` skips claimed bugs when finding work, and the spec says the reporter's update returns the bug to `needs-triage`, so a reporter who fixes the issue will find it still claimed and, on the local tracker, never picked up again unless someone deletes the `Claimed-by:` line. On GitHub and GitLab the assignee persists the same way. Neither skill says to release the claim in the cannot-fix-yet path. Not fixed here: it is outside this ticket's files.
- The setup agent ran Section B (triage labels) although told to skip it, because its own "is `triage` installed" check passes in the skills repo. This is the skill working as written.
- Smoke 1 used a stubbed `gh`; the real label creation on GitHub is not exercised.
**For the next ticket:** none; this is the last ticket of the spec.
**Links:** branch `ticket-04-docs-smoke`; spec `.scratch/bug-issue-template/spec.md`.
