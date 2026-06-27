#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("detect_agents.py")


def detect(files: dict[str, str]) -> dict[str, object]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for relative_path, content in files.items():
            path = root / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        completed = subprocess.run(
            ["python3", str(SCRIPT), str(root)],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(completed.stdout)


class DetectAgentsTests(unittest.TestCase):
    def test_detects_all_supported_project_agents_from_repository_markers(self) -> None:
        result = detect(
            {
                ".codex/config.toml": "",
                ".claude/settings.json": "{}",
                "opencode.json": "{}",
                ".gemini/settings.json": "{}",
                ".github/hooks/quality.json": "{}",
            }
        )

        self.assertEqual(
            [agent["id"] for agent in result["agents"]],
            ["claude-code", "codex", "gemini-cli", "github-copilot", "opencode"],
        )

    def test_instructions_alone_are_reported_as_possible_not_configured(self) -> None:
        result = detect(
            {
                "AGENTS.md": "",
                "CLAUDE.md": "",
                "GEMINI.md": "",
                ".github/copilot-instructions.md": "",
            }
        )

        statuses = {agent["id"]: agent["status"] for agent in result["agents"]}
        self.assertEqual(statuses["claude-code"], "possible")
        self.assertEqual(statuses["gemini-cli"], "possible")
        self.assertEqual(statuses["github-copilot"], "possible")
        self.assertNotIn("codex", statuses)


if __name__ == "__main__":
    unittest.main()
