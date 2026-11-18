# Quick

A small request a person would just answer or do: a question a few reads settle, or a change of a few lines that changes no visible behaviour (a typo, a comment, a doc line, a setting the user named). No todo list, no fresh worker, no verify or review playbook.

**Limits.** Every one holds, or this is the wrong playbook:

- an answer from at most three files or commands read, or a change to at most two files and about twenty lines;
- nothing a user or a caller can observe changes, and no test is added, removed or edited;
- nothing on the always-pause list.

1. Restate the goal in one sentence.
2. Do it. For a question, read the source and answer with the file and line. For a change, make it and run the narrowest check that covers it (the one test file, the typecheck, the linter, the project's validator).
3. The moment a limit breaks, stop and switch: a question that needs more reading goes to `investigation`, a defect to `bug-fix`, a change in behaviour to `feature`, a change in structure to `refactor`. Say `Playbook: quick → <name> (<the limit that broke>)`, then run that playbook from its first step, keeping what you learned.

**Reply:** the answer or the change in a few lines, with its evidence (the file and line, or the check you ran and its result, labelled measured), and the playbook you switched to, if you did.
