---
name: factory
description: "Agent-driven software factory: a dispatcher claims approved tickets and gives each one its own coordinator and workspace, each worker step a smode playbook on the model its role routes to."
disable-model-invocation: true
argument-hint: "setup | setup override | run | once | pause | resume | stop"
---

# Factory

The factory builds approved specs and standalone tickets from the issue tracker, with a person in the loop only for real decisions. A **watcher** looks at the board on a schedule and starts a **dispatcher** when something changed or fell due. The dispatcher claims tickets, and gives each claimed ticket a **coordinator**: its own session in its own workspace, from plan to Close. The coordinator decides, delegates and records; **workers**, fresh sessions in the coordinator's workspace, read and write code. Every worker step runs a playbook of the `smode` skill, on the model its role routes to, skipping providers that are out of quota.

The factory reaches the agent manager only through the operations in [INTERFACE.md](INTERFACE.md). How each operation runs on one manager is in that manager's reference under `references/`; read only the reference `docs/agents/factory.md` names on its `Manager:` line. Its settings live in `docs/agents/factory.md`, and the model each role runs on in the project's `docs/agents/roles.md`, which `setup` writes from [roles-template.md](roles-template.md) and `scripts/roles.mjs` checks. Claims, resources, dues and the run status live in the memory folder ([MEMORY.md](MEMORY.md)), written through `scripts/resources.mjs`. The factory is the only skill that delegates by role.

## Modes

- `setup`: prepare this project for the factory, write `docs/agents/factory.md` and `docs/agents/roles.md`, and prove it with a smoke test. Follow [SETUP.md](SETUP.md). `setup override` changes chosen settings and roles only (SETUP.md, **Override**).
- `run`: start the factory and leave it running. `resources.mjs status set running`, then schedule-wakes the watcher every `Wake timeout`, with the prompt the reference gives, report that the factory is running, and end your turn. This session does not become part of the factory.
- `once`: one dispatcher run now. Take the dispatcher lock and launch a dispatcher as [DISPATCHER.md](DISPATCHER.md), **Wake check**, says; report its session and end your turn.
- `pause`: `resources.mjs status set paused`. Nothing new starts: no claim, no worker, no merge; coordinators finish handling what is in flight.
- `resume`: `resources.mjs status set running` (tickets stopped in between become due), then one dispatcher run as in `once`.
- `stop`: cancel the watcher's schedule (schedule-wakes), then `resources.mjs status set paused`. `run` starts it again.

`pause`, `resume` and `stop` are what a person means, in any language and any wording, not literal words; when a message may be one of them and you are not sure, ask before acting. Run every mode from the project's main checkout. With no mode given, ask which one. Every mode but `setup` needs `docs/agents/factory.md` in its current form (SETUP.md, **Converting older settings**); without it, run `setup` first.

A dispatcher follows [DISPATCHER.md](DISPATCHER.md); a coordinator follows [COORDINATOR.md](COORDINATOR.md), with [WORK-ORDERS.md](WORK-ORDERS.md) for every worker it starts. Each is told so in its first message.
