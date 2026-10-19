---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up, or write a finished ticket's handoff onto the tracker.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows) - not the current workspace.

Include a "suggested skills" section in the document, naming which skills the next agent should use.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

## Ticket mode

When the user names a ticket, or the work is a ticket that just finished, write the handoff onto the ticket instead of the temp directory, so the next person on another machine can read it. Use the handoff template and placement from the issue-tracker doc (`docs/agents/issue-tracker.md`); if the tracker doc has no handoff template, post the same sections as a comment on the ticket. Fill "For the next ticket" from the tickets this one blocks. Leave out "suggested skills" in this mode.
