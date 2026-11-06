Status: ready-for-agent

# Bug issue template: humans file bugs in a fixed shape, agents find and self-verify them

## Problem Statement

A person who hits a bug files an issue in whatever shape they like. An AI agent that later picks the issue up cannot tell what is required to reproduce it, cannot tell whether the symptom the reporter saw is the symptom the agent reproduced, and has no agreed way to say "this is not reproducible, I need more". Having an agent refine the report afterwards does not help: the agent does not know which behaviour is the real bug, so it can only guess and fix the wrong thing.

Today the `diagnosing-bugs` skill assumes a conversation with a user, not a bug issue on a tracker. It does not say how to find bug issues, how to check the reporter's claim before diagnosing, or what to do on the tracker when the bug cannot be fixed.

## Solution

The human defines the bug completely, up front, in a fixed template with required and optional fields. The key required field is a reproduction check the agent can run unattended: red while the bug exists, green after a correct fix. The agent never rewrites the claim; it either reproduces the reporter's symptom and fixes it, or it reports back on the issue and waits.

- `setup-software-context` gains one section that installs the bug template into the project's tracker (GitHub issue form, GitLab issue template, local markdown template, or printed text for Jira and other trackers).
- `diagnosing-bugs` gains the agent side: how to recognise and find bug issues, how to self-verify the reporter's reproduction checks before Phase 1, and a feedback comment on the issue when it cannot fix the bug.
- No new skill, no pipeline. Repeated pick-up of bugs is left to the automation of the user's coding agent or agent manager (Orca).

## User Stories

1. As a reporter, I want a fixed bug template when I open an issue, so that I know exactly what to provide.
2. As a reporter on GitHub, I want the issue form to refuse a bug with a required field empty, so that I cannot file an incomplete bug by accident.
3. As a reporter on GitLab, I want a bug issue template listing the same fields, so that the bug has the same shape as on GitHub.
4. As a reporter on a local markdown tracker, I want a template file to copy into the bugs folder, so that a bug file looks the same as on a remote tracker.
5. As a reporter on Jira or another tracker, I want the template text printed at setup, so that I can paste it into my tracker's description template.
6. As a reporter, I want a required Summary, Actual behavior, Expected behavior, Steps to reproduce, and Environment, so that the claim is stated by me and not guessed by an agent.
7. As a reporter, I want a required Reproduction criteria field where every item has a `Verify:` line, so that an agent can check my claim without me.
8. As a reporter, I want to know a `Verify:` line must fail while the bug exists and pass after a correct fix, so that I write one that proves the bug and nothing nearby.
9. As a reporter, I want the template to say a `Verify:` line must run without a person (a command, a request, or automated browser steps), so that I know a purely manual check is not accepted.
10. As a reporter, I want an optional Evidence field for a screenshot or screen recording, so that I can show a visual bug without describing every pixel.
11. As a reporter of a non-visual bug, I want to leave Evidence empty or attach a log or terminal transcript instead, so that the template does not force a picture that does not exist.
12. As a reporter, I want optional Frequency, Since, and Out of scope fields, so that I can add context for an intermittent or regression bug without cluttering simple reports.
13. As a maintainer, I want one setup step that installs the template into whichever tracker the project uses, so that I do not hand-write a template per tracker.
14. As a maintainer, I want setup to create the `bug` label on trackers with labels, so that bug issues are findable by label.
15. As a maintainer, I want setup to work on a project that already has issue templates, so that my other templates are left alone.
16. As a maintainer, I want bug issues never to carry the `spec` label, so that the factory never treats a bug as a spec.
17. As a maintainer, I want no extra doc in `docs/agents/` for bugs, so that the project does not grow another file to keep in sync.
18. As an agent given a specific bug issue, I want to work exactly that bug, so that automation can point me at it.
19. As an agent given no issue, I want to find open bug issues myself, so that a scheduled automation needs no bug-picking logic.
20. As an agent finding bugs, I want to skip issues already waiting for information and issues someone has claimed, so that I do not repeat blocked work or collide with another run.
21. As an agent, I want to claim a bug before working it (assignee on GitHub and GitLab, `Claimed-by:` locally), so that two automation runs never take the same bug.
22. As an agent, I want to recognise a bug issue by the `bug` label (or by its place in the local bugs folder), so that I need no per-project configuration.
23. As an agent, I want to run every `Verify:` line before diagnosing, so that I know whether the reporter's claim holds on the current code.
24. As an agent, I want to record each `Verify:` result as reproduced, not reproduced, or could not run, with redacted output, so that the reporter and the next agent see exactly what happened.
25. As an agent, I want to stop when the checks do not reproduce the Actual behavior, so that I never fix a nearby bug in its place.
26. As an agent, I want a reproduced `Verify:` line to become the starting feedback loop of Phase 1, so that I begin from the reporter's own proof and then tighten it.
27. As an agent, I want a bug issue with no runnable `Verify:` line to count as missing information, so that I ask the reporter instead of inventing a reproduction.
28. As an agent, I want to look at the Evidence (screenshot, recording, log) before running checks, so that I understand what the reporter saw.
29. As an agent, I want to comment on the issue when I cannot fix the bug, so that the reporter learns what is missing.
30. As a reporter, I want that comment to say what the agent ran, what it tried, and what it needs from me, so that I can correct the issue in one pass.
31. As a maintainer, I want the issue moved to `needs-info` when the agent cannot proceed, so that automation does not pick the same bug again in a loop.
32. As a maintainer, I want the issue left open when the agent cannot fix it, so that a person or a later run can still resolve it.
33. As a reporter, I want my update to the issue to return it to the triage queue through the existing triage flow, so that no new state machine exists.
34. As a user who says "debug this" without any issue, I want `diagnosing-bugs` to behave exactly as it does today, so that the new tracker behaviour only applies to bug issues.
35. As a maintainer, I want existing triage, implement, and factory behaviour unchanged, so that adding bug templates breaks nothing already working.

