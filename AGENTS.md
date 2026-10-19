# Personal Skills

Multi-domain agent skills shipped as plugins for Claude Code, Codex, and Oh My Pi.
Part of `core` and `software` is derived from mattpocock/skills; see `UPSTREAM.md`.

## Principles

- **Skills are process, context is knowledge.** A skill says how to do something and is the same in every project. Project knowledge (domain, architecture, brand voice, SEO competitors) belongs in that project's `AGENTS.md` and `CONTEXT.*.md`, never in a skill.
- **Three layers.** Skills (shared, portable) name agents; agents (per platform) name roles; roles (`ROLES.md`) map to models in the user's config. Never write a concrete model into a skill or agent.
- **Native plugins only.** Projects install with each agent's own plugin commands at project scope. Do not add tooling that copies skills into projects.
- **Few and precise.** Every extra skill costs context and invites wrong triggers.

## Layout

- `catalog.yaml`: plugins with `platform` (shared, claude, omp) and name `prefix`.
- `plugins/<domain>/`: shared skills. `skills/<skill>/SKILL.md` plus `agents/openai.yaml` for Codex.
- `plugins/<domain>-claude/`: Claude Code agents and Claude-only components.
- `plugins/<domain>-omp/`: Oh My Pi agents, rules, commands, tools, extensions. Needs `.omp-plugin/plugin.json`.
- `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `.omp-plugin/marketplace.json`: one catalog per agent.
- `ROLES.md`: logical roles and their mapping per platform (frontmatter is machine-read).
- `PLATFORMS.md`: what each agent supports and how projects install.
- `UPSTREAM.md`: tracked upstream skills, rewrite rules, upstream MIT license.
- `cli/`: `repo.mjs` (list, validate, upstream) and tests.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.<domain>.md` for consumer projects.

## Writing a shared skill

1. Frontmatter: `name`, `description`, and optionally `disable-model-invocation`, `argument-hint`, `license`, `compatibility`, `metadata`. Anything else makes it a platform skill.
2. A user-invoked skill also sets `policy.allow_implicit_invocation: false` in `agents/openai.yaml`.
3. Never name an agent's tools. Describe the action: "search the code", "run the tests", "ask the user".
4. Refer to other skills by name ("use the `tdd` skill"), never with `/skill` or `$skill`.
5. Refer to agents by name with a fallback: "if a `review-spec` agent is available, ...; otherwise ...". The skill must still work run sequentially by one agent.
6. Put logic that must be exact in `scripts/`, with tests next to it.
7. Skills in non-core domains carry the plugin prefix from `catalog.yaml` (`mkt-`, `seo-`).

## Writing a platform agent

- OMP: `plugins/<domain>-omp/agents/<name>.md`, `model:` a list of roles from `ROLES.md` with a built-in fallback (`["@reviewer", "@slow"]`), plus `tools`, `thinking-level`, and an `output` schema when another step reads the result.
- Claude Code: `plugins/<domain>-claude/agents/<name>.md`, `model:` the alias `ROLES.md` gives for that role.
- Use the same agent name on every platform so shared skills can refer to it once.

After any change:

```bash
npm run validate
npm test
```

## Upstream skills

Skills listed in `UPSTREAM.md` came from mattpocock/skills. Edit them freely; `npm run upstream -- pull <skill>` three-way merges later upstream changes and keeps local edits. Systematic differences (renames, agent-neutral phrasing) belong in `rewrites` in `UPSTREAM.md`, not in hand edits. Never hand-edit the recorded commits.

## Current contents

`core` (shared): `grilling`, `grill-me` (user-invoked), `handoff` (user-invoked), `wait-what` (user-invoked), `research`, `writing-for-agents`.

`software` (shared):

- Factory pipeline (idea, grilling, spec, tickets, implement with TDD, review, PR, handoff): `setup-software-context`, `grill-with-docs`, `to-spec`, `to-tickets` (user-invoked); `implement` for one ticket or small work, `implement-spec` for a whole spec with parallel implementers on an integration branch (both user-invoked); `tdd`, `code-review`, `pr`.
- Large or unclear efforts: `wayfinder` (user-invoked) maps decision tickets on the tracker, then hands off to `to-spec`.
- Issue intake: `triage` (user-invoked) moves issues and external PRs through the triage roles and writes agent briefs for `ready-for-agent`.
- Design and debugging: `codebase-design`, `domain-modeling`, `improve-codebase-architecture` (user-invoked), `diagnosing-bugs`.
- Project setup: `frontend-web-project-setup`, `portless-web-project-setup`, `setup-pre-commit`, `github-repo-setup`.

`software-claude`: agents `review-standards`, `review-spec` (opus).

`software-omp`: agents `review-standards`, `review-spec` (`@reviewer` falling back to `@slow`, typed output); rules `tdd-no-skipped-tests` (interrupts on skip/only), `tdd-no-weakened-assertions` (judge question on test edits).

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`, committed with the repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, recorded as a `Status:` line in each issue file, each string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
