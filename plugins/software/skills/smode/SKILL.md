---
name: smode
description: "Use first, before reading code or answering, for every software engineering request: a question about the code, a bug, a feature, a refactor, a review, a ticket, a spec, a pull request, a handoff, setup or the factory. Routes the request to a playbook and runs the other software skills at the steps that need them."
argument-hint: "<task>"
---

# smode

smode is how engineering work runs here, and every request starts in it (ADR-0005). It routes the task to one **playbook**, copies the playbook's steps into a todo list, and runs the skills of the `core` and `software` plugins at the steps that need them. The other skills of `software` do not start on their own: they run when a playbook or a trigger below names them, or when a person invokes one by hand.

Files next to this one: `playbooks/<name>.md` (one per kind of task), `RESULTS.md` (the result object of each step a worker returns), `harness/<harness>.md` (how this session's tools do each action and run a role's candidates), `skills-index.md` (which plugin ships each skill), and `scripts/roles.mjs` (checks and shows the project's roles). Keep this file's absolute path: every work order you write includes it.

## First, the harness

Read the harness doc for the agent running this session: `harness/claude-code.md`, `harness/codex.md` or `harness/omp.md`. When the session also runs inside T3 Code, read `harness/t3.md` as well; it adds to the first doc. Where this file says "spawn a worker", "ask the user" or "schedule", the harness doc says how. A feature your harness lacks is skipped with one line in the reply, `Skipped in <harness>: <step>. <reason>.`, and the work goes on.

## Opening the task

Do these three things before any other work:

1. **Pick the playbook.** When your work order names a playbook, run that one and skip routing. Otherwise route the task with **Playbooks** below, read the file, and make the first line of your first message `Playbook: <name> (<the signal that chose it>)`, so the user can correct the route at once.
2. **Restate.** Then say, in your own words, the user's goal, the problem it solves, and the smallest change you expect to meet it; for `quick`, one sentence. Do not wait for confirmation. If the evidence rules out the change the user asked for, show the evidence and stop.
3. **Open the todo list.** Its first items are the playbook's steps, copied verbatim, then any task-specific items. Keep it current as you go. A step you choose not to do stays in the list as `skip: <reason>`. The final reply shows the list with each step's outcome. `quick` keeps no list.

Restate the goal in every work order and in every final report.

## Running a skill by name

**A step or trigger that names a skill runs that skill.** Read its whole `SKILL.md`, not its first lines, and follow it before doing the step. Doing the step your own way instead, even with the same tools, is a deviation: report it in the reply, under **Deviations**, with its reason.

"The `tdd` skill" means: run that skill's `SKILL.md` and follow it. Find it in this order and use the first that works:

1. The harness already loaded the skill: invoke it the harness's way.
2. This file sits in a checkout of this repository (three folders up is a `plugins/` folder holding `core/`): read `plugins/<plugin>/skills/<skill>/SKILL.md`, taking `<plugin>` from `skills-index.md`.
3. The harness's installed plugin `<plugin>@sanphan-skills`: read `<installPath>/skills/<skill>/SKILL.md`, with `installPath` taken from the harness's install record (the harness doc says where it lives and how to read it). Each plugin is installed at its own version, so never build another plugin's path from this file's path.
4. The harness's clone of the marketplace: read `plugins/<plugin>/skills/<skill>/SKILL.md` inside it.

Step 3 comes before step 4 because a marketplace clone can be newer than the installed plugin. Reading the file also runs a skill the user must invoke by hand (`implement`, `to-tickets`), which a harness's skill command refuses to start for you. A skill that names another skill is resolved the same way. When no copy is found, say so and stop that step.

## Triggers

These fire inside any playbook, whenever the situation arises:

| Situation | Run |
|---|---|
| The plan or the request is unclear, or a decision needs stress-testing | the `grilling` skill |
| Domain terms are unclear, or `GLOSSARY.md` needs a term | the `domain-modeling` skill |
| Designing or deepening a module's interface | the `codebase-design` skill |
| Writing or changing code | the `tdd` skill |
| A bug or a performance regression | the `diagnosing-bugs` skill |
| A question of fact (docs, an API, a library) | the `research` skill |
| A fork you could settle by running something (behaviour, layout, timing) | the `prototype` skill, instead of asking the user |
| Writing a pull request body | the `pr` skill |
| Writing a skill, `AGENTS.md` or `CLAUDE.md` | the `writing-for-agents` skill |
| A step only a person can do (credentials, dashboards, secrets) | the `wizard` skill |

Ask the user only for a product or preference call that no experiment settles.

## Autonomy

Reversible work proceeds without asking: edits, local commits, branches, test runs, drafts.

**Always pause** before an irreversible or outward act: force-pushing a shared branch, deploying, deleting data, merging to trunk, messaging customers or other people. The user's explicit go for that act, in this session, is the only release.

No is an acceptable answer. When asked whether to do something, give your real judgment, including "this does not earn its place".

## Delegation

**A fresh worker for each new piece of work.** Its work order carries the user's goal, the scope (paths it may and may not write), the evidence that proves it is done, every directive given since, and the previous worker's report and branch when there was one. Reuse a worker only when the work needs state that lives in it (an uncommitted checkout, a running process). Point to files by path instead of pasting them.

**Every work order says** which playbook to run and gives the absolute path of this file, so the worker can run it on any harness.

**Model per role.** Pick the role the work needs, then its model from the project's `docs/agents/roles.md`, the only role configuration (ADR-0004): read it before the first delegation of the task, never from a harness's own settings. Each line is the role's **route**, candidates in order (`<provider>/<model>`, `effort=…`, `via=<channel>`); take the first one this harness can run, that is available and not out of quota, mapped to the harness's tools as its doc's **Candidates** section says. A role without a line, or a project without the file, runs the worker on the session's model: say so in the reply and suggest the `setup` playbook. `scripts/roles.mjs` next to this file checks the file (`check`) and prints each role's candidates (`show`).

| Role | Needs |
|---|---|
| scout | fast, cheap reading and searching |
| worker | reliable code changes and test loops |
| thinker | deep reasoning where a wrong answer is expensive: plans, diagnosis, design |
| reviewer | independent judgment: reviews and verification |
| coordinator | steady, cheap, small context: runs a program of many workers |

A `reviewer` runs on a different model family from the `worker` whose change it checks.

**Read-only is a rule, not a mode.** For a step that must not change files, the work order says "change no file and make no commit", and you check the worker's `git status` afterwards. No harness's planning mode is relied on.

**You own the result.** Read the diff or the artifact, not only the worker's summary, and write your own report.

## Writing the reply

- Reply in the language `docs/agents/response-language.md` names; without that file, in the user's language.
- Every claim carries its evidence or a label: measured, inferred, or guessed.
- Never hand the user a check you could run yourself.
- Short sentences. Nothing the playbook's reply asks for is dropped.
- Link only what you produced or read this session.

## Playbooks

Route by the signal in the request, not by how big it sounds. When two rows match, the first of these rules that decides wins:

1. An explicit command or reference (`setup`, `factory once`, a pull request number, a ticket or spec path, a handoff) wins over a description of the work.
2. Work that needs more than one ticket goes to `spec`, however it is worded.
3. A request that changes nothing goes to `quick`, `investigation` or `prototype`, never to a playbook that builds.
4. Take `quick` only when every one of its limits holds; when unsure, take the fuller playbook.
5. Nothing fits: write `Playbook: none (<reason>)` and work through the triggers above.

### Entry playbooks

| Signal in the request | Playbook |
|---|---|
| `setup` or `setup override` of smode or its roles | Setup (`playbooks/setup.md`): prepare this project for smode and write its `docs/agents/roles.md` |
| The factory: `factory` with a mode (`setup`, `run`, `once`), or "stop", "pause", "resume" to it | Factory (`playbooks/factory.md`): run the agent-driven factory |
| A pull request or a branch to review | Review (`playbooks/review.md`): an independent review of a change, at one commit |
| A change to prove on the real product, at a commit | Verify (`playbooks/verify.md`): prove a change works the way a user would see it |
| A handoff, "pick up", "continue", or a branch with work in flight | Pickup (`playbooks/pickup.md`): take over work in flight |
| An approved spec whose tickets are to be built | Spec run (`playbooks/spec-run.md`): build every ticket of a spec on an integration branch |
| One ticket to plan only, before any code | Plan ticket (`playbooks/plan-ticket.md`): a plan for one ticket |
| One ticket to build (its path, number or link) | Ticket (`playbooks/ticket.md`): build one ticket from plan to pull request |
| New issues or outside pull requests to sort, "triage" | Triage (`playbooks/triage.md`): move them through the triage roles |
| A symptom: an error, a stack trace, wrong output, a failing test, a regression | Bug fix (`playbooks/bug-fix.md`): reproduce, diagnose and fix with evidence |
| An idea, or work too big for one ticket; "write a spec", "break this into tickets" | Spec (`playbooks/spec.md`): from an idea to a spec and tickets |
| New or changed behaviour that fits one ticket | Feature (`playbooks/feature.md`): new or changed behaviour |
| A change to structure that keeps behaviour: rename, extract, move, "clean up" | Refactor (`playbooks/refactor.md`): structure changes, behaviour stays |
| "Would X work", "A or B", a fork that running code settles | Prototype (`playbooks/prototype.md`): throwaway code that answers a design question |
| A question that needs more than a few reads, or a decision to research | Investigation (`playbooks/investigation.md`): a cited answer, no change |
| A question a few reads answer, or a change of a few lines that changes no visible behaviour and no test | Quick (`playbooks/quick.md`): do it directly; switch playbooks when a limit breaks |
| A finished session to learn from, "retro" | Retro (`playbooks/retro.md`): turn it into changes to the agent's environment |

### Step playbooks

These run inside another playbook or a work order, most often in a fresh worker; a request reaches them directly only through their row above.

| Step | Run by |
|---|---|
| Plan ticket (`playbooks/plan-ticket.md`) | `ticket` step 2; the factory's `plan` worker |
| Verify (`playbooks/verify.md`) | `bug-fix`, `ticket`, `spec-run`; the factory's `verify` worker |
| Review (`playbooks/review.md`) | `bug-fix`, `refactor`, `ticket`, `spec-run`; the factory's `review` worker |

A worker that runs a step playbook returns the step's object from `RESULTS.md` when its work order asks for a result object.

The structure of this skill is adapted from `poteto-mode` in cursor/plugins `pstack` (MIT, Copyright (c) 2026 Lauren Tan).
