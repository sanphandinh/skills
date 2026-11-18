# Verify

Prove a change works on the real product, the way a user would see it, at one exact commit. Check what the ticket asks for, not what its author meant, even when this session is the author. Change no file and make no commit.

1. Make `git rev-parse HEAD` equal the commit you were given (`git fetch origin`, then `git checkout --detach <sha>` when it does not).
2. Read the ticket's acceptance criteria and `docs/agents/verify.md`.
3. When you hold a scarce resource (a simulator, a device, a browser profile, a port), bring it to a clean state as `docs/agents/verify.md` says. While you hold it, run one command against it at a time and wait for it: never in the background, never in parallel, never several steps chained in one script. After a timeout or an abort, stop whatever the command left running before you retry.
4. Judge each acceptance criterion on its own by driving the product (CLI, HTTP, browser) and observing the behaviour:
   - `pass`: you ran it and saw it work;
   - `fail`: you ran it and saw it break;
   - `unverified`: something outside the change stopped you from observing it (a device or simulator that hangs, files a fresh checkout lacks, an expired account, automation that cannot reach a control), with what stopped you.

   Green tests and a clean build are supporting evidence, never the verdict. A criterion is `fail` only on observed behaviour.
5. With no `docs/agents/verify.md`, run the tests and the typecheck, read the change, and say in the notes that nothing drove the real product.
6. Check `git status`: still clean.

Always stop and report instead of acting on anything irreversible: force-pushing a shared branch, deploying, deleting data, messaging customers.

**Reply:** the verdict (`FAIL` when any criterion failed; else `UNVERIFIED` when any could not be observed; else `PASS`, or `PASS+NOTES` with notes), the commit you checked, and per criterion its status, what you ran, and what you saw. When a work order asks for a result object, give the `verify` object of smode's `RESULTS.md`.
