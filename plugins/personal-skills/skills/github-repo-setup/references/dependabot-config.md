# Dependabot Config Reference

Read this before creating or editing `.github/dependabot.yml`.

## Inventory

Detect ecosystems from real files:

- npm: `package.json`, `package-lock.json`, `npm-shrinkwrap.json`
- pnpm: `pnpm-lock.yaml`
- yarn: `yarn.lock`
- GitHub Actions: `.github/workflows/*.yml` or `.yaml`
- Docker: `Dockerfile`, `docker-compose.yml`, image references in deploy files
- pip: `requirements*.txt`, `pyproject.toml`, `Pipfile`
- Poetry: `poetry.lock`
- Go modules: `go.mod`
- Cargo: `Cargo.toml`, `Cargo.lock`
- Maven/Gradle: `pom.xml`, `build.gradle`, `build.gradle.kts`

Only add an `updates` entry when the package manifest directory exists.

## Default Template

Use this as a starting point for a small app repo and remove ecosystems that do not exist:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Ho_Chi_Minh"
    open-pull-requests-limit: 5
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:30"
      timezone: "Asia/Ho_Chi_Minh"
    open-pull-requests-limit: 5
```

## Scheduling Policy

- Use `daily` for actively maintained apps or when the user asks to prompt Dependabot PRs quickly.
- Use `weekly` for normal repos to avoid PR noise.
- Keep `open-pull-requests-limit` low enough for humans to review; GitHub's default version-update limit is small, and security-update PRs use a separate internal limit.
- Prefer grouping by dependency type or ecosystem when CI is reliable. Avoid broad all-dependency groups for fragile apps because one bad package can block the whole group.

## Security Updates

Dependabot security updates can be customized by `dependabot.yml`, but they are enabled as a repository security feature, not merely by adding version-update config. Enable Dependabot alerts and security updates remotely, then use this file for granularity.

## Validation

Before committing:

```bash
python3 - <<'PY'
import pathlib, sys, yaml
path = pathlib.Path(".github/dependabot.yml")
yaml.safe_load(path.read_text())
print("dependabot.yml parses")
PY
```

If PyYAML is unavailable, use any existing repo YAML parser, `ruby -e 'require "yaml"; YAML.load_file(".github/dependabot.yml")'`, or `yq`.

After committing to the default branch:

```bash
gh pr list --author app/dependabot --state open
gh api repos/OWNER/REPO/automated-security-fixes
```

Dependabot version-update PR creation is asynchronous. Report job/PR evidence, not intent.
