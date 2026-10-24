---
description: "TDD: do not skip, focus, or disable tests to get a green run"
condition: '\b(it|test|describe)\.(skip|only|todo)\(|\bx(it|test|describe)\(|@pytest\.mark\.skip|\bt\.Skip\('
scope: "tool:edit(**/*), tool:write(**/*)"
interruptMode: tool-only
---

A failing test is information. Skipping or focusing tests hides it.

- Fix the implementation until the test passes, or explain to the user why the test itself is wrong and ask before changing it.
- `.only` left in a suite silently disables every other test in CI.