## Implementation Decisions

- The change touches two existing skills only: `setup-software-context` (install side) and `diagnosing-bugs` (agent side). No new skill, no new agent, no pipeline, no script.
- Template source of truth: seed files live in the `setup-software-context` skill folder next to the existing tracker seeds, one per tracker kind. `diagnosing-bugs` does not read them; it names, in prose, the fields it depends on (Actual behavior, Expected behavior, Reproduction criteria with `Verify:` lines, Evidence).
- Setup installs per tracker:
  - GitHub: an issue form (`.github/ISSUE_TEMPLATE/bug.yml`) with required validations on the required fields. The form applies the `bug` label automatically.
  - GitLab: a markdown issue template (`.gitlab/issue_templates/Bug.md`); GitLab cannot enforce required fields, so the template marks them in text.
  - Local markdown: a bugs folder `.scratch/bugs/issues/` holding one file per bug (`<NN>-<slug>.md`, numbered from `01`) plus a template file to copy. A bug file carries a `Status:` line from the triage vocabulary and a `Category: bug` line. The bugs folder has no `spec.md`.
  - Jira and other trackers: setup prints the template for the maintainer to paste; no file is written.
- Setup creates a `bug` label on GitHub and GitLab when missing. The label string is fixed at `bug`; it is not part of the triage label mapping. Setup leaves existing issue templates alone.
- Setup writes no doc in `docs/agents/` for bugs and adds nothing to the `## Agent skills` block.
- Field contract. Required: Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, Reproduction criteria. Optional: Evidence, Frequency, Since, Out of scope. Reproduction criteria is at least one checkbox, each with a `Verify:` line that an agent runs unattended, goes red while the bug exists, and goes green after a correct fix. Evidence is optional: a screenshot or screen recording for visual bugs, a log or transcript otherwise, or empty.
- A bug issue is never a spec: it never carries the `spec` label and, locally, never lives in a folder with `spec.md`.
- Agent behaviour, added to `diagnosing-bugs` before Phase 1 and only when the work is tied to a bug issue:
  1. Recognise and find: a bug issue is one labelled `bug` (or a file in the local bugs folder). Given a specific issue, work it. Given none, list open bug issues, skip those in `needs-info` and those already claimed, take the oldest. Claim it before working: assignee on GitHub and GitLab, `Claimed-by:` locally.
  2. Self-verify: read the body and Evidence, then run every `Verify:` line and record reproduced, not reproduced, or could not run, with redacted output. A bug with no runnable `Verify:` line is missing information. If the checks do not reproduce the Actual behavior, stop; never substitute a nearby failure.
  3. When self-verify passes, the reporter's `Verify:` lines are the starting loop for Phase 1, which tightens them. All existing phases stay as they are.
