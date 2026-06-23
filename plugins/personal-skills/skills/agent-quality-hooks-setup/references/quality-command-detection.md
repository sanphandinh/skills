# Quality Command Detection

Use this reference to discover command roles before wiring hooks. Prefer commands already documented in the repo over these defaults.

## Discovery Order

1. Root instructions: `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/agents/*`.
2. Existing scripts: `package.json`, `Makefile`, `Taskfile.yml`, `justfile`, `mise.toml`, `pyproject.toml`, `Cargo.toml`, `go.mod`, Gradle/Maven files.
3. CI: `.github/workflows/*`, `.gitlab-ci.yml`, buildkite/circle configs.
4. Tool config files: `tsconfig.json`, ESLint/Biome/Oxlint configs, Prettier configs, `ruff.toml`, `mypy.ini`, `rustfmt.toml`, `.golangci.yml`.

## Roles

- `typecheck`: static type or compile check without packaging a release.
- `lint`: style, correctness, or static analyzer checks.
- `format_write`: formatter that mutates files.
- `format_check`: formatter in check-only mode.
- `build_check`: compile/build command used when no separate typecheck exists.

Do not collapse write-format and check-format into one command. Hooks that run after final agent output should be check-only unless the user explicitly wants auto-format-on-stop.

## JavaScript And TypeScript

Use package scripts when present. Select the runner from lockfiles:

- `bun.lock` or `bun.lockb`: `bun run <script>`
- `pnpm-lock.yaml`: `pnpm <script>` or `pnpm run <script>` according to repo style
- `yarn.lock`: `yarn <script>`
- `package-lock.json` or no lockfile: `npm run <script>`

Common script names:

- typecheck: `typecheck`, `type-check`, `check:types`, `tsc`
- lint: `lint`, `lint:check`, `check:lint`
- format_write: `format`, `fmt`, `prettier`, `biome:format`
- format_check: `format:check`, `fmt:check`, `prettier:check`, `biome:check`

If no script exists but configs clearly exist, suggest rather than silently add:

- TypeScript: `tsc --noEmit`
- Prettier check: `prettier --check .`
- ESLint: `eslint .`
- Biome check: `biome check .`
- Oxlint: `oxlint`

## Go

Use repo scripts first. Defaults:

- type/build check: `go test ./...`
- lint: `golangci-lint run` only when `.golangci.yml`, `.golangci.yaml`, or `.golangci.toml` exists or docs require it
- format_write: `gofmt -w <files>`
- format_check: `test -z "$(gofmt -l .)"`

Scope `gofmt -w` to changed `.go` files in edit hooks.

## Rust

Use repo scripts first. Defaults:

- typecheck: `cargo check --all-targets --all-features`
- lint: `cargo clippy --all-targets --all-features -- -D warnings`
- format_write: `cargo fmt --all`
- format_check: `cargo fmt --all -- --check`

Avoid running `cargo clippy -- -D warnings` if the repo does not normally treat warnings as errors.

## Python

Use repo scripts first. Look for `pyproject.toml`, `uv.lock`, `poetry.lock`, `Pipfile.lock`, `ruff.toml`, `mypy.ini`, `pyrightconfig.json`.

Common defaults:

- typecheck: `mypy .` or `pyright` only if configured
- lint: `ruff check .`
- format_write: `ruff format .` or `black .`
- format_check: `ruff format --check .` or `black --check .`

Use `uv run`, `poetry run`, or project task runners when the repo already uses them.

## Java, Kotlin, Scala

Prefer Gradle/Maven/SBT tasks already used in CI:

- Gradle: `./gradlew check`, `./gradlew test`, `./gradlew spotlessCheck`
- Maven: `./mvnw test`, `./mvnw verify`, `./mvnw spotless:check`
- SBT: `sbt test`, `sbt scalafmtCheckAll`

Formatting is often project-specific. Do not add Spotless or ktlint unless requested.

## Monorepos

Find the orchestrator first: Turborepo, Nx, Bazel, Pants, Buck, Make, Just, Taskfile, workspace package scripts, or CI matrix. Prefer a root command that already fans out. If none exists, generate a runner that iterates known packages explicitly and reports which package failed.
