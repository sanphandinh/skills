---
name: smode
description: "Use first, before reading code or answering, for every software engineering request: a question about the code, a bug, a feature, a refactor, a review, a ticket, a spec, a pull request, a handoff, setup or the factory. Routes the request to a playbook and runs the other software skills at the steps that need them."
argument-hint: "[<playbook>] <task>"
---

# smode

smode is how engineering work runs here, and every request starts in it. It routes the task to one **playbook**, copies the playbook's steps into a todo list, and runs the skills of `core` and `software` at the steps that need them, however they were installed. The other skills of `software` do not start on their own: they run when a playbook or a trigger below names them, or when a person invokes one by hand.

Files next to this one: `playbooks/<name>.md` (one per kind of task), `RESULTS.md` (the result object a work order asks a step to return), `harness/<harness>.md` (how this session's tools do each action), and `skills-index.md` (every skill smode may run, with the plugin that ships it).

## First, the harness

Detect the agent running this session (inside T3 Code, the provider the session runs on) and read its harness doc once: `harness/claude-code.md`, `harness/opencode.md`, `harness/antigravity.md`, or `harness/cursor.md`. Where this file says "ask the user", "open a todo list", or "start a sub-agent", the harness doc says how. When a skill needs a sub-agent and the harness cannot start one, do that part yourself, sequentially. Any other feature your harness lacks is skipped with one line in the reply, `Skipped in <harness>: <step>. <reason>.`, and the work goes on.

## Opening the task

Do these three things before any other work:

1. **Pick the playbook.** When your work order names a playbook, run that one and skip routing. When a person invoked this skill with arguments (`[<playbook>] <task>`) and the first word is the name of a file in `playbooks/`, run that playbook on the rest and skip routing; the first line is then `Playbook: <name> (named in the arguments)`. Arguments that do not start with a playbook name are the task. With no task in the arguments or the conversation, ask for it. Otherwise route the task with **Playbooks** below, read the file, and make the first line of your first message `Playbook: <name> (<the signal that chose it>)`, so the user can correct the route at once.
2. **Restate.** Then say, in your own words, the user's goal, the problem it solves, and the smallest change you expect to meet it; for `quick`, one sentence. Do not wait for confirmation. If the evidence rules out the change the user asked for, show the evidence and stop.
3. **Open the todo list.** Its first items are the playbook's steps, copied verbatim, then any task-specific items. Keep it current as you go. A step you choose not to do stays in the list as `skip: <reason>`. The final reply shows the list with each step's outcome. `quick` keeps no list.

## Running a skill by name

**A step or trigger that names a skill runs that skill.** Read its whole `SKILL.md`, not its first lines, and follow it before doing the step. Doing the step your own way instead, even with the same tools, is a deviation: report it in the reply, under **Deviations**, with its reason.

"The `tdd` skill" means: locate a folder named `tdd` holding a `SKILL.md` whose `name` is `tdd`, read the whole file, and follow it (reading the file also runs user-invoked skills a harness command refuses to start). Resolve any skill — including one named by another skill — in the order your harness doc lists under **Finding skills**, never by assuming one install layout. When no copy is found, say so, name the plugin from `skills-index.md`, and stop that step.

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
| Setting up pre-commit hooks (Husky, lint-staged, Prettier) | the `setup-pre-commit` skill |
| A step only a person can do (credentials, dashboards, secrets) | the `wizard` skill |

Ask the user only for a product or preference call that no experiment settles.

## Autonomy

Reversible work proceeds without asking: edits, local commits, branches, test runs, drafts.

**Always pause** before an irreversible or outward act: force-pushing a shared branch, deploying, deleting data, merging to trunk, messaging customers or other people. The user's explicit go for that act, in this session, is the only release.

No is an acceptable answer. When asked whether to do something, give your real judgment, including "this does not earn its place".

## Writing the reply

- Start with the opening `Playbook:` line and restatement, then give the playbook's **Reply** section; restate the goal in every final report.
- You own the result: read the diff or the artifact, including what a skill's sub-agents return, and write your own report.
- Reply in the language `docs/agents/response-language.md` names; without that file, in the user's language.
- Every claim carries its evidence or a label: measured, inferred, or guessed.
- Never hand the user a check you could run yourself.
- Short sentences. Nothing the playbook's reply asks for is dropped.
- Link only what you produced or read this session.

## Playbooks

Route by the signal in the request, not by how big it sounds. Signals match by meaning, in any language: the quoted words below are examples, not literals. Only command words are literal: a playbook name as the first argument, and the factory's modes. When two rows match, the first of these rules that decides wins:

1. An explicit command or reference (`setup`, `factory once`, a pull request number, a ticket or spec path, a handoff) wins over a description of the work.
2. Work that needs more than one ticket goes to `spec`, however it is worded.
3. A request that changes nothing goes to `quick`, `investigation` or `prototype`, never to a playbook that builds.
4. Take `quick` only when every one of its limits holds; when unsure, take the fuller playbook.
5. Nothing fits: write `Playbook: none (<reason>)` and work through the triggers above.

| Signal in the request | Playbook |
|---|---|
| `setup` or `setup override` of smode | Setup (`playbooks/setup.md`): prepare this project's agent docs for smode |
| The factory: `factory` with a mode (`setup`, `run`, `once`), or "stop", "pause", "resume" to it | Factory (`playbooks/factory.md`): run the agent-driven factory |
| A diff, pull request, or branch change to review | Review (`playbooks/review.md`): an independent review of a change, at one commit |
| A change to prove on the real product, at a commit | Verify (`playbooks/verify.md`): prove a change works the way a user would see it |
| A handoff, "pick up", "continue", or a branch with work in flight | Pickup (`playbooks/pickup.md`): take over work in flight |
| An approved spec whose tickets are to be built | Spec run (`playbooks/spec-run.md`): build every ticket of a spec on an integration branch |
| One ticket to plan only, before any code | Plan ticket (`playbooks/plan-ticket.md`): a plan for one ticket |
| One ticket to build (its path, number or link) | Ticket (`playbooks/ticket.md`): build one ticket from plan to pull request |
| New issues or outside pull requests to sort, "triage" | Triage (`playbooks/triage.md`): move them through the triage roles |
| A finished session to learn from, "retro" | Retro (`playbooks/retro.md`): turn it into changes to the agent's environment |
| A symptom: an error, a stack trace, wrong output, a failing test, a regression | Bug fix (`playbooks/bug-fix.md`): reproduce, diagnose and fix with evidence |
| An idea, or work too big for one ticket; "write a spec", "break this into tickets" | Spec (`playbooks/spec.md`): from an idea to a spec and tickets |
| New or changed behaviour that fits one ticket | Feature (`playbooks/feature.md`): new or changed behaviour |
| A change to structure that keeps behaviour: rename, extract, move, "clean up" | Refactor (`playbooks/refactor.md`): structure changes, behaviour stays |
| "Would X work", "A or B", a fork that running code settles | Prototype (`playbooks/prototype.md`): throwaway code that answers a design question |
| A question that needs more than a few reads, an audit of existing code or docs, or a decision to research | Investigation (`playbooks/investigation.md`): a cited answer, no change |
| A question a few reads answer, or a change of a few lines that changes no visible behaviour and no test | Quick (`playbooks/quick.md`): do it directly; switch playbooks when a limit breaks |
