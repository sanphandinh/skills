#!/usr/bin/env python3
"""Validate the canonical, evidence-backed quality contract."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


VALID_ROLES = {"lint", "typecheck", "format-check", "format-write", "test", "build"}
VALID_POLICIES = {"allowed", "scoped-only", "confirmation-required", "approved"}
AUTOMATIC_PROFILES = {"after-edit", "turn-complete"}


def fail(message: str) -> None:
    raise ValueError(message)


def validate(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1:
        fail("schemaVersion must be 1")
    commands = data.get("commands")
    profiles = data.get("profiles")
    if not isinstance(commands, list) or not isinstance(profiles, dict):
        fail("commands must be a list and profiles must be an object")

    by_id: dict[str, dict[str, Any]] = {}
    for command in commands:
        if not isinstance(command, dict):
            fail("each command must be an object")
        command_id = command.get("id")
        if not isinstance(command_id, str) or not command_id or command_id in by_id:
            fail("each command id must be unique and non-empty")
        roles = command.get("roles")
        evidence = command.get("evidence")
        policy = command.get("automaticPolicy")
        if not isinstance(roles, list) or not roles or not set(roles) <= VALID_ROLES:
            fail(f"{command_id}: roles must use supported values")
        if not isinstance(evidence, list) or not evidence or not all(isinstance(item, str) and item for item in evidence):
            fail(f"{command_id}: evidence must contain source locations")
        if command.get("confidence") != "confirmed":
            fail(f"{command_id}: only confirmed commands belong in the contract")
        if policy not in VALID_POLICIES:
            fail(f"{command_id}: invalid automaticPolicy")
        if set(roles) & {"test", "build"} and policy not in {"confirmation-required", "approved"}:
            fail(f"{command_id}: test/build commands must be confirmation-required until approved")
        by_id[command_id] = command

    for profile, command_ids in profiles.items():
        if not isinstance(command_ids, list):
            fail(f"{profile}: profile must be a list")
        for command_id in command_ids:
            if command_id not in by_id:
                fail(f"{profile}: unknown command id {command_id}")
            command = by_id[command_id]
            if profile in AUTOMATIC_PROFILES and command["automaticPolicy"] == "confirmation-required":
                fail(f"{profile}: {command_id} is confirmation-required and cannot run automatically")
            if profile == "after-edit" and command["automaticPolicy"] not in {"scoped-only", "approved"}:
                fail(f"after-edit: {command_id} must be scoped-only")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_quality_contract.py <quality-contract.json>", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(sys.argv[1]).read_text())
        if not isinstance(data, dict):
            fail("contract root must be an object")
        validate(data)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"invalid quality contract: {exc}", file=sys.stderr)
        return 1
    print("Quality contract is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
