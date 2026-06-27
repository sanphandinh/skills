#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("collect_project_evidence.py")


class CollectProjectEvidenceTests(unittest.TestCase):
    def test_collects_source_evidence_without_recommending_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".github/workflows").mkdir(parents=True)
            (root / ".codex").mkdir(parents=True)
            (root / "AGENTS.md").write_text("Run the repository quality script.\n")
            (root / "package.json").write_text(
                json.dumps({"scripts": {"quality:fast": "eslint . && tsc --noEmit"}})
            )
            (root / ".github/workflows/ci.yml").write_text("run: npm run quality:fast\n")
            (root / "tsconfig.json").write_text("{}")
            (root / ".codex/config.toml").write_text('secret = "do-not-collect"\n')
            (root / ".env").write_text("TOKEN=do-not-collect\n")

            completed = subprocess.run(
                ["python3", str(SCRIPT), str(root)],
                check=True,
                capture_output=True,
                text=True,
            )
            result = json.loads(completed.stdout)

        paths = [item["path"] for item in result["evidence"]]
        self.assertIn("AGENTS.md", paths)
        self.assertIn("package.json", paths)
        self.assertIn(".github/workflows/ci.yml", paths)
        self.assertIn("tsconfig.json", paths)
        self.assertNotIn(".codex/config.toml", paths)
        self.assertNotIn(".env", paths)
        self.assertNotIn("commands", result)
        self.assertNotIn("recommendations", result)


if __name__ == "__main__":
    unittest.main()
