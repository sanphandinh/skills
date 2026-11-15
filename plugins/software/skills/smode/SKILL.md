---
name: smode
description: "Work in smode: restate the goal, match the task to a playbook, follow its steps verbatim, and run this repo's skills at the steps that need them."
disable-model-invocation: true
argument-hint: "<task>"
---

# smode

smode is how engineering work runs here. It matches the task to one **playbook**, copies the playbook's steps into a todo list, and runs the skills of the `core`, `software` and `factory` plugins at the steps that need them.

Files next to this one: `playbooks/<name>.md` (one per kind of task), `harness/<harness>.md` (how this session's tools do each action), and `skills-index.md` (which plugin ships each skill). Keep this file's absolute path: every work order you write includes it.

## First, the harness

Read the harness doc for the agent running this session: `harness/claude-code.md`, `harness/codex.md` or `harness/omp.md`. When the session also runs inside T3 Code, read `harness/t3.md` as well; it adds to the first doc. Where this file says "spawn a worker", "ask the user" or "schedule", the harness doc says how. A feature your harness lacks is skipped with one line in the reply, `Skipped in <harness>: <step>. <reason>.`, and the work goes on.

## Opening the task

Your first message on a task says, in your own words, the user's goal, the problem it solves, and the smallest change you expect to meet it. Do not wait for confirmation. If the evidence rules out the change the user asked for, show the evidence and stop. Restate the goal in every work order and in every final report.

## Running a skill by name

"The `tdd` skill" means: run that skill's `SKILL.md` and follow it. Find it in this order and use the first that works:

1. The harness already loaded the skill: invoke it the harness's way.
2. This file sits in a checkout of this repository (three folders up is a `plugins/` folder holding `core/`): read `plugins/<plugin>/skills/<skill>/SKILL.md`, taking `<plugin>` from `skills-index.md`.
3. The harness's installed plugin `<plugin>@sanphan-skills`: read `<installPath>/skills/<skill>/SKILL.md`. The harness doc says where the install record lives.
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

**Model per role.** Pick the role the work needs, then the model the role maps to in this machine's role configuration (the harness doc says where it lives; the Setup playbook writes it). With no configuration, run the worker on the session's model and say so.

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

Match the task to one playbook and open it. Open a todo list whose first items are its steps, copied verbatim. A step you choose not to do stays in the list with `skip: <reason>`. When no playbook fits, say so, then work through the triggers above.

- **Investigation** (`playbooks/investigation.md`): a read-only question. How does X work, why is Y so, should we do X or Y.
- **Bug fix**: a defect to reproduce, diagnose and fix with evidence. Not written yet.
- **Feature**: new or changed behaviour. Not written yet.
- **Refactor**: a change to structure that keeps behaviour. Not written yet.
- **Prototype**: throwaway code that answers a design question. Not written yet.
- **Spec**: from an idea to a spec and tickets on the tracker. Not written yet.
- **Plan ticket**: a plan for one ticket before any code. Not written yet.
- **Ticket**: build one ticket from plan to pull request. Not written yet.
- **Spec run**: build every ticket of a spec on an integration branch. Not written yet.
- **Verify**: prove a change works on the real product. Not written yet.
- **Review**: an independent review of a change. Not written yet.
- **Triage**: move new issues and outside pull requests through the triage roles. Not written yet.
- **Pickup**: take over work in flight from a handoff or a branch. Not written yet.
- **Retro**: turn a finished session into changes to the agent's environment. Not written yet.
- **Setup**: prepare this machine and project for smode. Not written yet.
- **Factory**: run the agent-driven factory. Not written yet.

The structure of this skill is adapted from `poteto-mode` in cursor/plugins `pstack` (MIT, Copyright (c) 2026 Lauren Tan).
