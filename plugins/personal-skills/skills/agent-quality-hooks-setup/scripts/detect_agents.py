#!/usr/bin/env python3
"""Detect repository evidence for supported coding agents."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


AGENTS = {
    "claude-code": {
        "configured": [".claude/settings.json", ".claude/settings.local.json"],
        "possible": ["CLAUDE.md"],
        "reference": "references/agents/claude-code.md",
    },
    "codex": {
        "configured": [".codex/config.toml", ".codex/hooks.json"],
        "possible": [],
        "reference": "references/agents/codex.md",
    },
    "gemini-cli": {
        "configured": [".gemini/settings.json"],
        "possible": ["GEMINI.md"],
        "reference": "references/agents/gemini-cli.md",
    },
    "github-copilot": {
        "configured": [".github/hooks"],
        "possible": [".github/copilot-instructions.md"],
        "reference": "references/agents/github-copilot.md",
    },
    "opencode": {
        "configured": ["opencode.json", "opencode.jsonc", ".opencode/plugins"],
        "possible": [],
        "reference": "references/agents/opencode.md",
    },
}


def existing_markers(root: Path, markers: list[str]) -> list[str]:
    return [marker for marker in markers if (root / marker).exists()]


def detect(root: Path) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for agent_id, definition in AGENTS.items():
        configured = existing_markers(root, definition["configured"])
        possible = existing_markers(root, definition["possible"])
        if configured:
            status = "configured"
            evidence = configured + possible
        elif possible:
            status = "possible"
            evidence = possible
        else:
            continue
        result.append(
            {
                "id": agent_id,
                "status": status,
                "evidence": evidence,
                "reference": definition["reference"],
            }
        )
    return result


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else os.getcwd()).resolve()
    if not root.is_dir():
        print(json.dumps({"error": f"not a directory: {root}"}, indent=2))
        return 2
    print(json.dumps({"root": str(root), "agents": detect(root)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
