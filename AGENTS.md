# Personal Skills

Multi-domain agent skills for Claude Code, OpenCode, Antigravity and Cursor (ADR-0006), and for every provider T3 Code runs.
Part of `core` and `software` is derived from mattpocock/skills; see `UPSTREAM.md`.

## Principles

- **Skills are process, context is knowledge.** A skill says how to do something and is the same in every project. Project knowledge (domain, architecture, brand voice, SEO competitors) belongs in that project's `AGENTS.md` and `CONTEXT.*.md`, never in a skill.
- **One session works, the factory delegates.** smode and every skill it runs work in the session that started them, on its model; a skill that uses sub-agents by design runs them on the harness's default sub-agent and the session's model. Only the `factory` delegates by role (`scout`, `worker`, `thinker`, `reviewer`, `coordinator`, defined by its `scripts/roles.mjs`), with each project's `docs/agents/roles.md` mapping roles to models (ADR-0004, ADR-0006). No plugin carries agents (ADR-0005), and no skill names a concrete model.
- **One entry point per domain.** `smode` starts on its own for every software request and routes it to a playbook; every other skill of `software` is user-invoked and runs when smode or a person names it (ADR-0005).
- **Configuration lives in the project.** Every setting a skill reads is a file in the project's `docs/agents/`, committed with the code; a setup skill that writes one also takes `override` to change chosen settings. Nothing is read from a harness's own config except in `harness/` docs and `references/`.
- **Native plugins first, any install works.** Projects install with each agent's own plugin commands at project scope, and this repo adds no tooling that copies skills into projects. A skill still works when another tool (`npx skills add`) copies it into a skills folder, so no skill assumes an install layout: skills are found by name (smode's **Running a skill by name**), never by a path like `plugins/<plugin>/skills/` or a marketplace name; the validator rejects both.
- **Few and precise.** Every extra skill costs context and invites wrong triggers.

## Layout

- `catalog.yaml`: plugins with `platform` (shared, claude) and name `prefix`. Both plugins today are shared.
- `plugins/<domain>/`: shared skills, `skills/<skill>/SKILL.md`, with one manifest per harness that installs plugins: `.claude-plugin/`, `.cursor-plugin/`, `.antigravity-plugin/`, all at one version.
- `plugins/<domain>-claude/`: room for components only Claude Code has (hooks); none today, and never agents.
- `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`: the marketplaces. Antigravity installs a plugin folder; OpenCode reads skills folders (`npx skills add`).
- `PLATFORMS.md`: what each agent supports and how projects install.
- `UPSTREAM.md`: tracked upstream skills, rewrite rules, upstream MIT license.
- `cli/`: `repo.mjs` (list, validate, upstream) and tests.
- `templates/`: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.<domain>.md` for consumer projects.

## Writing a shared skill

1. Frontmatter: `name`, `description`, and optionally `disable-model-invocation`, `argument-hint`, `license`, `compatibility`, `metadata`. Anything else makes it a platform skill. A user-invoked skill that takes an input gets an `argument-hint`, one quoted line (`"[<ticket or spec>]"`; unquoted brackets parse as a list); the mode skill's is `"[<playbook>] <task>"`, and a first word naming a playbook skips routing. The validator checks both.
2. A skill in a plugin that has a mode skill is user-invoked: `disable-model-invocation: true` in `SKILL.md`. Only the mode skill starts on its own. The validator enforces it.
3. Never name an agent's tools. Describe the action: "search the code", "run the tests", "ask the user". The only exceptions are a mode skill's `harness/` docs and a factory's `references/`, whose job is mapping those actions to one harness's or one agent manager's tools (ADR-0003); the validator keeps tool names out of everything else.
4. Refer to other skills by name ("use the `tdd` skill"), never with `/skill` or `$skill`.
5. A skill runs in the project that installed it, so it carries no context of this repository: no citation of its ADRs, specs or tickets (state the rule itself), no path of its layout, and "this project" means the user's. The validator rejects this repository's ADR numbers and install-layout paths.
6. Never choose a model. A skill that needs sub-agents asks for "a read-only sub-agent" or "a sub-agent" and lets the harness doc say which kind, on the session's model, with a fallback to doing the work sequentially; it must still work run by one agent. Delegating by role is the factory's alone, and the validator keeps roles out of the mode skill.
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

- Entry point: `smode` (model-invoked, ADR-0003, ADR-0005, ADR-0006) routes every software request by its signal to one of its 17 playbooks and names it in its first line; invoked as `smode <playbook> <task>`, it runs the named playbook without routing. Entry playbooks: `quick`, `investigation`, `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `plan-ticket`, `ticket`, `spec-run`, `verify`, `review`, `triage`, `pickup`, `retro`, `setup`, `factory`; step playbooks (`plan-ticket`, `verify`, `review`) also run inside other playbooks, as separate steps, and in the factory's workers, returning the objects in `RESULTS.md`. It works alone: it copies the steps into a todo list, runs the skills below at the steps that need them, finds a skill by name through its generated `skills-index.md` (`npm run index`), starts no worker and picks no model, and maps its actions to each harness in `harness/` (`claude-code`, `opencode`, `antigravity`, `cursor`). Its `setup` playbook writes the project's agent docs.
- Every other skill below is user-invoked: smode runs it at a step, or a person invokes it by hand.
- Spec pipeline (idea, grilling, spec, tickets, implement with TDD, review, PR, handoff): `setup-software-context` (also installs the bug issue template into the tracker), `grill-with-docs`, `to-spec`, `to-tickets`; `implement` for one ticket or small work, `implement-spec` for a whole spec with parallel implementers on an integration branch (smode's `spec-run` playbook runs it); `tdd`, `code-review` (two axes, each on its own read-only sub-agent), `pr`.
- Unattended build: `factory` (ADR-0002, ADR-0005, ADR-0006, ADR-0007) is the agent-driven software factory and the only skill that delegates. `setup` writes the project's `docs/agents/factory.md` (converting older `factory-v2.md`, version 1 settings, or a factory with one coordinator for life) and `docs/agents/roles.md` (the model per role, checked by its `scripts/roles.mjs`; `setup override` changes chosen roles), and smoke-tests the agent manager and every provider; `run` schedules a watcher that starts a fresh dispatcher (`DISPATCHER.md`, route `scout`) when the board changed or something is due; the dispatcher claims each approved spec's tickets and standalone tickets and launches one coordinator per ticket (`COORDINATOR.md`, route `coordinator`) in the ticket's own workspace, which takes it through plan, build, check, rework, land and close, each step a fresh worker in that workspace (`WORK-ORDERS.md`) running a smode playbook on the model its role routes to, skipping candidates out of quota; `once` is one dispatcher run, and `pause`, `resume` and `stop` are modes. Every session reaches the agent manager only through the operations in `INTERFACE.md`. Claims, resources (`slot`, scarce resources, `merge`), dues, the dispatcher lock, the run status and quota live in the memory folder outside the repository, written through `scripts/resources.mjs`; `scripts/comments.mjs` reads trusted comments (`MEMORY.md`, default `~/.local/share/factory/<repo>`). A hold is the triage role `ready-for-human` with a brief. Its only reference is `references/t3.md` (T3 Code: candidates, work orders for other providers, the watcher, worktree cleanup). Merge safety is verdict statuses on the exact head commit plus `gh pr merge --match-head-commit`, with Land updating from trunk while holding `merge`. `setup-verification` writes the `docs/agents/verify.md` its verifiers follow.
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
