# Factory

The unattended build in the `factory` plugin: a coordinator agent keeps taking work from the tracker and moves each ticket to a merged pull request, asking a person only where the merge policy, a plan's questions or the limits say so (ADR-0002). The scripted orchestrator it replaced is recorded in ADR-0001.

## Language

**Coordinator**:
The long-lived agent that runs the factory: it reads the tracker and the git host, decides each ticket's next step, starts workers, merges, and asks people. It never writes code.
_Avoid_: orchestrator, scheduler, bot

**Worker**:
A fresh agent session the agent manager starts in a workspace to do one step of one ticket, under one work order, ending with a result.
_Avoid_: subagent, job, run

**Work order**:
The self-contained instructions a worker starts with: the step, the pointers it needs, what it may change, the evidence that proves it is done, and where to write its result.
_Avoid_: brief (that is the note to a person), prompt, task spec

**Wake**:
One pass of the coordinator: wait for events, reload its instructions and settings, handle the events, move each ticket one step, record a journal line.
_Avoid_: tick, loop, poll

**Agent manager**:
The tool that creates workspaces, runs workers, and reports their events: T3 Code today; another manager is one more reference.
_Avoid_: harness, runner

**Interface**:
The ten operations the factory needs from an agent manager.
_Avoid_: API, adapter

**Reference**:
The document that maps the interface to one agent manager's commands and lists its traps; ready when the setup smoke test passes on it.
_Avoid_: adapter, driver

**Hold**:
A ticket or pull request waiting for a person's decision, marked with the `factory:hold` label and a brief.
_Avoid_: block, park

**Verdict status**:
A commit status (`factory/verify`, `factory/review`) on the exact head commit a verifier or reviewer checked. A new push leaves the new head without one.
_Avoid_: approval, check result

**Brief**:
The decision-ready comment the factory leaves whenever it hands work to a human: what to decide, why it stopped, the options with a recommendation, and links.
_Avoid_: needs-human note, status update

**Fix ticket**:
The one ticket the factory files while trunk stays red after a rerun, holding the first red commit and its log.
_Avoid_: incident, hotfix

**Stop the line**:
The rule that nothing merges while trunk is red.
_Avoid_: freeze, merge block

**Harness**:
The agent that runs a session and owns its tools: Claude Code, Codex, Oh My Pi, or a provider session inside T3 Code. A mode skill maps its actions to one harness's tools in a harness doc. Distinct from the agent manager, which creates workspaces and runs workers.
_Avoid_: platform (that is the plugin catalog's word), runtime

**Mode skill**:
The entry point for every request in its domain: a model-invoked skill that routes a task to one of its entry playbooks and calls other skills at each step, which are user-invoked so they do not compete with it: `smode` (ADR-0003, ADR-0005).
_Avoid_: meta skill, router, super skill

**Playbook**:
One short, ordered list of steps for one kind of task inside a mode skill, copied verbatim into the todo list when it runs. An **entry playbook** is one a request is routed to (`bug-fix`, `ticket`, `quick`); a **step playbook** runs only when another playbook or a work order calls it (`plan-ticket`, `verify`).
_Avoid_: recipe, workflow, script

**Role**:
What a piece of delegated work needs from a model (deep reasoning, cheap and fast, independent from the author), described by traits and mapped to models in the project's `docs/agents/roles.md` (ADR-0004). One of five: scout, worker, thinker, reviewer, coordinator. Never a model name.
_Avoid_: tier, agent type

**Route**:
The ordered list of candidates for one role, one line of `docs/agents/roles.md`; whoever delegates takes the first candidate the harness can run that is qualified, available and not out of quota.
_Avoid_: fallback chain, model list

**Candidate**:
One model a route may run: `<provider>/<model>`, the provider being the model's maker, with `effort` and, when another service runs it, `via=<channel>`. Its id (without `effort`) names it in the factory's memory. Never a harness's own id.
_Avoid_: target, model selector
