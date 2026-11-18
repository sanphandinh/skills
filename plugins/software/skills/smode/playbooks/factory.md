# Factory

Run the agent-driven factory: a coordinator builds every approved spec and standalone ticket, each worker step a playbook of smode.

1. Read the project's `docs/agents/factory.md`. Without it, or with settings from an older factory (a `docs/agents/factory-v2.md`, or an `Agent:` line without a `Coordinator:` line), run the `factory` skill's `setup` first: it converts them.
2. Run the `factory` skill in the mode the user asked for: `setup` to prepare the project and prove the agent manager, `once` for one wake, `run` to keep it running. With no mode named, ask which.
3. The skill owns everything from there: the coordinator follows its playbook, and its workers run this skill's `plan-ticket`, `ticket`, `verify` and `review` playbooks on the models their roles route to.

**Reply:** what the `factory` skill reported for the mode it ran.
