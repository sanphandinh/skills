---
name: factory
description: "Agent-driven software factory: a coordinator builds approved specs through an agent manager, each worker step a smode playbook on the model its role routes to."
disable-model-invocation: true
argument-hint: "setup | setup override | run | once"
---

# Factory

The factory builds approved specs from the issue tracker, with a person in the loop only for real decisions. A **coordinator** agent decides, delegates and records; **workers**, fresh agent sessions each in a workspace the agent manager created, read and write code. Every worker step runs a playbook of the `smode` skill, on the model its role routes to, skipping providers that are out of quota.

The factory reaches the agent manager only through the operations in [INTERFACE.md](INTERFACE.md). How each operation runs on one manager is in that manager's reference under `references/`; read only the reference `docs/agents/factory.md` names on its `Manager:` line. Its settings live in `docs/agents/factory.md`, and the model each role runs on in the project's `docs/agents/roles.md`.

## Modes

- `setup`: prepare this project for the factory and prove it with a smoke test. Follow [SETUP.md](SETUP.md). `setup override` changes chosen settings of `docs/agents/factory.md` only (SETUP.md, **Override**).
- `run`: start the factory and leave it running. Do schedule-wakes for the main checkout, every `Wake timeout`, with the wake prompt the reference gives (it runs this skill in mode `once`), report that the factory is running and in which session, and end your turn. From then on the scheduled session is the coordinator: each wake it receives is a `once`. Follow [PLAYBOOK.md](PLAYBOOK.md), with [WORK-ORDERS.md](WORK-ORDERS.md) for every worker started and [MEMORY.md](MEMORY.md) for the journal, the lessons, the providers and the quota. To stop the factory, a person tells the coordinator "stop", which cancels the scheduled wakes.
- `once`: do exactly one wake of the playbook, report it, and stop. The scheduled wakes of `run` send this; on its own it lets a person watch one wake.

With no mode given, ask which one. `run` and `once` need `docs/agents/factory.md` in its current form (SETUP.md, **Converting older settings**); without it, run `setup` first.
