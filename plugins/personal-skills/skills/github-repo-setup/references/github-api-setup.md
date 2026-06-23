# GitHub API Setup Reference

Read this before mutating GitHub repository settings.

## Preconditions

Confirm:

```bash
gh repo view --json nameWithOwner,defaultBranchRef,visibility
gh auth status
gh api repos/OWNER/REPO --jq '{name:.full_name, default_branch, permissions:.permissions}'
```

Write operations usually require admin access or a token with repository administration permissions. In sandboxed environments, a failed `gh auth status` can reflect keychain isolation; verify outside the sandbox before telling the user to re-authenticate.

## Security Features

Common repository-level checks and writes:

```bash
# Dependabot security updates
gh api repos/OWNER/REPO/automated-security-fixes
gh api --method PUT repos/OWNER/REPO/automated-security-fixes

# Repository metadata and security_and_analysis status
gh api repos/OWNER/REPO --jq '.security_and_analysis'
```

For Dependabot alerts, secret scanning, push protection, advanced security, or code scanning setup, use the current supported endpoint for the repository plan and owner policy. Some features are unavailable on some plans or controlled at organization level.

## Repository Rulesets

Prefer rulesets for new setup because they are explicit, auditable, and can target the default branch with `~DEFAULT_BRANCH`.

Minimal default-branch ruleset payload:

```json
{
  "name": "default-branch-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["squash", "merge", "rebase"],
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_approving_review_count": 1,
        "required_review_thread_resolution": true
      }
    }
  ],
  "bypass_actors": []
}
```

Apply from a reviewed file:

```bash
gh api --method POST repos/OWNER/REPO/rulesets --input /tmp/ruleset.json
gh api repos/OWNER/REPO/rulesets --jq '.[] | {id,name,target,enforcement}'
```

Add `required_status_checks` only after reading exact contexts from GitHub:

```json
{
  "type": "required_status_checks",
  "parameters": {
    "strict_required_status_checks_policy": true,
    "required_status_checks": [
      { "context": "test" }
    ]
  }
}
```

If a repo has no passing check context yet, do not invent one. Create the ruleset without required checks, run CI once, then update the ruleset with the exact context names.

## Branch Protection Fallback

Use legacy branch protection only when rulesets are unavailable or the repo already standardizes on it:

```bash
gh api --method PUT repos/OWNER/REPO/branches/BRANCH/protection \
  --field required_linear_history=false \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

Branch protection payloads are more nested than the simple flags above for required checks and reviews. Read the current endpoint docs before changing required reviews or status checks.

## Verification Checklist

After applying changes:

```bash
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/branches/BRANCH/protection
gh api repos/OWNER/REPO/automated-security-fixes
gh pr list --author app/dependabot --state open
```

Record any `403`, `404`, or plan-limited feature as a setup gap, not as success.
