# Personal Skills

Agent skills for Claude Code, OpenCode, Antigravity and Cursor, and for every provider T3 Code runs. Each harness installs them per project with its own tools: plugins on Claude Code, Cursor and Antigravity, the skills folder on OpenCode. There are two plugins: `core` (cross-domain process skills) and `software` (`smode`, the software skills, and the factory).

- [PLATFORMS.md](PLATFORMS.md): what each agent supports and how to install in a project.
- [UPSTREAM.md](UPSTREAM.md): syncing the skills derived from mattpocock/skills.
- [AGENTS.md](AGENTS.md): rules for writing skills in this repo.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.software.md` for a project.

## Start here: `smode`

Every software request starts in `smode` on its own: ask for what you want ("fix the failing login test", "review PR 12", "build ticket 03"), and it routes the request to a playbook, says which one in its first line, and runs this repo's skills at the steps that need them, in your session and on its model, on Claude Code, OpenCode, Antigravity, Cursor or inside T3 Code. The other software skills start only when smode or you name them. Run `smode setup` once per project to write its agent docs. See ADR-0003, ADR-0005 and ADR-0006.

## The pipeline

A human takes part at three points. First, the problem goes through `grill-with-docs` and `to-spec` until the spec, with its test seams, is approved, and `to-tickets` splits it into tickets whose acceptance criteria each carry a `Verify:` line. Second, the human answers the factory's briefs: a product question a plan raised, a one-way door, a protected path, anything stuck. Third, the human reviews only the pull requests the merge policy holds.

In between, the `factory` skill runs a coordinator agent inside an agent manager (T3 Code). It takes each ticket through plan (a `plan` worker settles the design before any code), build (a fresh `build` worker, test-first), check (an independent `verify` worker that drives the real product per `docs/agents/verify.md`, and a `review` worker on the Spec and Standards axes, each verdict a commit status on the exact head commit), rework, and an automatic merge when every gate in `docs/agents/merge-policy.md` holds. Every worker runs a `smode` playbook on the model its role routes to, skipping providers that are out of quota. Each merged ticket leaves a handoff for the tickets it unblocks, and the coordinator keeps a journal and a wiki of lessons outside the repository. See [PLATFORMS.md](PLATFORMS.md#running-the-factory).

## Work on this repo

```bash
npm install
npm run validate
npm run index
npm test
npm run list
npm run upstream -- status
```

Run `npm run index` after adding, removing or renaming a skill, when `npm run validate` reports "skills index is stale; run `npm run index`": it regenerates the `skills-index.md` of every mode skill.

## Release notes

### software 0.12.0, core 0.6.0 (ADR-0006)

- **Four harnesses.** Claude Code, OpenCode, Antigravity and Cursor, each with a smode harness doc. Cursor and Antigravity get plugin manifests (`.cursor-plugin/`, `.antigravity-plugin/`) and Cursor a marketplace; OpenCode reads the skills `npx skills add … -a opencode` puts in `.agents/skills/`. See `PLATFORMS.md`.
- **OMP and Codex are gone**: their harness docs, manifests, catalogs, every `agents/openai.yaml`, and the OMP grant template.
- **smode works alone.** It starts no worker and picks no model; `verify` and `review` run as separate steps in the same session, starting again from the ticket and the diff. Skills that use sub-agents (`code-review`, `implement-spec`, `research`) run them on the harness's default sub-agent and the session's model.
- **Roles are the factory's.** `docs/agents/roles.md`, its template and `roles.mjs` moved to the `factory` skill; `factory setup` writes the file and `factory setup override` changes chosen roles. smode's `setup` playbook no longer asks for roles. An existing `roles.md` keeps working; only its first paragraph names the factory now.

Remove the OMP and Codex installs, then update:

```bash
omp plugin uninstall core@sanphan-skills --scope project
omp plugin uninstall software@sanphan-skills --scope project
claude plugin update core@sanphan-skills
claude plugin update software@sanphan-skills
```

For Codex, delete the `[plugins."core@sanphan-skills"]` and `[plugins."software@sanphan-skills"]` tables from the project's `.codex/config.toml`. On Oh My Pi, the `smode-<repo>-*` grant keys and `task.perCallModel` in `~/.omp/agent/config.yml` are no longer needed.

### software 0.11.0 (ADR-0005)

- **One factory.** `factory-v2` is now the `factory` skill in the `software` plugin. The `factory` plugin, factory version 1 and its Orca reference are gone. In each project that ran the factory, run `factory setup`: it renames `docs/agents/factory-v2.md` to `docs/agents/factory.md` and keeps its memory, or, for version 1 settings, proposes new ones and upgrades the memory folder in place. A watcher scheduled before this release sends the old wake prompt: run `factory run` again to replace it.
- **No platform agents.** `software-claude` and `software-omp` are gone, with their agents and the OMP TDD rules; `ROLES.md` is gone. Models per role come only from the project's `docs/agents/roles.md`.
- **smode is the entry point.** It starts on its own; every other software skill is user-invoked.
- **Any install.** smode finds a skill by name: next to its own folder, then the harness's skills folders and installed plugins (any marketplace), then up from its folder in a checkout. Skills copied by `npx skills add` work the same as plugins (`PLATFORMS.md`, **Without plugins**). The factory's T3 wake prompt now always reads `factory/SKILL.md` by path.
- **Arguments.** `smode` takes `[<playbook>] <task>`: a first word that names a playbook (`/smode bug-fix the list prints 0 skills`) runs that playbook without routing. Every user-invoked skill that takes an input shows a hint for it (`code-review`, `implement`, `to-tickets`, `triage`, `diagnosing-bugs` and others); `core` 0.5.1 adds one to `grill-me`.

Remove the old plugins from each project, then update `software`:

```bash
claude plugin uninstall factory@sanphan-skills --scope project
claude plugin uninstall software-claude@sanphan-skills --scope project
omp plugin uninstall factory@sanphan-skills --scope project
omp plugin uninstall software-omp@sanphan-skills --scope project
claude plugin update software@sanphan-skills
omp plugin upgrade software@sanphan-skills
```

For Codex, delete the `[plugins."factory@sanphan-skills"]` table from the project's `.codex/config.toml`. Plugins installed at user scope are removed the same way without `--scope project`. On Oh My Pi, plain role keys (`thinker`, `worker`, `reviewer`) left in `~/.omp/agent/config.yml` for the old agents are no longer read; smode's `setup` offers to remove them.