- Cannot fix yet: when self-verify fails or cannot run, no red-capable loop can be built, or no correct regression seam exists, the agent comments on the issue and moves it to `needs-info`. The comment says what was run (with each result), what was tried, and what is needed from the reporter, and is redacted like every other artifact in the skill. On GitHub and GitLab the agent uses the tracker's comment and label operations from the project's tracker doc; locally it appends under `## Comments` and sets `Status: needs-info`. The issue stays open. The reporter's update returns it to `needs-triage` through the existing triage rules; this spec adds no new transition.
- When no bug issue is involved (a user just says "debug this"), `diagnosing-bugs` is unchanged.
- No ADR: the decision is cheap to reverse and not surprising.
- Docs and versions: update the contents list in `AGENTS.md` and the software plugin version, as the repo's prior changes did. Add a `Bug issue` entry to `GLOSSARY.md` only if the maintainer agrees when the work is done.

## Testing Decisions

- A good check here exercises observable behaviour: what a reader of the skill, or an agent following it, would do. The skills are prose, so behaviour is proven by running them, not by unit tests (ADR-0002 takes the same position for the factory).
- One automated seam: the repository's existing `npm run validate` and `npm test`, which must keep passing, with the new seed files and edited skills accepted by the validator. No new tests are added for prose.
- One smoke seam, run by hand on a sandbox repository:
  - Setup on a GitHub-style repo writes a bug issue form whose required fields are all marked required, and creates the `bug` label.
  - Setup on a local-markdown repo creates the bugs folder and a template file, and leaves existing files untouched.
  - An agent following `diagnosing-bugs` on a seeded bug issue whose `Verify:` goes red runs Phase 1 from that check.
  - On a seeded bug whose `Verify:` does not reproduce, the agent stops, comments with the structure above, and sets `needs-info`.
  - On a bug with no runnable `Verify:`, the agent comments and sets `needs-info` rather than guessing.
- Prior art: `setup-verification` is proven by following its own doc end to end once; the same approach applies.

## Out of Scope

- Any new skill, agent, pipeline, script, or scheduler. Re-running over bugs is left to the automation of the coding agent or agent manager.
- A refine step where an agent rewrites or reinterprets the reporter's claim.
- Changes to `triage`, `implement`, `implement-spec`, `to-tickets`, or the factory, including any new routing of bugs into them.
- Enforcing required fields on GitLab, Jira, or local files beyond marking them in the template.
- Tooling to capture screenshots or video; the template only has a place to attach them.
- Converting existing bug issues to the new template.
- Setting the `bug` label string through the triage label mapping.

## Further Notes

- The design came from a grilling session in which the first proposal (several skills, an agent refine step, routing through triage and implement) was dropped in favour of "the human defines the bug fully and the agent only verifies and fixes". Keep that principle if the template is later extended: never add a field whose job is to let an agent reinterpret the claim.
- The `bug` category role already exists in `triage`; this spec uses it only as the label, not as a new workflow.
