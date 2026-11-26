# Investigation

A read-only question: how does X work, why is Y built this way, are we sure about Z, should we do X or Y. The deliverable is a cited answer, not a change. Change no file and make no commit, except the notes file the `research` skill writes.

1. Write the question down as one sentence, with what would count as an answer.
2. Read `GLOSSARY.md` and the ADRs in the area, if they exist, so the answer uses the project's terms.
3. Find the code, docs or history that own the answer. Read the source, not a summary of it. For a large area, read it part by part and note what each part answers.
4. For a fact outside the repository (a library, an API, a standard), run the `research` skill: open its `SKILL.md` as **Running a skill by name** in smode says, and let it decide how to read the sources. Looking the fact up yourself instead is a deviation to report.
5. When the question is "should we do X or Y" and running something would settle it, run the `prototype` skill instead of guessing.
6. Check the answer against one concrete case: a test, a command, a call site.
7. Check `git status`: nothing changed but the `research` notes file.
8. Answer.

**Reply:** the answer first, in one or two sentences. Then the evidence: each claim with its file and line, command output, or link, and its label (measured, inferred, guessed). Then what stays open, if anything.
