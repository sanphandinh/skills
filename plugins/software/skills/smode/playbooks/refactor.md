# Refactor

A change to structure that keeps behaviour: rename, extract, inline, deepen a module, move code.

1. State the behaviour that must not change, and find the tests that pin it. When a part has none, add characterisation tests with the `tdd` skill first, green before the refactor.
2. For an open-ended "make this better", run the `improve-codebase-architecture` skill to find candidates and choose one with the user.
3. For a module's new shape, run the `codebase-design` skill. Name the interface before moving code.
4. Remove dead code before you build on what is left.
5. Make the change in small units, each green: tests and typecheck after every unit, one commit per unit. A mechanical change that fans out across the codebase goes expand, migrate in batches, contract.
6. Migrate every caller of an old interface and delete it in the same change.
7. Run the `review` playbook in a fresh worker. Behaviour stays the same, so verification is the unchanged test suite plus one real run of the affected path.
8. Open the pull request with the `pr` skill.

**Reply:** what changed in structure and what did not change in behaviour, the tests that prove it (measured), the review verdict, and the pull request link.
