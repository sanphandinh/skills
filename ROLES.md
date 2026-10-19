---
roles:
  scout:
    purpose: fast reading and searching, gathering context for another agent
    omp: "@smol"
    claude: haiku
    codex: low
  worker:
    purpose: implementation, TDD loops, routine edits
    omp: "@task"
    claude: inherit
    codex: medium
  thinker:
    purpose: diagnosis, deep analysis, anything where a wrong answer is expensive
    omp: "@slow"
    claude: opus
    codex: high
  architect:
    purpose: specs, ticket breakdown, interface design
    omp: "@plan"
    claude: opus
    codex: high
  judge:
    purpose: quick pass or fail checks against a written standard
    omp: "@tiny"
    claude: haiku
    codex: low
  reviewer:
    purpose: code review on standards and spec (software)
    custom: true
    omp: ["@reviewer", "@slow"]
    claude: opus
    codex: high
  verifier:
    purpose: proving a change works on the real product, independent of its author (software)
    custom: true
    omp: ["@verifier", "@slow"]
    claude: opus
    codex: high
  writer:
    purpose: drafting copy and articles in the brand voice (marketing, seo)
    custom: true
    omp: ["@writer", "@default"]
    claude: sonnet
    codex: medium
---
# Model roles

Skills never name a model. Agents name a **role**, and each platform maps the
role to a model. Change models in your config, not in this repo.

| Role | Purpose | Oh My Pi | Claude Code | Codex (effort) |
|---|---|---|---|---|
| scout | fast reading and searching | `@smol` | `haiku` | low |
| worker | implementation, TDD loops | `@task` | `inherit` | medium |
| thinker | diagnosis, deep analysis | `@slow` | `opus` | high |
| architect | specs, tickets, interface design | `@plan` | `opus` | high |
| judge | quick pass or fail checks | `@tiny` | `haiku` | low |
| reviewer (custom) | code review | `@reviewer`, falls back to `@slow` | `opus` | high |
| verifier (custom) | proving a change works, not its author | `@verifier`, falls back to `@slow` | `opus` | high |
| writer (custom) | copy and articles | `@writer`, falls back to `@default` | `sonnet` | medium |

The frontmatter above is the machine-readable copy; `npm run validate` checks
that every OMP agent uses a role from it (or a built-in OMP role) and every
Claude agent uses one of `opus`, `sonnet`, `haiku`, `inherit`.

## Oh My Pi

Built-in roles (`default`, `smol`, `slow`, `plan`, `task`, `tiny`, `advisor`,
`web`, `judge`, ...) already exist. Custom roles are any extra key under
`modelRoles`. An agent lists roles in order; OMP uses the first one that
resolves, so an unassigned custom role falls back cleanly:

```yaml
model: ["@reviewer", "@slow"]
```

Assign the custom roles once, in `~/.omp/agent/config.yml`, or per project in
`.omp/config.yml` (project values override yours):

```yaml
modelRoles:
  reviewer: anthropic/claude-opus-5-5:xhigh
  writer: anthropic/claude-sonnet-5-5:high
```

To change one agent without touching its role, use `task.agentModelOverrides`
in the same file.

## Claude Code

Agents take `model: opus | sonnet | haiku | inherit`. Claude-only skills (in a
`-claude` plugin) may also set `model`, `effort`, `context: fork`, and `agent`.

## Codex

Codex custom agents cannot ship in a plugin, so this repo has no Codex agents
yet. Skills that mention an agent fall back to doing the work themselves. The
`codex` column is the `model_reasoning_effort` to use if you add agents under
`.codex/agents/` later.
