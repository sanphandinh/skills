# 01: Setup installs the bug template into the tracker

**What to build:** running `setup-software-context` on a project can install a bug issue template into that project's tracker, so a reporter files every bug in the same shape. GitHub gets an issue form that refuses a bug with a required field empty and applies the `bug` label. GitLab gets a markdown issue template. A local-markdown project gets a bugs folder with a template file to copy. Jira and other trackers get the template text printed for the maintainer to paste. Setup writes no bug doc under `docs/agents/` and adds nothing to the `## Agent skills` block. Existing issue templates in the project are left alone.

The field contract is the spec's: required Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, and Reproduction criteria (at least one checkbox, each with a `Verify:` line an agent runs unattended, red while the bug exists, green after a correct fix); optional Evidence (screenshot or recording for a visual bug, a log or transcript otherwise, or empty), Frequency, Since, Out of scope. A bug is never a spec: no `spec` label, and the local bugs folder holds no `spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] The `setup-software-context` skill has a bug-template section, with one seed template per tracker kind in its folder, next to the existing tracker seeds
  Verify: read the skill and its folder; the section names GitHub, GitLab, local markdown, and Jira/other, and each kind has a seed (or, for Jira/other, printed text)
- [ ] On a sandbox repository using the GitHub tracker, setup writes a bug issue form in which Summary, Actual behavior, Expected behavior, Steps to reproduce, Environment, and Reproduction criteria are marked required and Evidence, Frequency, Since, and Out of scope are not, and the `bug` label exists
  Verify: run the setup skill on a sandbox GitHub-style repo, open the written form, and check each field's required flag; check the label exists or is created
- [ ] On a sandbox repository using the local tracker, setup creates the bugs folder (no `spec.md` in it) and a template file; files already in the repo are untouched
  Verify: run setup on a sandbox repo that already has an issue file and another issue template, then compare the tree before and after
- [ ] On a GitLab sandbox the template is written as markdown with the required fields marked in text; on a Jira or other tracker nothing is written and the template is printed
  Verify: run setup on each sandbox and observe the written file or the printed text
- [ ] Setup writes no bug doc under `docs/agents/` and the `## Agent skills` block is unchanged
  Verify: after the runs above, list `docs/agents/` and diff `AGENTS.md`
- [ ] Every Reproduction criteria item in each template carries a `Verify:` line, and each template states that the line must run without a person and must fail while the bug exists and pass after a fix
  Verify: read each template
- [ ] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root
