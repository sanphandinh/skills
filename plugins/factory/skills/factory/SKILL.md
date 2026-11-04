---
name: factory
description: "Agent-driven software factory: set up a project, then run a coordinator agent that builds approved specs through an agent manager."
disable-model-invocation: true
argument-hint: "setup | run | once"
---

# Factory

The factory builds approved specs from the issue tracker, with a person in the loop only for real decisions. A **coordinator** agent decides, delegates and records; **workers**, fresh agent sessions each in a workspace the agent manager created, read and write code.

The factory reaches the agent manager only through the operations in [INTERFACE.md](INTERFACE.md). How each operation runs on one manager is in that manager's reference under `references/`; read only the reference `docs/agents/factory.md` names on its `Manager:` line.

## Modes

- `setup`: prepare this project for the factory and prove it with a smoke test. Follow [SETUP.md](SETUP.md).
- `run`: start the factory and leave it running. Do schedule-wakes for the main checkout, every `Wake timeout`, with the prompt `/skill:factory once`, report that the factory is running and in which session, and end your turn. From then on the scheduled session is the coordinator: each wake it receives is a `once`. Follow [PLAYBOOK.md](PLAYBOOK.md), with [WORK-ORDERS.md](WORK-ORDERS.md) for every worker started and [MEMORY.md](MEMORY.md) for the journal and the lessons. To stop the factory, a person tells the coordinator "stop", which cancels the scheduled wakes.
- `once`: do exactly one wake of the playbook, report it, and stop. The scheduled wakes of `run` send this; on its own it lets a person watch one wake.

With no mode given, ask which one. `run` and `once` need `docs/agents/factory.md`; without it, run `setup` first.
