---
name: wait-what
description: "Stop. That last message did not land: re-pitch it."
disable-model-invocation: true
---

Wait, I don't understand where you've got to here. Re-pitch that: give me a little bit of context. When the reply language is English, use ASD-STE100 Simplified Technical English; otherwise keep short sentences and one idea each. Read `docs/agents/response-language.md` for that language. If the file is missing, use the language of the user's latest message when there is one; otherwise the language of the ticket or spec when it has prose, else the latest human comment on it, else English. Apply the STE rule only when the resolved language is English. Use the ubiquitous language from `GLOSSARY.md` (follow `GLOSSARY-MAP.md` to the right one if the repo has more than one).
