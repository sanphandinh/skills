---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, read `GLOSSARY.md` (if it exists) to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Redact

This skill has you show commands, outputs and captured artifacts. **Redact every secret first**: write `<REDACTED>` in its place. Build loops against env vars, so the credential stays in the environment rather than in what you show. Captured artifacts carry auth headers: quote only the lines that carry the signal.

If the redacted output is not enough to diagnose the bug, say so and ask the user.

## Bug issue intake

Apply this section only when the work is tied to a **bug issue** on the project's tracker. With no bug issue (the user just says "debug this" about a symptom), skip it and start at Phase 1.

A **bug issue** is an issue labelled `bug` on GitHub or GitLab, or a file in the local bugs folder (`.scratch/bugs/issues/`). It is never a spec: it never carries the `spec` label, and locally it never lives in a folder with `spec.md`. The reporter has defined the bug in fixed fields; the ones you depend on are **Actual behavior**, **Expected behavior**, **Reproduction criteria** (checkboxes, each with a `Verify:` line) and the optional **Evidence**. Never rewrite or reinterpret the reporter's claim.

### Find and claim

- **Given a specific issue**, work exactly that bug.
- **Given none**, list the open bug issues on the tracker:
  - GitHub and GitLab: open issues labelled `bug`.
  - Local markdown: the open files in the local bugs folder (any `Status:` other than `closed`).

  Skip every issue whose triage state is `needs-info` (the label on GitHub and GitLab, the `Status:` line locally) and every issue already claimed (it has an assignee on GitHub and GitLab, a `Claimed-by:` line locally). Take the oldest remaining one: the earliest created on GitHub and GitLab, the lowest number locally. If none remains, say so and stop.
- **Claim before any work**: assign the issue to yourself on GitHub and GitLab; add a `Claimed-by: <who>` line near the top of the file locally. Use the tracker's own operations as the project's tracker setup describes them.

### Self-verify

Before Phase 1, check the reporter's claim against the current code:

1. Read the whole issue body, then look at the Evidence (screenshot, recording, log or transcript) so you understand what the reporter saw.
2. Run **every** `Verify:` line, unattended. Record each one as **reproduced** (it failed, showing the Actual behavior), **not reproduced** (it passed, or failed with some other symptom) or **could not run**, with its command and output, redacted as above.
3. A bug with no runnable `Verify:` line is missing information. Do not invent a reproduction of your own and do not start Phase 1. This is a cannot-fix-yet case: see [Cannot fix yet](#cannot-fix-yet).
4. If any `Verify:` line is not reproduced or could not run, stop. Never pick a nearby failure and diagnose that in its place. This is a cannot-fix-yet case too.

### Hand over to Phase 1

When every `Verify:` line is reproduced, those lines are your first feedback loop for Phase 1: start from the reporter's own commands, then tighten them. The Phase 1 completion criterion and every later phase apply as written.

### Cannot fix yet

When the work is tied to a bug issue and you cannot proceed, give the reporter feedback on the issue and take the bug out of the pick-up queue. The cases are:

- self-verify did not reproduce the Actual behavior, or a `Verify:` line could not run;
- the bug has no runnable `Verify:` line;
- no red-capable feedback loop can be built (Phase 1);
- no correct regression seam exists (Phase 5).

Then:

1. **Comment on the issue** with three parts:
   - **What was run**: every command, request or check you ran, each with its result (reproduced, not reproduced, could not run) and its output.
   - **What was tried**: the other loops, seams or reproductions you attempted, and why each fell short.
   - **What is needed from the reporter**: the specific missing item, such as a `Verify:` line that runs unattended and fails while the bug exists, access to the environment that reproduces it, or a captured artifact.

   The comment is public, so apply [Redact](#redact) to everything in it. Write `<REDACTED>` for a secret in a command or an output, and name the environment variable that holds it instead of its value. If the redacted output is not enough for the reporter to act on, say so in the comment.
2. **Move the issue to `needs-info`**, using the label string for that role in the project's triage label mapping:
   - GitHub and GitLab: post the comment and set the label with the comment and label operations in the project's tracker doc.
   - Local markdown: append the comment under the `## Comments` heading at the bottom of the file (add the heading if it is missing) and set the `Status:` line to `needs-info`.
3. **Leave the issue open.** Never close it, and set no state other than `needs-info`: the reporter's update returns the issue to the triage queue through the existing triage rules.

Then stop; do not diagnose a different failure in its place.

## Phase 1: Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug (one that goes red on _this_ bug), you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) that drives the UI and asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with `scripts/hitl-loop.template.sh` so the loop is still structured. Captured output feeds back to you.

Build the right feedback loop, and the bug is 90% fixed.

### Tighten the loop

Treat the loop as a product. Once you have _a_ loop, **tighten** it:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight, a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not, so keep raising the rate until it's debuggable.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for: (a) access to whatever environment reproduces it, (b) a redacted captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

On a bug issue, this is a [cannot-fix-yet](#cannot-fix-yet) case: comment on the issue and move it to `needs-info` instead of asking in conversation.

### Completion criterion: a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** (a script path, a test invocation, a curl) that you have **already run at least once** (show the invocation and its output, redacted), and that is:

- [ ] **Red-capable**: it drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring"; it must be able to _catch this specific bug_.
- [ ] **Deterministic**: same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast**: seconds, not minutes.
- [ ] **Agent-runnable**: you can run it unattended; a human in the loop only via `scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop: jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

## Phase 2: Reproduce + minimise

Run the loop. Watch it go red as the bug appears.

Confirm:

- [ ] The loop produces the failure mode the **user** described, not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

### Minimise

Once it's red, shrink the repro to the **smallest scenario that still goes red**. Cut inputs, callers, config, data, and steps **one at a time**, re-running the loop after each cut, and keep only what's load-bearing for the failure.

Why bother: a minimal repro shrinks the hypothesis space in Phase 3 (fewer moving parts left to suspect) and becomes the clean regression test in Phase 5.

Done when **every remaining element is load-bearing**: removing any one of them makes the loop go green.

Do not proceed until you have reproduced **and** minimised.

## Phase 3: Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe: discard or sharpen it.

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they've already ruled out. Cheap checkpoint, big time saver. Don't block on it; proceed with your ranking if the user is AFK.

## Phase 4: Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5: Fix + regression test

Write the regression test **before the fix**, but only if there is a **correct seam** for it.

A correct seam is one where the test exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for the next phase.

On a bug issue, a missing seam is a [cannot-fix-yet](#cannot-fix-yet) case: comment on the issue and move it to `needs-info` before changing code.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail. If you forced the red by mutating code or a fixture, `diff` against a pristine copy to prove the mutation landed before you trust it.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

## Phase 6: Cleanup

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message, so the next debugger learns
