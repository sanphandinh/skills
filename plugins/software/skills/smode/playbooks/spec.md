# Spec

From an idea to a spec and tickets on the tracker, ready for an agent to build.

1. When the effort is too big or too unclear for one session, run the `wayfinder` skill to map its decisions as tickets first; this playbook resumes when the map says the destination is specified.
2. Run the `grill-with-docs` skill to sharpen the plan, recording terms in `GLOSSARY.md` and decisions as ADRs as they land.
3. Settle each empirical fork with the `prototype` skill instead of debating it.
4. Run the `to-spec` skill to publish the spec to the tracker.
5. Run the `to-tickets` skill to break it into tracer-bullet tickets with blocking edges and `Verify:` lines, and agree the breakdown with the user.
6. Hand over: the `spec-run` playbook builds the whole spec, the `ticket` playbook builds one ticket, or the factory builds it unattended.

**Reply:** the spec's location, the ticket list with its blocking edges, the decisions recorded, and what is left open.
