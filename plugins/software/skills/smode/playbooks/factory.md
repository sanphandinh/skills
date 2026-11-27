# Factory

Run the agent-driven factory: a dispatcher claims every approved spec's tickets and every standalone ticket, each claimed ticket gets its own coordinator and workspace, and each worker step is a playbook of smode.

1. Read the project's `docs/agents/factory.md`. Without it, or with settings from an older factory (a `docs/agents/factory-v2.md`, an `Agent:` line without a `Manager:` line, or a `Coordinator:` line), run the `factory` skill's `setup` first: it converts them.
2. Run the `factory` skill in the mode the user asked for: `setup` to prepare the project and prove the agent manager, `run` to keep it running, `once` for one dispatcher run, `pause`, `resume` or `stop`. A message that says stop, pause or resume to the factory, in any words, is that mode. With no mode named, ask which.
3. The skill owns everything from there: its dispatcher and its coordinators follow their own files, and its workers run this skill's `plan-ticket`, `ticket`, `verify` and `review` playbooks on the models their roles route to.

**Reply:** what the `factory` skill reported for the mode it ran.
