# Verification

This repository ships agent skills as plugins. The product a maintainer (or factory verifier) exercises is the **repo CLI**: validate the marketplace, run regression tests, list the catalog, and inspect upstream tracking. There is no web UI or long-running server.

## Launch

From the repository root (the directory that contains `package.json` and `catalog.yaml`):

```bash
npm install
```

**Ready:** `node_modules/` exists and this command succeeds with exit code 0:

```bash
node cli/repo.mjs validate
```

The last line of stdout must end with `0 issue(s)`.

**Teardown:** nothing stays running after a check. Remove a throwaway dependency tree only if you created one for an isolated worktree (`rm -rf node_modules` in that worktree only).

## Doctor

Read-only checks before driving. All must pass; stop and run `npm install` if any fail.

```bash
node -e "const v=process.versions.node.split('.').map(Number); if(v[0]<20) { console.error('need Node >= 20'); process.exit(1); }"
test -d node_modules
test -f catalog.yaml
test -f cli/repo.mjs
pwd
```

The printed `pwd` must be the repository root you intend to verify (the PR checkout or worktree), not a parent directory.

## Drive

Set an evidence directory (create it once per verification run):

```bash
export VERIFY_EVIDENCE="${VERIFY_EVIDENCE:-./.verify-evidence}"
mkdir -p "$VERIFY_EVIDENCE"
```

Run each command from the repository root. Capture **stdout, stderr, and exit code** for every step.

Example capture pattern:

```bash
(set -o pipefail; npm run validate 2>&1 | tee "$VERIFY_EVIDENCE/validate.log"; echo "exit=$?" >> "$VERIFY_EVIDENCE/validate.log")
```

Use the same pattern for the commands in the feature map below.

## Evidence

For each driven journey, keep:

- The full terminal transcript (including the `exit=N` line).
- Files under `$VERIFY_EVIDENCE/` named after the journey (`validate.log`, `test.log`, `list.log`, …).

A passing proof shows **exit code 0** and the observable results listed in the feature map. Do not treat `npm test` alone as sufficient when the change touched catalog layout, skill frontmatter, or agents; run **validate** and **list** too.

## Cleanup

- Do not delete `$VERIFY_EVIDENCE/` until the verdict is recorded; the factory needs the transcripts.
- This repo leaves no background processes. If you started none, there is nothing to kill.
- In a disposable worktree, remove the worktree with `git worktree remove <path>` after copying evidence out; do not remove another checkout's `node_modules`.

## Untracked needs

| Need | Required for | If missing |
| ---- | ------------ | ---------- |
| `node_modules/` (`npm install`) | Every journey | Run Launch; do not skip checks. |
| Network + `upstream` git remote | `upstream status` **without** `--no-fetch` | Use `--no-fetch` (documented below) or report that the network journey could not run. |
| Oh My Pi (`omp`) on PATH | Optional consumer smoke (not part of default proof) | Report "OMP not installed"; default factory proof does not require it. |

## Feature map

### 1. Marketplace validation

**What:** Ensures every skill and platform agent matches repo rules (`catalog.yaml`, frontmatter, roles, plugin layout).

**Reach:** `npm run validate` (same as `node cli/repo.mjs validate`).

**Drive:**

```bash
(set -o pipefail; npm run validate 2>&1 | tee "$VERIFY_EVIDENCE/validate.log"; echo "exit=$?" >> "$VERIFY_EVIDENCE/validate.log")
```

**Proves it works:** Exit code 0; last line matches `^[0-9]+ skills, [0-9]+ agents, 0 issue\(s\)$`.

**Gotchas:** Non-zero exit with `N issue(s)` means fix reported paths before merging; do not weaken validate rules in the PR to green the run.

### 2. Regression test suite

**What:** Node test runner over `cli/*.test.mjs` and skill script tests under `plugins/*/skills/*/scripts/*.test.mjs`.

**Reach:** `npm test`.

**Drive:**

```bash
(set -o pipefail; npm test 2>&1 | tee "$VERIFY_EVIDENCE/test.log"; echo "exit=$?" >> "$VERIFY_EVIDENCE/test.log")
```

**Proves it works:** Exit code 0; transcript contains `ℹ fail 0` (or `ℹ pass` with no failures).

**Gotchas:** Upstream pull tests clone temporary git repos; allow ~30s. Failures in `cli/repo.test.mjs` usually mean validate/upstream logic regressed.

### 3. Skill and agent catalog

**What:** Human-readable listing of plugins, skills, and agents (what consumers see after install).

**Reach:** `npm run list`.

**Drive:**

```bash
(set -o pipefail; npm run list 2>&1 | tee "$VERIFY_EVIDENCE/list.log"; echo "exit=$?" >> "$VERIFY_EVIDENCE/list.log")
grep -q 'skill  grilling' "$VERIFY_EVIDENCE/list.log"
grep -q 'skill  setup-verification' "$VERIFY_EVIDENCE/list.log"
echo "grep_exit=$?" >> "$VERIFY_EVIDENCE/list.log"
```

**Proves it works:** Exit code 0 from `npm run list`; both `grep` commands succeed (core and software plugins present).

**Gotchas:** Renaming or removing `grilling` or `setup-verification` requires updating this doc's grep lines in the same change.

### 4. Upstream tracking (offline)

**What:** Shows tracked upstream skills vs `UPSTREAM.md` without fetching.

**Reach:** `npm run upstream -- status --no-fetch`.

**Drive:**

```bash
(set -o pipefail; npm run upstream -- status --no-fetch 2>&1 | tee "$VERIFY_EVIDENCE/upstream-status.log"; echo "exit=$?" >> "$VERIFY_EVIDENCE/upstream-status.log")
grep -q '^upstream ' "$VERIFY_EVIDENCE/upstream-status.log"
grep -q 'tracked skills current' "$VERIFY_EVIDENCE/upstream-status.log"
echo "grep_exit=$?" >> "$VERIFY_EVIDENCE/upstream-status.log"
```

**Proves it works:** Exit code 0; output includes an `upstream <ref> @ <sha>` line and a `tracked skills current` summary.

**Gotchas:** Omit `--no-fetch` only when network and the `upstream` remote are available; otherwise the command may hang or fail for environmental reasons unrelated to the PR.

## Default verifier path

For a typical pull request, run **Doctor**, then journeys **1**, **2**, and **3** in order. Add **4** when the change touches `UPSTREAM.md`, upstream rewrite rules, or `cli/` upstream commands. Attach `$VERIFY_EVIDENCE/*.log` to the verdict.
