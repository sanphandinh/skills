# Retro

Turn a finished session into changes to the agent's environment, so the same mistake costs less next time.

1. Run the `retro` skill on the session the user names, or on this one.
2. For each mistake it finds, prefer the change that enforces itself: a check, a lint rule, a test, a script. Write a rule in prose only for a judgement call no check could make.
3. When a mistake came from a skill or a playbook, name the file and the change it needs, following the `writing-for-agents` skill. Edit it only when that file is part of this project's checkout; an installed copy is replaced on the next update, so otherwise report the change for the skill's own repository.
4. Present the candidates in order of severity and apply the ones the user accepts.

**Reply:** the candidates by severity, the changes applied with their links, and the ones declined.
