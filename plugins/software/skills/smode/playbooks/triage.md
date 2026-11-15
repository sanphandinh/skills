# Triage

Move new issues and outside pull requests through the triage roles until each one is ready for an agent, waiting on its reporter, or declined.

1. Run the `triage` skill. With no issue named, it shows what needs attention; with one named, it gathers context, checks for an existing implementation and a prior rejection, and recommends a category and state.
2. Verify the claim before any grilling: reproduce a bug from the reporter's steps, or check out a pull request and run what it claims to fix. A bug issue that has the bug template goes through the `diagnosing-bugs` skill's intake instead.
3. When a request needs shaping, the `triage` skill grills it with the `grilling` and `domain-modeling` skills, a round of questions at a time.
4. Apply the outcome the maintainer agrees to: the label, the triage notes, and for `ready-for-agent` an agent brief a fresh agent can build from.

**Reply:** each issue or pull request handled, its new state, and the brief or the question left for its reporter.
