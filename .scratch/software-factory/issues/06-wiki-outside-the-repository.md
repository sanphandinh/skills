# 06: Keep a wiki of decisions and lessons outside the repository

**What to build:** setup creates the wiki folder at the location in `factory.md`, outside the repository, with an index and local git history. The coordinator reads the index on every wake, writes one journal line per wake, records lessons from worker results and from its own observations as dated entries with citations, checks a code-related entry's citation before relying on it and appends a correction when it no longer holds, and lints the wiki weekly.

**Blocked by:** 03

**Status:** closed

**Door:** two-way

- [x] The wiki lives outside the repository and keeps its history.
  Verify: after setup, the folder exists at the configured location with an index and a git log; `git status` in the project repository shows nothing new.
- [x] A lesson reported by a worker becomes a dated, cited entry linked from the index.
  Verify: a sandbox worker result with one lesson; read the wiki after the next wake.
- [x] An entry whose citation no longer holds is corrected, not deleted.
  Verify: change the code an entry cites; the next wake that uses the entry appends a correction and marks the old entry superseded.
- [x] Only the coordinator writes the wiki, and a weekly lint runs on a timeout wake.
  Verify: the wiki's git log shows only coordinator commits; with the last lint dated eight days back, the next timeout wake writes a lint entry.

## Handoff

**Delivered:** the memory folder `~/.local/share/factory/factory-sandbox` (outside the repo, own git history: one commit per wake, 40+ commits). Worker lessons became dated, cited entries on `wiki/code.md`, `wiki/tests-and-ci.md`, `wiki/github.md`, `wiki/orca.md`, all listed in the index. Entries that stopped holding were marked `(superseded <date>)` with a correction (e.g. the CI-delay and the prototype-lookup bug entries). With the last lint backdated to 2026-10-20, an idle wake on 2026-11-03 ran the lint, merged duplicates in `tests-and-ci.md` and moved the lint date.
**Interfaces introduced:** `index.md` (status, `orca-run`, `orca-wake`, last lint, pages), `journal.md`, `wiki/<topic>.md`, `results/`.
**Deviations from spec:** lint runs on a wake with no worker event, since scheduled wakes replaced timeout wakes.
**Gotchas:** none.
**For the next ticket:** 08: Ody gets its own folder, `~/.local/share/factory/Ody-drive`.
