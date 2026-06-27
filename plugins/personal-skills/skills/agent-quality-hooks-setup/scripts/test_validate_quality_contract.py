#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_quality_contract.py")


def validate(contract: dict[str, object]) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "quality-contract.json"
        path.write_text(json.dumps(contract))
        return subprocess.run(
            ["python3", str(SCRIPT), str(path)],
            capture_output=True,
            text=True,
        )


def valid_contract() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "commands": [
            {
                "id": "fast",
                "roles": ["lint", "typecheck"],
                "command": "pnpm quality:fast",
                "cwd": ".",
                "evidence": ["package.json:scripts.quality:fast", ".github/workflows/ci.yml"],
                "confidence": "confirmed",
                "cost": "fast",
                "automaticPolicy": "allowed",
            },
            {
                "id": "full",
                "roles": ["test", "build"],
                "command": "pnpm quality:full",
                "cwd": ".",
                "evidence": ["package.json:scripts.quality:full"],
                "confidence": "confirmed",
                "cost": "expensive",
                "automaticPolicy": "confirmation-required",
            },
        ],
        "profiles": {
            "after-edit": [],
            "turn-complete": ["fast"],
            "full": ["full"],
        },
        "unresolved": [],
    }


class ValidateQualityContractTests(unittest.TestCase):
    def test_accepts_evidence_backed_contract(self) -> None:
        completed = validate(valid_contract())

        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_rejects_command_without_evidence(self) -> None:
        contract = valid_contract()
        contract["commands"][0]["evidence"] = []

        completed = validate(contract)

        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("evidence", completed.stderr)

    def test_rejects_test_or_build_in_automatic_profile_without_confirmation(self) -> None:
        contract = valid_contract()
        contract["commands"][1]["automaticPolicy"] = "allowed"
        contract["profiles"]["turn-complete"].append("full")

        completed = validate(contract)

        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("confirmation-required", completed.stderr)


if __name__ == "__main__":
    unittest.main()
