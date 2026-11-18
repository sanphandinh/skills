# One factory, smode as the entry point, no platform agents

ADR-0003 added `smode` and `factory-v2` beside a frozen factory v1 and its platform agents, and ADR-0004 moved models per role into the project's `docs/agents/roles.md`. That left three structures that no longer earned their place. The two factories shared about 87% of their core text (43 of v1's 341 lines differed), so every fix was made twice or missed once (the `ls -la` fingerprint bug was fixed for T3, not for Orca), and v2 carried lines whose only job was to avoid v1. The agents of `software-claude` and `software-omp` restated the `plan-ticket`, `ticket`, `verify` and `review` playbooks and had already drifted from them (`filesToChange` for `files_to_change`, `prBody` for `pr_body`, a verifier without `findings`, a fixed `model: opus` against a project route on another family); since models are chosen at delegation, they selected nothing. And `smode` was user-invoked while about a dozen other skills fired on their own descriptions, so a bug report could skip the bug-fix playbook's independent verify and review.

We keep **one factory**, named `factory`, inside the `software` plugin next to `smode`: the content of `factory-v2`, without its version lines, with T3 as its only reference and `docs/agents/factory.md` as its settings; the `factory` plugin, version 1 and the Orca reference are deleted. We delete **every platform agent** with its plugins (`software-claude`, `software-omp`, including the OMP TDD rules) and `ROLES.md`: the five roles are defined by smode's roles script and described by smode, and `code-review` gives each axis to a worker on the `reviewer` role. **`smode` is model-invoked** and is the entry point for every software request: it routes by signal to an entry playbook and says which one first; every other skill of `software` is user-invoked and runs when smode (or a person) names it.

## Considered options

- **Keep factory v1 frozen.** Rejected: nothing uses Orca any more, and a frozen copy still costs a second place to fix.
- **Keep the agents as a fallback for harnesses without model choice at delegation.** Rejected: every supported harness either takes a model per call (Claude Code, T3, OMP with grants) or reads generated agents from the project (Codex, ADR-0004), and the copies had drifted.
- **Leave triggers as they are and add "start in smode" to each project's `AGENTS.md`.** Rejected as the only mechanism: the other skills' descriptions would still compete with smode. Kept alongside model invocation, written by `setup-software-context` so no project has to remember it (see Consequences).
- **Keep the factory in its own plugin.** Rejected: smode and the factory call each other, and two plugins at different versions made the installed path of one impossible to derive from the other (#16).

## Consequences

- Supersedes the frozen version 1 of ADR-0002 and ADR-0003, ADR-0003's "Removing the role agents is a later decision", and ADR-0004's platform-agent selectors and OMP plain role keys. Their other decisions stand: the coordinator and its interface, playbooks run by workers, models per role in `docs/agents/roles.md`.
- Factory setup converts a project's `docs/agents/factory-v2.md`, or a version 1 `docs/agents/factory.md`, and upgrades a version 1 memory folder in place (its layout is a subset of the current one).
- Workers are named by step (`plan`, `build`, `verify`, `review`), so the worker `review` is no longer confused with the role `reviewer`.
- Result objects are defined once, in smode's `RESULTS.md`; the validator checks that the factory reads only keys defined there.
- The validator holds smode as the only model-invoked skill of `software`, and every playbook to a row of smode's Playbooks section.
- A skill's description alone did not make Claude Code start smode (three fresh sessions answered or reviewed directly), so each project's `AGENTS.md` also carries an `### Entry point` rule, written by `setup-software-context`, that starts every software request in smode. The directive is the default; model invocation keeps smode reachable where the rule is missing.
- TDD enforcement through harness rules or hooks is gone with `software-omp`; how to bring it back is an open decision.
- Projects that installed `factory`, `software-claude` or `software-omp` uninstall them (README release notes).
