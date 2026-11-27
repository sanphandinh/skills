# Factory

The unattended build of the `factory` skill: a dispatcher keeps claiming work from the tracker and gives each claimed ticket a coordinator that moves it to a merged pull request, asking a person only where the merge policy, a plan's questions or the limits say so (ADR-0002, ADR-0007). The scripted orchestrator it replaced is recorded in ADR-0001.

## Language

**Coordinator**:
The agent session of one claimed ticket, from its claim to its Close, in the ticket's own workspace: it reads the ticket and the git host, decides the ticket's next step, starts workers, merges, and asks people. It never writes code (ADR-0007).
_Avoid_: orchestrator, scheduler, bot

**Dispatcher**:
A fresh agent session for one run at the project's main checkout: it claims tickets and launches their coordinators, wakes, revives and renews them, stops the line and sweeps workspaces. It keeps nothing between runs.
_Avoid_: scheduler, manager (that is the agent manager)

**Watcher**:
The scheduled cheap session that starts a dispatcher only when the board's fingerprint changed or something is due.
_Avoid_: cron, poller

**Worker**:
A fresh agent session the agent manager starts in a workspace to do one step of one ticket, under one work order, ending with a result.
_Avoid_: subagent, job, run

**Work order**:
The self-contained instructions a worker starts with: the step, the pointers it needs, what it may change, the evidence that proves it is done, and where to write its result.
_Avoid_: brief (that is the note to a person), prompt, task spec

**Wake**:
A message that starts a turn of a coordinator: from the dispatcher (a hold released, a due passed, comments, a merge), from another coordinator that released a resource, or an event of its own workers and pull request. The dispatcher writes the wake through `resources.mjs` before it sends it.
_Avoid_: tick, loop, poll

**Due**:
The time by which a ticket's coordinator should get a turn although nothing woke it: set while it runs, cleared while it waits on a person, another ticket or a resource. A due that passed makes the dispatcher wake it.
_Avoid_: timeout, deadline

**Park**:
A coordinator waiting in a resource's queue (`slot`, a scarce resource, `merge`), its turn ended; whoever releases the resource wakes it.
_Avoid_: hold (that is waiting on a person), block

**Agent manager**:
The tool that creates workspaces, runs workers, and reports their events: T3 Code today; another manager is one more reference.
_Avoid_: harness, runner

**Interface**:
The operations the factory needs from an agent manager: launching dispatchers and coordinators, starting workers, sending, inspecting, watching pull requests, reviving, flagging and cleaning up.
_Avoid_: API, adapter

**Reference**:
The document that maps the interface to one agent manager's commands and lists its traps; ready when the setup smoke test passes on it.
_Avoid_: adapter, driver

**Hold**:
A ticket waiting for a person's decision: the triage role `ready-for-human` and a `## Factory brief`. A pull request carries `ready-for-human` only when a person must merge it.
_Avoid_: block

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
The agent that runs a session and owns its tools: Claude Code, OpenCode, Antigravity or Cursor, alone or as a provider session inside T3 Code (ADR-0006). A mode skill maps its actions to one harness's tools in a harness doc. Distinct from the agent manager, which creates workspaces and runs workers.
_Avoid_: platform (that is the plugin catalog's word), runtime

**Mode skill**:
The entry point for every request in its domain: a model-invoked skill that routes a task to one of its entry playbooks and calls other skills at each step, which are user-invoked so they do not compete with it: `smode` (ADR-0003, ADR-0005).
_Avoid_: meta skill, router, super skill

**Playbook**:
One short, ordered list of steps for one kind of task inside a mode skill, copied verbatim into the todo list when it runs. An **entry playbook** is one a request is routed to (`bug-fix`, `ticket`, `quick`); a **step playbook** runs only when another playbook or a work order calls it (`plan-ticket`, `verify`).
_Avoid_: recipe, workflow, script

**Role**:
What a factory worker needs from a model (deep reasoning, cheap and fast, independent from the author), described by traits and mapped to models in the project's `docs/agents/roles.md` (ADR-0004). One of five: scout, worker, thinker, reviewer, coordinator. Only the factory delegates by role; smode works alone (ADR-0006). Never a model name.
_Avoid_: tier, agent type

**Route**:
The ordered list of candidates for one role, one line of `docs/agents/roles.md`; the factory takes the first candidate the agent manager can run that is qualified, available and not out of quota.
_Avoid_: fallback chain, model list

**Candidate**:
One model a route may run: `<provider>/<model>`, the provider being the model's maker, with `effort` and, when another service runs it, `via=<channel>`. Its id (without `effort`) names it in the factory's memory. Never a harness's own id.
_Avoid_: target, model selector
