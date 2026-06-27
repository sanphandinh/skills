#!/usr/bin/env python3
"""Collect bounded repository evidence without inferring quality commands."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


EXACT_PATHS = {
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    "README.md",
    "CONTRIBUTING.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "Makefile",
    "justfile",
    "Taskfile.yml",
    "Taskfile.yaml",
    "mise.toml",
    "turbo.json",
    "nx.json",
    "tsconfig.json",
    "ruff.toml",
    "mypy.ini",
    "pyrightconfig.json",
    "biome.json",
    "biome.jsonc",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "opencode.json",
    "opencode.jsonc",
}
PREFIXES = (
    ".github/workflows/",
    "docs/agents/",
)
EXCLUDED_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    "credentials.json",
    "secrets.json",
}
MAX_FILE_BYTES = 64_000
MAX_TOTAL_BYTES = 512_000


def is_evidence_path(relative: str) -> bool:
    name = Path(relative).name
    if name in EXCLUDED_NAMES or name.startswith(".env."):
        return False
    return relative in EXACT_PATHS or relative.startswith(PREFIXES)


def collect(root: Path) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    total = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if not is_evidence_path(relative):
            continue
        try:
            raw = path.read_bytes()
        except OSError:
            continue
        truncated = len(raw) > MAX_FILE_BYTES or total + min(len(raw), MAX_FILE_BYTES) > MAX_TOTAL_BYTES
        allowed = min(MAX_FILE_BYTES, max(0, MAX_TOTAL_BYTES - total))
        if allowed == 0:
            break
        content = raw[:allowed].decode("utf-8", errors="replace")
        total += len(raw[:allowed])
        evidence.append(
            {
                "path": relative,
                "content": content,
                "truncated": truncated,
            }
        )
    return evidence


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd()).resolve()
    if not root.is_dir():
        print(json.dumps({"error": f"not a directory: {root}"}, indent=2))
        return 2
    result = {
        "root": str(root),
        "evidence": collect(root),
        "notes": [
            "This is source evidence only.",
            "An AI agent must analyze semantics and produce the quality contract.",
            "Secrets and environment files are intentionally excluded.",
        ],
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
