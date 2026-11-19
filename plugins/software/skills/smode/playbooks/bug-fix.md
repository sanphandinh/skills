# Bug fix

A reported defect: reproduce it, find its root cause, fix it there, and prove the fix.

1. Run the `diagnosing-bugs` skill. On a bug issue it finds and claims the bug and runs the reporter's `Verify:` lines first; when it cannot reproduce the reporter's symptom, it takes its cannot-fix-yet path and this playbook ends there.
2. Reproduce on the same surface the reporter used, before reading code for a cause. A red reproduction (a test, a command, a script) is the feedback loop every later step reruns.
3. Trace the symptom back to the first place the system went wrong, following the skill's phases. A guard that hides the state is a fix only when that state is legitimate.
4. When two fixes built on one premise have failed, write the premise down and test it directly before a third.
5. On a new branch from trunk (never on trunk itself), fix test-first with the `tdd` skill: the reproduction becomes the regression test, red before the fix, green after.
6. Run the whole test suite and the typecheck.
7. Run the `verify` playbook, then the `review` playbook, each as a separate step on the fix's head commit. Fix the blocking findings and repeat.
8. Open the pull request with the `pr` skill. Merging is an always-pause act.

Step 7 is never skipped, however small the fix: the author's own checks are not a verdict.

**Reply:** the symptom, the root cause with its file and line, the fix, the reproduction before and after (measured), the verify and review verdicts with their commit, and the pull request link.
