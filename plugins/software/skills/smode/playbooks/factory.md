# Factory

Run the agent-driven factory: a coordinator builds every approved spec and standalone ticket, each worker step a playbook of smode.

1. Read the project's `docs/agents/factory-v2.md`. Without it, the factory is not set up here.
2. Run the `factory-v2` skill in the mode the user asked for: `setup` to prepare the project and prove the agent manager, `once` for one wake, `run` to keep it running. With no mode named, ask which.
3. The skill owns everything from there: the coordinator follows its playbook, and its workers run this skill's `plan-ticket`, `ticket`, `verify` and `review` playbooks on the models their roles route to.
4. Version 1 of the factory (the `factory` skill) stays available for repositories set up with it; one repository runs one version.

**Reply:** what the `factory-v2` skill reported for the mode it ran.
