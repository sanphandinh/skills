---
name: factory
description: "Agent-driven software factory: set up a project, then run a coordinator agent that builds approved specs through an agent manager."
disable-model-invocation: true
argument-hint: "setup"
---

# Factory

The factory builds approved specs from the issue tracker, with a person in the loop only for real decisions. A **coordinator** agent decides, delegates and records; **workers**, fresh agent sessions each in a workspace the agent manager created, read and write code.

The factory reaches the agent manager only through the operations in [INTERFACE.md](INTERFACE.md). How each operation runs on one manager is in that manager's reference under `references/`; read only the reference `docs/agents/factory.md` names on its `Manager:` line.

## Modes

- `setup`: prepare this project for the factory and prove it with a smoke test. Follow [SETUP.md](SETUP.md).

With no mode given, ask which one.
