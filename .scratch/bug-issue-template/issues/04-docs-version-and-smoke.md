# 04: Docs, plugin version, and end-to-end smoke

**What to build:** the repository's docs and metadata describe the bug issue template, and the whole spec is proven end to end once. `AGENTS.md`'s contents list mentions the bug template in `setup-software-context` and the bug-issue behaviour in `diagnosing-bugs`. The `software` plugin version is bumped everywhere it is recorded. Then the five smoke scenarios from the spec are run by hand on a sandbox repository, against the skills as merged on the integration branch.

**Blocked by:** 01, 03

**Status:** ready-for-agent

**Door:** two-way

- [ ] `AGENTS.md` mentions the bug template in `setup-software-context` and the bug-issue behaviour in `diagnosing-bugs`, in the existing contents list, without a new skill entry
  Verify: read `AGENTS.md`; both mentions exist and no new skill is listed
- [ ] The `software` plugin version is bumped consistently in every plugin manifest and marketplace file that records it
  Verify: search the repository for the old version string next to the `software` plugin; none remains, and every recorded value is the same new one
- [ ] `npm run validate` and `npm test` pass
  Verify: run both commands from the repository root
- [ ] Smoke 1: setup on a GitHub-style sandbox writes a bug issue form with the right required fields and creates the `bug` label
  Verify: run setup on the sandbox and read the form; record the result in the ticket's `## Comments`
- [ ] Smoke 2: setup on a local-markdown sandbox creates the bugs folder and a template file and leaves existing files untouched
  Verify: run setup and compare the tree; record the result in `## Comments`
- [ ] Smoke 3: an agent following `diagnosing-bugs` on a seeded bug whose `Verify:` goes red runs Phase 1 from that check
  Verify: run it and record the agent's output in `## Comments`
- [ ] Smoke 4: on a seeded bug whose `Verify:` does not reproduce, the agent stops, comments with the structure, and sets `needs-info`
  Verify: run it and record the comment and status in `## Comments`
- [ ] Smoke 5: on a bug with no runnable `Verify:`, the agent comments and sets `needs-info` instead of guessing
  Verify: run it and record the comment and status in `## Comments`
- [ ] The sandbox repositories and any seeded bug files are removed afterwards and none is left in this repository
  Verify: list the repository's untracked files; no sandbox or seeded bug remains
