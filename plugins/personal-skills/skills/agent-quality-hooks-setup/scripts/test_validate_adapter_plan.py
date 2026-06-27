#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_adapter_plan.py")


def validate(plan: dict[str, object]) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "adapter-plan.json"
        path.write_text(json.dumps(plan))
        return subprocess.run(
            ["python3", str(SCRIPT), str(path)],
            capture_output=True,
            text=True,
        )


class ValidateAdapterPlanTests(unittest.TestCase):
    def test_accepts_native_events_calling_the_same_runner(self) -> None:
        completed = validate(
            {
                "schemaVersion": 1,
                "runner": ".agents/quality/run",
                "adapters": [
                    {
                        "agent": "codex",
                        "config": ".codex/hooks.json",
                        "turnCompleteEvent": "Stop",
                        "turnCompleteArgs": ["turn-complete"],
                    },
                    {
                        "agent": "opencode",
                        "config": ".opencode/plugins/quality-gate.ts",
                        "turnCompleteEvent": "session.idle",
                        "turnCompleteArgs": ["turn-complete"],
                    },
                ],
            }
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_rejects_agent_specific_quality_commands(self) -> None:
        completed = validate(
            {
                "schemaVersion": 1,
                "runner": ".agents/quality/run",
                "adapters": [
                    {
                        "agent": "codex",
                        "config": ".codex/hooks.json",
                        "turnCompleteEvent": "Stop",
                        "turnCompleteArgs": ["turn-complete"],
                    },
                    {
                        "agent": "opencode",
                        "config": ".opencode/plugins/quality-gate.ts",
                        "turnCompleteEvent": "session.idle",
                        "turnCompleteArgs": ["bun", "test"],
                    },
                ],
            }
        )

        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("shared runner profile", completed.stderr)

    def test_rejects_non_native_lifecycle_event(self) -> None:
        completed = validate(
            {
                "schemaVersion": 1,
                "runner": ".agents/quality/run",
                "adapters": [
                    {
                        "agent": "opencode",
                        "config": ".opencode/plugins/quality-gate.ts",
                        "turnCompleteEvent": "Stop",
                        "turnCompleteArgs": ["turn-complete"],
                    }
                ],
            }
        )

        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("session.idle", completed.stderr)


if __name__ == "__main__":
    unittest.main()
