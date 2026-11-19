---
name: smode
description: "Use first, before reading code or answering, for every software engineering request: a question about the code, a bug, a feature, a refactor, a review, a ticket, a spec, a pull request, a handoff, setup or the factory. Routes the request to a playbook and runs the other software skills at the steps that need them."
argument-hint: "[<playbook>] <task>"
---

# smode

smode is how engineering work runs here, and every request starts in it. It routes the task to one **playbook**, copies the playbook's steps into a todo list, and runs the skills of `core` and `software` at the steps that need them, however they were installed. The other skills of `software` do not start on their own: they run when a playbook or a trigger below names them, or when a person invokes one by hand.

Files next to this one: `playbooks/<name>.md` (one per kind of task), `RESULTS.md` (the result object a factory worker returns for its step), `harness/<harness>.md` (how this session's tools do each action), and `skills-index.md` (every skill smode may run, with the plugin that ships it).

## First, the harness

Read the harness doc for the agent running this session: `harness/claude-code.md`, `harness/opencode.md`, `harness/antigravity.md` or `harness/cursor.md`. Inside T3 Code, read the doc of the provider the session runs on. Where this file says "ask the user", "open a todo list", "start a sub-agent" or "schedule", the harness doc says how. A feature your harness lacks is skipped with one line in the reply, `Skipped in <harness>: <step>. <reason>.`, and the work goes on.

## Opening the task

Do these three things before any other work:

1. **Pick the playbook.** When your work order names a playbook, run that one and skip routing. When a person invoked this skill with arguments (`[<playbook>] <task>`) and the first word is the name of a file in `playbooks/`, run that playbook on the rest and skip routing; the first line is then `Playbook: <name> (named in the arguments)`. Arguments that do not start with a playbook name are the task. With no task in the arguments or the conversation, ask for it. Otherwise route the task with **Playbooks** below, read the file, and make the first line of your first message `Playbook: <name> (<the signal that chose it>)`, so the user can correct the route at once.
2. **Restate.** Then say, in your own words, the user's goal, the problem it solves, and the smallest change you expect to meet it; for `quick`, one sentence. Do not wait for confirmation. If the evidence rules out the change the user asked for, show the evidence and stop.
3. **Open the todo list.** Its first items are the playbook's steps, copied verbatim, then any task-specific items. Keep it current as you go. A step you choose not to do stays in the list as `skip: <reason>`. The final reply shows the list with each step's outcome. `quick` keeps no list.

Restate the goal in every final report.

## Running a skill by name

**A step or trigger that names a skill runs that skill.** Read its whole `SKILL.md`, not its first lines, and follow it before doing the step. Doing the step your own way instead, even with the same tools, is a deviation: report it in the reply, under **Deviations**, with its reason.

"The `tdd` skill" means: run that skill's `SKILL.md` and follow it. Skills are found by name, never by where this file sits: they may come from a plugin, from a tool that copies skills into a skills folder (such as `npx skills add`), or from a checkout. A copy counts only when it is a folder named `<skill>` holding a `SKILL.md` whose `name` is `<skill>`. Find it in this order and use the first that works:

1. The harness already loaded the skill: invoke it the harness's way, under the name the session lists it by (with a plugin prefix or without).
2. Next to this skill: `<skill>/SKILL.md` in the folder that holds this skill's folder. Skills installed into a skills folder sit there side by side, and so do the skills of one plugin.
3. The harness's skill locations, in the order its harness doc lists them: the project's and the user's skills folders, then the skills of each installed plugin (whatever marketplace it came from).
4. Up from this skill: the nearest ancestor folder holding `<any folder>/skills/<skill>/SKILL.md`, which is how a checkout of a plugin repository keeps another plugin's skills.

Reading the file also runs a skill the user must invoke by hand (`implement`, `to-tickets`), which a harness's skill command refuses to start for you. A skill that names another skill is resolved the same way. When no copy is found, say so, name what ships it (`skills-index.md` lists the plugin), and stop that step.

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

## Working alone

**smode spawns no worker and chooses no model.** Every step of a playbook runs in this session, on its model. Running work in other agents, on models chosen per step, is the job of the `factory` skill.

**A check is a separate step.** When a playbook runs the `verify` or `review` playbook, finish the step before it first, then start the check again from the ticket and the diff against its base, not from what you remember of writing the change. Its verdict is the check's, and the author's own checks are never that verdict. When there is no commit to check (the user said not to commit), check the working tree against its base and say so in the verdict; never skip a check for that.

**Skills that use sub-agents keep them.** `code-review`, `implement-spec`, `research` and others start sub-agents by design: use the harness's default sub-agent (the harness doc says which), on the session's model, and pass no model. When the harness cannot start one, do that part yourself, one after the other.

**A factory worker follows its work order.** When a work order started this session, it names the playbook and the rules; start no agent beyond what a skill needs.

**Read-only is a rule, not a mode.** For a step that must not change files, change none, make no commit, and check `git status` afterwards. No harness's planning mode is relied on.

**You own the result.** Read the diff or the artifact, including what a skill's sub-agents return, and write your own report.

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
| `setup` or `setup override` of smode | Setup (`playbooks/setup.md`): prepare this project's agent docs for smode |
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

These run as a step of another playbook, or in a factory worker's work order; a request reaches them directly only through their row above.

| Step | Run by |
|---|---|
| Plan ticket (`playbooks/plan-ticket.md`) | `ticket` step 2; the factory's `plan` worker |
| Verify (`playbooks/verify.md`) | `bug-fix`, `ticket`, `spec-run`; the factory's `verify` worker |
| Review (`playbooks/review.md`) | `bug-fix`, `refactor`, `ticket`, `spec-run`; the factory's `review` worker |

A worker that runs a step playbook returns the step's object from `RESULTS.md` when its work order asks for a result object.

The structure of this skill is adapted from `poteto-mode` in cursor/plugins `pstack` (MIT, Copyright (c) 2026 Lauren Tan).
