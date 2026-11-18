# Personal Skills

Multi-domain agent skills shipped as plugins for Claude Code, Codex, and Oh My Pi, and for every provider T3 Code runs.
Part of `core` and `software` is derived from mattpocock/skills; see `UPSTREAM.md`.

## Principles

- **Skills are process, context is knowledge.** A skill says how to do something and is the same in every project. Project knowledge (domain, architecture, brand voice, SEO competitors) belongs in that project's `AGENTS.md` and `CONTEXT.*.md`, never in a skill.
- **Two layers.** Skills and playbooks name a role (`scout`, `worker`, `thinker`, `reviewer`, `coordinator`, defined by smode's `scripts/roles.mjs`); each project maps roles to models in its `docs/agents/roles.md` (ADR-0004). The model is chosen when work is delegated. No plugin carries agents (ADR-0005), and no skill names a concrete model.
- **One entry point per domain.** `smode` starts on its own for every software request and routes it to a playbook; every other skill of `software` is user-invoked and runs when smode or a person names it (ADR-0005).
- **Configuration lives in the project.** Every setting a skill reads is a file in the project's `docs/agents/`, committed with the code; a setup skill that writes one also takes `override` to change chosen settings. Nothing is read from a harness's own config except in `harness/` docs and `references/`.
- **Native plugins first, any install works.** Projects install with each agent's own plugin commands at project scope, and this repo adds no tooling that copies skills into projects. A skill still works when another tool (`npx skills add`) copies it into a skills folder, so no skill assumes an install layout: skills are found by name (smode's **Running a skill by name**), never by a path like `plugins/<plugin>/skills/` or a marketplace name; the validator rejects both.
- **Few and precise.** Every extra skill costs context and invites wrong triggers.

## Layout

- `catalog.yaml`: plugins with `platform` (shared, claude, omp) and name `prefix`. Both plugins today are shared.
- `plugins/<domain>/`: shared skills. `skills/<skill>/SKILL.md` plus `agents/openai.yaml` for Codex.
- `plugins/<domain>-claude/`, `plugins/<domain>-omp/`: room for components only one harness has (hooks, OMP rules); none today, and never agents.
- `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `.omp-plugin/marketplace.json`: one catalog per agent.
- `PLATFORMS.md`: what each agent supports and how projects install.
- `UPSTREAM.md`: tracked upstream skills, rewrite rules, upstream MIT license.
- `cli/`: `repo.mjs` (list, validate, upstream) and tests.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.<domain>.md` for consumer projects, and the Oh My Pi grant keys.

## Writing a shared skill

1. Frontmatter: `name`, `description`, and optionally `disable-model-invocation`, `argument-hint`, `license`, `compatibility`, `metadata`. Anything else makes it a platform skill. A user-invoked skill that takes an input gets an `argument-hint`, one quoted line (`"[<ticket or spec>]"`; unquoted brackets parse as a list); the mode skill's is `"[<playbook>] <task>"`, and a first word naming a playbook skips routing. The validator checks both.
2. A skill in a plugin that has a mode skill is user-invoked: `disable-model-invocation: true` in `SKILL.md` and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Only the mode skill starts on its own. The validator enforces both.
3. Never name an agent's tools. Describe the action: "search the code", "run the tests", "ask the user". The only exceptions are a mode skill's `harness/` docs and a factory's `references/`, whose job is mapping those actions to one harness's or one agent manager's tools (ADR-0003); the validator keeps tool names out of everything else.
4. Refer to other skills by name ("use the `tdd` skill"), never with `/skill` or `$skill`.
5. A skill runs in the project that installed it, so it carries no context of this repository: no citation of its ADRs, specs or tickets (state the rule itself), no path of its layout, and "this project" means the user's. The validator rejects this repository's ADR numbers and install-layout paths.
6. Delegate by role: "give each axis to a sub-agent on the `reviewer` role", with a fallback to the session's model and to doing the work sequentially. The skill must still work run by one agent.
7. A result another step reads is defined once, in smode's `RESULTS.md`; read it as "the result's `<key>`", which the validator checks.
8. A new playbook gets a row in smode's **Playbooks** section; the validator fails on a playbook no row routes to.
9. Put logic that must be exact in `scripts/`, with tests next to it.
10. Skills in non-core domains carry the plugin prefix from `catalog.yaml` (`mkt-`, `seo-`).

After any change:

```bash
npm run validate
npm test
```

## Upstream skills

