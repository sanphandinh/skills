# Response Language

How agents write **user-facing prose** in this repo: chat replies, questions, briefs, and PR bodies when a skill does not override. Domain **terms** still come from `GLOSSARY.md` (see `docs/agents/domain.md`); this file is only the natural language around them.

**Reply language:** match-user

## Values for `Reply language:`

- **match-user** (recommended): use the language of the user's latest message. If they mix languages, use the language of the first sentence of the message.
- **match-user** with no live user message (unattended factory runs): use the language of the ticket or spec when it has prose; if it has none, the language of the most recent human comment on it; if none, English.
- **Fixed language**: a BCP 47 tag such as `en` or `vi` for all user-facing prose, even when the user writes another language.

Issue titles, spec prose, ticket bodies, and pull request text follow the same rule unless a skill or ADR says otherwise.

## Skill overrides

A skill that sets its own style (for example `wait-what`) wins on **style**. This file still sets **language**. When a style skill is English-only, it applies only when the reply language is English.

## Keep untranslated

Regardless of reply language, leave unchanged:

- Paths, symbol names, commands, config keys, and environment variables
- Code and quoted literals from the repo
- Exact triage label strings and structured lines such as `Tracker:`, `Status:`, and other `Key:` lines in `docs/agents/`
- Glossary **terms** as spelled in `GLOSSARY.md` (explain them in the reply language; do not rename the term)

## When to read this

After `AGENTS.md`, read this file before writing prose for a person. Purely mechanical work (tests, refactors, structured tracker fields) can skip it unless the step also drafts human-readable text. If this file is missing, default to `match-user` (including the unattended rules above).
