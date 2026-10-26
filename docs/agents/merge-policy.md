# Merge Policy

Read by the `autopilot` skill when it decides whether a pull request merges without a human. Auto-merge is on unless this file says `Auto-merge: off`.

These gates are mandatory and no line here can turn them off:

- `docs/agents/verify.md` exists, so a verifier can run the real product
- a verifier that did not write the change returned `PASS` or `PASS+NOTES` on the pull request's current patch
- no hard finding on the Spec or Standards review axis
- CI is green
- the pull request's Merge Danger section says `Door: two-way`, and its blast radius is in the list below
- no changed file is under a protected path
- trunk's CI is green (nothing merges while trunk is red)
- it is not a fix or revert pull request for a red trunk; those always wait for a human

Auto-merge: on

## Allowed blast radius

Blast radius words (from the pull request's Merge Danger section) that may merge without a human. Anything else waits for review.

- none
- low
- docs
- tests
- internal

## Protected paths

These always route to a human, on top of the defaults: database `migrations/`, `infra/`, `.github/`, dependency lockfiles, and `.env` files. A path ending in `/` matches that directory anywhere; anything else matches a file name (`*` allowed) or an exact path.

- (none)

## Unprotected defaults

Remove a default only with a reason, as `- <default>: <reason>`. A line without a reason is ignored.
