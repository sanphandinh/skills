#!/usr/bin/env python3
"""Detect likely quality commands for a repository.

This script is intentionally read-only. It prints JSON recommendations that an
agent should verify against project docs before wiring hooks.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


ROLE_SCRIPT_NAMES = {
    "typecheck": ["typecheck", "type-check", "check:types", "types", "tsc"],
    "lint": ["lint", "lint:check", "check:lint"],
    "format_write": ["format", "fmt", "prettier", "biome:format"],
    "format_check": ["format:check", "fmt:check", "prettier:check", "biome:check"],
}


def file_exists(root: Path, *names: str) -> bool:
    return any((root / name).exists() for name in names)


def package_runner(root: Path) -> str:
    if file_exists(root, "bun.lock", "bun.lockb"):
        return "bun run"
    if file_exists(root, "pnpm-lock.yaml"):
        return "pnpm run"
    if file_exists(root, "yarn.lock"):
        return "yarn"
    return "npm run"


def add_command(result: dict[str, list[dict[str, str]]], role: str, command: str, source: str, confidence: str) -> None:
    item = {"command": command, "source": source, "confidence": confidence}
    if item not in result[role]:
        result[role].append(item)


def detect_package_json(root: Path, result: dict[str, list[dict[str, str]]]) -> None:
    package_json = root / "package.json"
    if not package_json.exists():
        return
    try:
        data: dict[str, Any] = json.loads(package_json.read_text())
    except Exception as exc:
        result.setdefault("warnings", []).append(
            {"command": f"Could not parse package.json: {exc}", "source": "package.json", "confidence": "low"}
        )
        return

    scripts = data.get("scripts") or {}
    if not isinstance(scripts, dict):
        return

    runner = package_runner(root)
    for role, names in ROLE_SCRIPT_NAMES.items():
        for name in names:
            if name in scripts:
                add_command(result, role, f"{runner} {name}", "package.json scripts", "high")
                break

    deps = {}
    for key in ("dependencies", "devDependencies", "optionalDependencies"):
        value = data.get(key)
        if isinstance(value, dict):
            deps.update(value)

    if not result["typecheck"] and ("typescript" in deps or file_exists(root, "tsconfig.json")):
        add_command(result, "typecheck", "npx tsc --noEmit", "typescript config/dependency", "medium")
    if not result["lint"] and (
        "eslint" in deps
        or file_exists(root, "eslint.config.js", "eslint.config.mjs", ".eslintrc", ".eslintrc.json", ".eslintrc.js")
    ):
        add_command(result, "lint", "npx eslint .", "eslint config/dependency", "medium")
    if not result["format_check"] and (
        "prettier" in deps
        or file_exists(root, ".prettierrc", ".prettierrc.json", "prettier.config.js", "prettier.config.mjs")
    ):
        add_command(result, "format_check", "npx prettier --check .", "prettier config/dependency", "medium")
    if not result["format_write"] and (
        "prettier" in deps
        or file_exists(root, ".prettierrc", ".prettierrc.json", "prettier.config.js", "prettier.config.mjs")
    ):
        add_command(result, "format_write", "npx prettier --write", "prettier config/dependency", "medium")
    if not result["format_check"] and (
        "@biomejs/biome" in deps or file_exists(root, "biome.json", "biome.jsonc")
    ):
        add_command(result, "format_check", "npx biome check .", "biome config/dependency", "medium")


def detect_go(root: Path, result: dict[str, list[dict[str, str]]]) -> None:
    if not file_exists(root, "go.mod"):
        return
    add_command(result, "typecheck", "go test ./...", "go.mod", "medium")
    add_command(result, "format_write", "gofmt -w", "go toolchain", "medium")
    add_command(result, "format_check", "test -z \"$(gofmt -l .)\"", "go toolchain", "medium")
    if file_exists(root, ".golangci.yml", ".golangci.yaml", ".golangci.toml"):
        add_command(result, "lint", "golangci-lint run", "golangci config", "high")


def detect_rust(root: Path, result: dict[str, list[dict[str, str]]]) -> None:
    if not file_exists(root, "Cargo.toml"):
        return
    add_command(result, "typecheck", "cargo check --all-targets --all-features", "Cargo.toml", "medium")
    add_command(result, "lint", "cargo clippy --all-targets --all-features", "Cargo.toml", "medium")
    add_command(result, "format_write", "cargo fmt --all", "rustfmt", "medium")
    add_command(result, "format_check", "cargo fmt --all -- --check", "rustfmt", "medium")


def read_text_if_exists(path: Path) -> str:
    try:
        return path.read_text()
    except FileNotFoundError:
        return ""
    except UnicodeDecodeError:
        return ""


def detect_python(root: Path, result: dict[str, list[dict[str, str]]]) -> None:
    has_python = file_exists(root, "pyproject.toml", "ruff.toml", "mypy.ini", "pyrightconfig.json", "poetry.lock", "uv.lock")
    if not has_python:
        return
    pyproject = read_text_if_exists(root / "pyproject.toml")
    prefix = "uv run " if file_exists(root, "uv.lock") else "poetry run " if file_exists(root, "poetry.lock") else ""
    if "[tool.mypy]" in pyproject or file_exists(root, "mypy.ini"):
        add_command(result, "typecheck", f"{prefix}mypy .", "mypy config", "high")
    if file_exists(root, "pyrightconfig.json"):
        add_command(result, "typecheck", f"{prefix}pyright", "pyright config", "high")
    if "[tool.ruff]" in pyproject or file_exists(root, "ruff.toml"):
        add_command(result, "lint", f"{prefix}ruff check .", "ruff config", "high")
        add_command(result, "format_write", f"{prefix}ruff format .", "ruff config", "medium")
        add_command(result, "format_check", f"{prefix}ruff format --check .", "ruff config", "medium")
    if "[tool.black]" in pyproject:
        add_command(result, "format_write", f"{prefix}black .", "black config", "medium")
        add_command(result, "format_check", f"{prefix}black --check .", "black config", "medium")


def detect_jvm(root: Path, result: dict[str, list[dict[str, str]]]) -> None:
    if file_exists(root, "gradlew", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"):
        gradle = "./gradlew" if file_exists(root, "gradlew") else "gradle"
        add_command(result, "build_check", f"{gradle} check", "gradle", "medium")
        return
    if file_exists(root, "mvnw", "pom.xml"):
        maven = "./mvnw" if file_exists(root, "mvnw") else "mvn"
        add_command(result, "build_check", f"{maven} verify", "maven", "medium")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd()).resolve()
    result: dict[str, Any] = {
        "root": str(root),
        "typecheck": [],
        "lint": [],
        "format_write": [],
        "format_check": [],
        "build_check": [],
        "warnings": [],
    }
    if not root.exists() or not root.is_dir():
        print(json.dumps({"error": f"not a directory: {root}"}, indent=2))
        return 2

    detect_package_json(root, result)
    detect_go(root, result)
    detect_rust(root, result)
    detect_python(root, result)
    detect_jvm(root, result)

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
