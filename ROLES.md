---
roles:
  scout:
    purpose: fast, cheap reading and searching; quick pass or fail checks against a written standard
    omp: ["@scout", "@smol"]
    claude: haiku
    codex: low
  worker:
    purpose: reliable code changes and test loops
    omp: ["@worker", "@task"]
    claude: inherit
    codex: medium
  thinker:
    purpose: deep reasoning where a wrong answer is expensive; plans, specs, diagnosis, interface design
    omp: ["@thinker", "@slow"]
    claude: opus
    codex: high
  reviewer:
    purpose: strong reasoning, and a different model family from the worker whose change it checks; reviews and verification
    omp: ["@reviewer", "@slow"]
    claude: opus
    codex: high
  coordinator:
    purpose: runs a program of many workers (smode delegation, the factory); steady, cheap, small context, never writes code
    omp: ["@coordinator", "@default"]
    claude: sonnet
    codex: medium
---
# Model roles

Skills never name a model. Work is delegated by **role**, described by what the
work needs, and each project maps the role to models in its own
`docs/agents/roles.md` (ADR-0004). There are five roles; `npm run validate`
fails on any other.

| Role | Needs | Platform agents on it |
|---|---|---|
| scout | fast, cheap reading and searching; quick pass or fail checks | |
| worker | reliable code changes and test loops | `implementer` |
| thinker | deep reasoning: plans, specs, diagnosis, design | `planner` |
| reviewer | strong reasoning, another model family than the worker | `verifier`, `review-standards`, `review-spec` |
| coordinator | runs many workers; steady, cheap, never writes code | |

## The project's roles: `docs/agents/roles.md`

One line per role, its **route**: candidates in order of preference.

```
reviewer: google/gemini-4-hydrogen effort=high via=antigravity, anthropic/claude-opus-5-5 effort=high
```

A candidate is `<provider>/<model>`, where the provider is the model's maker
(`anthropic`, `openai`, `google`, `xai`, `cursor`, …), then options: `effort`
(`low`, `medium`, `high`, `xhigh`, `max`) and `via`, the channel that runs the
model when it is not its maker (`cursor`, `antigravity`). No harness's own ids
appear here: each harness doc of `smode` maps candidates to its tools and skips
the ones it cannot run. A role without a line runs on the session's model.

smode's `setup` playbook writes the file (`setup override` changes one role);
`smode/scripts/roles.mjs check` checks it and `show` prints each candidate with
what the factory's memory knows about it.

## Platform agents

The agents in `software-claude` and `software-omp` (used by factory version 1
and by skills that name an agent) cannot read the project's file, so the
frontmatter above gives each platform a selector:

- **Oh My Pi:** `model:` lists the role first, then a built-in OMP role it
  falls back to (`["@thinker", "@slow"]`). OMP resolves `@thinker` from
  `modelRoles` in the user config when a key of that name exists, else the
  fallback.
- **Claude Code:** `model:` is the alias in the `claude` column (`opus`,
  `sonnet`, `haiku`, `fable`, `inherit`). smode passes the model when it
  delegates, which overrides it.
- **Codex:** custom agents cannot ship in a plugin; the `codex` column is the
  `model_reasoning_effort` smode's setup uses when it generates
  `.codex/agents/<role>.toml` for a project.

`npm run validate` checks that `ROLES.md` holds exactly the five roles, that
every OMP agent names one of them, and that every Claude agent uses an alias.
