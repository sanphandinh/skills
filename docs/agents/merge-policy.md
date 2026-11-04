# Merge Policy

Read by the `factory` skill when it decides whether a pull request merges without a human. Auto-merge is on unless this file says `Auto-merge: off`.

These gates are mandatory and no line here can turn them off:

- `docs/agents/verify.md` exists, so a verifier can run the real product
- a verifier that did not write the change passed it on the pull request's head commit (the `factory/verify` commit status)
- a reviewer found no blocking issue on the spec or standards axis on the same head commit (the `factory/review` commit status)
- every required check named in `docs/agents/factory.md` passed on that head commit
- the pull request's Merge Danger section says `Door: two-way`, and its blast radius is in the list below
- no changed file is under a protected path
- trunk's CI is not red (nothing merges while trunk is red)
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