Skills listed in `UPSTREAM.md` came from mattpocock/skills. Edit them freely; `npm run upstream -- pull <skill>` three-way merges later upstream changes and keeps local edits. Systematic differences (renames, agent-neutral phrasing) belong in `rewrites` in `UPSTREAM.md`, not in hand edits; a one-off change (such as making a skill user-invoked) is a hand edit the merge keeps. Never hand-edit the recorded commits.

## Current contents

`core` (shared): `grilling`, `grill-me` (user-invoked), `handoff` (user-invoked), `wait-what` (user-invoked), `research`, `writing-for-agents`.

`software` (shared):

- Entry point: `smode` (model-invoked, ADR-0003, ADR-0005) routes every software request by its signal to one of its 17 playbooks and names it in its first line; invoked as `smode <playbook> <task>`, it runs the named playbook without routing. Entry playbooks: `quick`, `investigation`, `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `plan-ticket`, `ticket`, `spec-run`, `verify`, `review`, `triage`, `pickup`, `retro`, `setup`, `factory`; step playbooks (`plan-ticket`, `verify`, `review`) also run inside other playbooks and the factory's workers, returning the objects in `RESULTS.md`. It copies the steps into a todo list, runs the skills below at the steps that need them, finds a skill by name through its generated `skills-index.md` (`npm run index`), delegates by role with the model chosen at delegation, and maps actions and role candidates to each harness in `harness/` (`claude-code`, `codex`, `omp`, `t3`). Models per role come from the project's `docs/agents/roles.md` (ADR-0004), written by its `setup` playbook (`setup override` changes chosen roles); `scripts/roles.mjs` checks it and shows each candidate's provider check, quota and last use.
- Every other skill below is user-invoked: smode runs it at a step, or a person invokes it by hand.
- Spec pipeline (idea, grilling, spec, tickets, implement with TDD, review, PR, handoff): `setup-software-context` (also installs the bug issue template into the tracker), `grill-with-docs`, `to-spec`, `to-tickets`; `implement` for one ticket or small work, `implement-spec` for a whole spec with parallel implementers on an integration branch (smode's `spec-run` playbook runs it); `tdd`, `code-review` (two axes, each on a `reviewer`-role sub-agent), `pr`.
- Unattended build: `factory` (ADR-0002, ADR-0005) is the agent-driven software factory. `setup` writes the project's `docs/agents/factory.md` (converting older `factory-v2.md` or version 1 settings) and smoke-tests the agent manager and every provider; `run` makes the session the coordinator, woken on a schedule, that builds every approved spec and standalone ticket through plan, build, check, rework and land, each step a fresh worker running a smode playbook on the model its role routes to, skipping candidates out of quota; `once` does one wake. The coordinator follows `PLAYBOOK.md` and `WORK-ORDERS.md`, reaches the agent manager only through the ten operations in `INTERFACE.md`, and keeps its journal, wiki, results, `providers.md` and `quota.md` outside the repository (`MEMORY.md`, default `~/.local/share/factory/<repo>`). Its only reference is `references/t3.md` (T3 Code, with a watcher thread for wakes). No scripts: merge safety is verdict statuses on the exact head commit plus `gh pr merge --match-head-commit`. `setup-verification` writes the `docs/agents/verify.md` its verifiers follow.
- Large or unclear efforts: `wayfinder` maps decision tickets on the tracker, then hands off to `to-spec`.
- Issue intake: `triage` moves issues and external PRs through the triage roles and writes agent briefs for `ready-for-agent`.
- Design and debugging: `codebase-design`, `domain-modeling`, `improve-codebase-architecture`, `diagnosing-bugs` (on a bug issue it also finds and claims the bug, runs the reporter's `Verify:` lines first, and comments and sets `needs-info` when it cannot fix it).
- Around the build: `prototype` answers a design question with throwaway code before `to-spec`; `wizard` scripts the steps only a human can take (credentials, CI secrets, third-party dashboards, cutovers); `retro` turns a finished session into changes to the agent's environment (checks, coding standards, steering files).
- Project setup: `setup-pre-commit`.

## Agent skills

### Entry point

Start every software request (a question about the code, a bug, a feature, a refactor, a review, a ticket, a spec, a handoff, setup, the factory) by running the `smode` skill before anything else; it routes the request to a playbook and names it in its first line.

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`, committed with the repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, recorded as a `Status:` line in each issue file, each string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.

### Response language

Before writing prose for a person (chat, issue, spec, ticket, brief, PR body), read `docs/agents/response-language.md`. **Reply language:** match-user.
