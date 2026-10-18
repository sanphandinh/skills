---
description: "TDD: never weaken an existing assertion to make a test pass"
question: "Did this edit loosen, delete, or rewrite an existing test assertion (or its expected value) so that it now matches the implementation, instead of changing the implementation?"
scope: "tool:edit(**/*.{test,spec}.*), tool:edit(**/__tests__/**), tool:edit(**/tests/**), tool:edit(**/test_*.py)"
interruptMode: never
---

Expected values come from the spec or a worked example, not from what the code currently returns.

If an assertion is genuinely wrong, say so, quote the requirement that proves it, and ask the user before editing it.
