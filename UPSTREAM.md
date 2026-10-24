---
repo: https://github.com/mattpocock/skills
remote: upstream
branch: main
rewrites:
  - from: setup-matt-pocock-skills
    to: setup-software-context
  - from: Setup Matt Pocock's Skills
    to: Setup Software Context
  - from: Setup Matt Pocock Skills
    to: Setup Software Context
  - pattern: Call the Skill tool twice, for "([a-z0-9-]+)" and "([a-z0-9-]+)"
    replace: Use the `$1` and `$2` skills
  - pattern: call the Skill tool twice, for "([a-z0-9-]+)" and "([a-z0-9-]+)"
    replace: use the `$1` and `$2` skills
  - pattern: calls the Skill tool with [`"]([a-z0-9-]+)[`"]
    replace: uses the `$1` skill
  - pattern: calling the Skill tool with [`"]([a-z0-9-]+)[`"]
    replace: using the `$1` skill
  - from: call the Skill tool for whichever skills
    to: use whichever skills
  - pattern: the result of /([a-z][a-z0-9-]+) and /([a-z][a-z0-9-]+)
    replace: the result of the `$1` and `$2` skills
    skillGroups:
      - 1
      - 2
  - pattern: Call the Skill tool with [`"]([a-z0-9-]+)[`"]
    replace: Use the `$1` skill
  - pattern: call the Skill tool with [`"]([a-z0-9-]+)[`"]
    replace: use the `$1` skill
  - from: should call the Skill tool for
    to: should use
  - pattern: "`/([a-z][a-z0-9-]+)` skill"
    replace: "`$1` skill"
    skillGroups:
      - 1
  - pattern: \b([Tt]he) `/([a-z][a-z0-9-]+)`
    replace: $1 `$2` skill
    skillGroups:
      - 2
  - pattern: "`/([a-z][a-z0-9-]+)`"
    replace: the `$1` skill
    skillGroups:
      - 1
  - pattern: \b([Uu]se) /([a-z][a-z0-9-]+)\b
    replace: $1 the `$2` skill
    skillGroups:
      - 2
ignore: []
skills:
  grilling:
    path: skills/productivity/grilling
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  grill-me:
    path: skills/productivity/grill-me
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  handoff:
    path: skills/productivity/handoff
    commit: 49dd158d1076134a641b33efb035946536778336
  research:
    path: skills/engineering/research
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  writing-for-agents:
    path: skills/productivity/writing-for-agents
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  setup-software-context:
    path: skills/engineering/setup-matt-pocock-skills
    commit: 49dd158d1076134a641b33efb035946536778336
  to-spec:
    path: skills/engineering/to-spec
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  to-tickets:
    path: skills/engineering/to-tickets
    commit: 49dd158d1076134a641b33efb035946536778336
  implement:
    path: skills/engineering/implement
    commit: 49dd158d1076134a641b33efb035946536778336
  tdd:
    path: skills/engineering/tdd
    commit: 49dd158d1076134a641b33efb035946536778336
  codebase-design:
    path: skills/engineering/codebase-design
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  code-review:
    path: skills/engineering/code-review
    commit: 49dd158d1076134a641b33efb035946536778336
  diagnosing-bugs:
    path: skills/engineering/diagnosing-bugs
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  domain-modeling:
    path: skills/engineering/domain-modeling
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  grill-with-docs:
    path: skills/engineering/grill-with-docs
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  implement-spec:
    path: skills/engineering/implement-spec
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  wayfinder:
    path: skills/engineering/wayfinder
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  pr:
    path: skills/engineering/pr
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  improve-codebase-architecture:
    path: skills/engineering/improve-codebase-architecture
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  wait-what:
    path: skills/productivity/wait-what
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  setup-pre-commit:
    path: skills/misc/setup-pre-commit
    commit: 24fe0ef7737efae15c87225755e9f6f5965e4888
  triage:
    path: skills/engineering/triage
    commit: 49dd158d1076134a641b33efb035946536778336
---
# Upstream: mattpocock/skills

Part of `plugins/core` and `plugins/software` is derived from
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT). The frontmatter
above is the machine-readable record that `cli/repo.mjs upstream` reads
and updates. Do not edit `skills.*.commit` by hand.

## How a tracked skill differs from upstream

Every upstream copy, at import and at each pull, goes through the same small
pipeline, and the layout stays exactly as upstream ships it (`SKILL.md` with
its frontmatter, `agents/openai.yaml` for Codex):

1. **Rename.** Only the `name:` line of `SKILL.md` changes to the local name;
   the rest of the frontmatter stays byte-identical to upstream.
2. **Rewrite.** The `rewrites` rules above run over every text file, in order.
   They turn agent-specific phrasing ("call the Skill tool with", `/skill`) into
   plain references by name, and apply renames. A rule with `skillGroups: [n]`
   fires only when capture `n` names a skill (one in this repo, or a skill
   folder upstream), so paths like `/tmp` and harness commands like `/clear`
   stay as written.

Hand edits on top of that (for example `setup-software-context` writing to
`AGENTS.md` instead of choosing between `CLAUDE.md` and `AGENTS.md`) are local
changes that the three-way merge preserves.

## Re-syncing from upstream

```bash
npm run upstream -- status          # what changed upstream, what is new
npm run upstream -- pull tdd        # three-way merge one skill
npm run upstream -- pull --all      # every changed skill
npm run upstream -- add skills/engineering/prototype software
```

`pull` merges each file with base = upstream at the recorded commit, ours = the
local file, theirs = upstream head, both upstream sides renamed and rewritten
first. Clean merges are written in place; overlapping edits leave git-style
conflict markers, which `npm run validate` reports until resolved. Do it on a
branch and review the diff before committing.

When a systematic change keeps conflicting, add a `rewrites` rule instead of
editing by hand. To stop `status` listing an upstream skill you decided not to
take, add its path under `ignore`.

## License

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Other sources

`plugins/software/skills/setup-verification` adapts `create-verification-skill`
from [cursor/plugins `pstack`](https://github.com/cursor/plugins/tree/main/pstack),
and the `autopilot` skill borrows pstack's ideas of independent verifiers,
patch-bound verdicts, and decision trails. It is not tracked by the upstream
tool.

```
MIT License

Copyright (c) 2026 Lauren Tan
```

The full MIT text is the same as the license above.
