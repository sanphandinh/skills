---
name: github-repo-setup
description: Set up or audit GitHub repository governance for new or existing repos, including default branch policy, repository rulesets or branch protection, Dependabot alerts/security/version updates, .github/dependabot.yml, secret scanning, push protection, code scanning, and verification with gh CLI or GitHub REST API. Use when a user asks to bootstrap a GitHub repo, configure branch rules, enable GitHub security features, create Dependabot config, or make Dependabot open update PRs.
---

# GitHub Repo Setup

## Overview

Configure GitHub repository controls with repo-local files plus remote settings. Keep file changes reviewable in git, treat remote GitHub mutations as live infrastructure changes, and verify every setting after applying it.

## Workflow

1. Inspect the repository before editing:
   - read root instructions such as `AGENTS.md`, `CLAUDE.md`, and repo docs;
   - identify the default branch, remote owner/repo, package ecosystems, lockfiles, CI workflow names, and existing `.github/` files;
   - check whether the user asked for a plan, dry run, or live remote mutation.
2. Load `references/dependabot-config.md` before writing or changing `.github/dependabot.yml`.
3. Load `references/github-api-setup.md` before using `gh api`, repository rulesets, branch protection, or security endpoints.
4. Create or update repo-local files first:
   - `.github/dependabot.yml` for version-update PR policy;
   - optional `.github/CODEOWNERS` when branch rules require code owner review;
   - optional `SECURITY.md` when the repo needs vulnerability reporting instructions.
5. Validate local files before remote changes:
   - parse YAML with an available parser, or use `ruby -e`, `python`, or `yq` when present;
   - confirm package-ecosystem directories exist;
   - verify CI workflow names before making them required checks.
6. Apply remote GitHub settings only when authorized:
   - verify `gh auth status` and admin access;
   - prefer repository rulesets for new setups; fall back to branch protection when rulesets are unavailable or the repo already standardizes on branch protection;
   - enable security features with the narrowest supported API/UI path for that repo plan;
   - keep payloads in temporary files or reviewed snippets rather than opaque one-liners.
7. Verify and report:
   - read back rulesets or branch protection;
   - read back security/Dependabot status;
   - list open Dependabot PRs and recent Dependabot jobs when available;
   - state any features skipped because of plan, permission, org policy, or API availability.

## Recommended Defaults

Use these defaults unless the repo has stronger existing policy:

- Protect the default branch with pull requests, one approving review, stale-review dismissal, review-thread resolution, no force pushes, and no deletion.
- Require required CI checks only after confirming the exact status-check contexts from a recent successful PR or default-branch run.
- Use ruleset `evaluate` mode first for high-risk existing repos; use `active` for new repos when the user explicitly wants enforcement.
- Enable Dependabot alerts and security updates. Add version updates through `.github/dependabot.yml`.
- Enable secret scanning and push protection when the plan supports them.
- Add CodeQL/default code scanning when the repo language and GitHub plan support it; do not block branch rules on code scanning until results exist.

## Dependabot PR Expectations

Dependabot version-update PRs are controlled by `.github/dependabot.yml` and GitHub's scheduler. After committing the config to the default branch and enabling Dependabot features, verify that GitHub has accepted the configuration and watch for PRs or job logs.

Do not claim an immediate Dependabot PR was triggered unless GitHub actually opened one or a Dependabot job log confirms a run. If the user needs an immediate run, use the current GitHub UI/API path after checking official docs or the repository's Dependabot page; otherwise set the nearest sensible schedule and report that PR creation is asynchronous.

## Remote Mutation Policy

- Treat `gh api --method PUT|PATCH|POST|DELETE` as a live change.
- Confirm the target `OWNER/REPO` and default branch before sending write requests.
- Prefer idempotent read-before-write flows: capture current settings, apply the minimal diff, then read back.
- If GitHub returns `403`, distinguish missing admin permission, org policy, unavailable plan features, and sandbox/keychain auth mismatch.
- Never weaken existing protections unless the user explicitly asks and the change is documented.

## Verification

Run the skill's own validation when editing this skill:

```bash
python3 /Users/sanphan/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/sanphan/Documents/skills/skills/github-repo-setup
```

For target repositories, verify with commands appropriate to the repo, typically:

```bash
gh repo view --json nameWithOwner,defaultBranchRef,visibility
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/automated-security-fixes
gh pr list --author app/dependabot --state open
```
