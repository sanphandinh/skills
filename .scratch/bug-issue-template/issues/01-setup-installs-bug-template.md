# 01: Setup installs the bug template into the tracker

**What to build:** running `setup-software-context` on a project can install a bug issue template into that project's tracker, so a reporter files every bug in the same shape. GitHub gets an issue form that refuses a bug with a required field empty and applies the `bug` label. GitLab gets a markdown issue template. A local-markdown project gets a bugs folder with a template file to copy. Jira and other trackers get the template text printed for the maintainer to paste. Setup writes no bug doc under `docs/agents/` and adds nothing to the `## Agent skills` block. Existing issue templates in the project are left alone.

The field contract is the spec's: required Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, and Reproduction criteria (at least one checkbox, each with a `Verify:` line an agent runs unattended, red while the bug exists, green after a correct fix); optional Evidence (screenshot or recording for a visual bug, a log or transcript otherwise, or empty), Frequency, Since, Out of scope. A bug is never a spec: no `spec` label, and the local bugs folder holds no `spec.md`.

**Blocked by:** None (can start immediately)

**Status:** closed

**Door:** two-way

- [x] The `setup-software-context` skill has a bug-template section, with one seed template per tracker kind in its folder, next to the existing tracker seeds
  Verify: read the skill and its folder; the section names GitHub, GitLab, local markdown, and Jira/other, and each kind has a seed (or, for Jira/other, printed text)
- [x] On a sandbox repository using the GitHub tracker, setup writes a bug issue form in which Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, and Reproduction criteria are marked required and Evidence, Frequency, Since, and Out of scope are not, and the `bug` label exists
  Verify: run the setup skill on a sandbox GitHub-style repo, open the written form, and check each field's required flag; check the label exists or is created
- [x] On a sandbox repository using the local tracker, setup creates the bugs folder (no `spec.md` in it) and a template file; files already in the repo are untouched
  Verify: run setup on a sandbox repo that already has an issue file and another issue template, then compare the tree before and after
- [x] On a GitLab sandbox the template is written as markdown with the required fields marked in text; on a Jira or other tracker nothing is written and the template is printed
  Verify: run setup on each sandbox and observe the written file or the printed text
- [x] Setup writes no bug doc under `docs/agents/` and the `## Agent skills` block is unchanged
  Verify: after the runs above, list `docs/agents/` and diff `AGENTS.md`
- [x] Every Reproduction criteria item in each template carries a `Verify:` line, and each template states that the line must run without a person and must fail while the bug exists and pass after a fix
  Verify: read each template
- [x] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root

## Handoff

**Delivered:** `setup-software-context` has a Section D (bug issue template) and a "Bug template" write step with one seed per tracker kind next to the tracker seeds: a GitHub issue form (required flags on Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, Reproduction criteria; not on Evidence, Frequency, Since, Out of scope; applies the `bug` label), a GitLab markdown template (required fields marked in text, `/label ~bug`), a local-markdown template, and plain text printed for Jira and other trackers. Setup creates the `bug` label on GitHub and GitLab, writes nothing under `docs/agents/`, changes nothing in the `## Agent skills` block, and never overwrites an existing template or issue file. Every template's Reproduction criteria item carries a `Verify:` line and states it must run without a person and must fail while the bug exists and pass after a fix. The GitHub form parses and its required flags were checked by loading it; the skill was read, not run on a sandbox repo. `npm run validate` and `npm test` pass.
**Interfaces introduced:** seed files `bug-template-github.yml` (installed at `.github/ISSUE_TEMPLATE/bug.yml`), `bug-template-gitlab.md` (`.gitlab/issue_templates/Bug.md`), `bug-template-local.md` (`.scratch/bugs/issues/TEMPLATE.md`), `bug-template-text.md` (printed). Local bug files are `.scratch/bugs/issues/<NN>-<slug>.md` with `**Status:**`, `**Category:** bug`, and a `## Comments` heading at the bottom; a bug is recognised by the `bug` label or by living in that folder. Section headings in every template: Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, Reproduction criteria, Evidence, Frequency, Since, Out of scope.
**Deviations from spec:** none. The local template sits inside `.scratch/bugs/issues/` as the spec says, named `TEMPLATE.md` without a number, so it is not a bug file.
**Decisions:** one question in setup ("install a bug template?", recommended yes), skipped when a bug template already exists; the Jira/other text is a seed file so wording stays in one place; the `bug` label is created even when the triage section is skipped, since it is not part of the label mapping.
**Gotchas:** the GitHub form's description strings are quoted because plain YAML scalars with a colon fail to parse. `diagnosing-bugs` must skip `TEMPLATE.md` when listing the local bugs folder (it has no `<NN>-` prefix).
**For the next ticket:** 02: name Actual behavior, Expected behavior, Reproduction criteria with `Verify:` lines, and Evidence as the fields you depend on; the local claim is `Claimed-by:` and comments go under `## Comments`; ignore `TEMPLATE.md` in the bugs folder. 04: `AGENTS.md` contents list and software plugin version are still to update; this ticket did not touch them.
**Links:** branch `ticket-01-bug-template-setup`
