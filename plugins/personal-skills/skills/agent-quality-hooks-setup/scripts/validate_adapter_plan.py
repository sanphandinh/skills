#!/usr/bin/env python3
"""Validate that native agent adapters share one runner contract."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


SUPPORTED_AGENTS = {"claude-code", "codex", "gemini-cli", "github-copilot", "opencode"}
PROFILES = {"after-edit", "turn-complete", "full"}
NATIVE_EVENTS = {
    "claude-code": {"turn": "Stop", "edit": "PostToolUse"},
    "codex": {"turn": "Stop", "edit": "PostToolUse"},
    "gemini-cli": {"turn": "AfterAgent", "edit": "AfterTool"},
    "github-copilot": {"turn": "agentStop", "edit": "postToolUse"},
    "opencode": {"turn": "session.idle", "edit": "file.edited"},
}


def fail(message: str) -> None:
    raise ValueError(message)


def validate(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1:
        fail("schemaVersion must be 1")
    runner = data.get("runner")
    adapters = data.get("adapters")
    if not isinstance(runner, str) or not runner:
        fail("runner must be a non-empty repo-relative path")
    if not isinstance(adapters, list) or not adapters:
        fail("adapters must be a non-empty list")

    seen: set[str] = set()
    for adapter in adapters:
        if not isinstance(adapter, dict):
            fail("each adapter must be an object")
        agent = adapter.get("agent")
        if agent not in SUPPORTED_AGENTS or agent in seen:
            fail("each supported agent may appear once")
        seen.add(agent)
        if not isinstance(adapter.get("config"), str) or not adapter["config"]:
            fail(f"{agent}: config path is required")
        expected_turn = NATIVE_EVENTS[agent]["turn"]
        if adapter.get("turnCompleteEvent") != expected_turn:
            fail(f"{agent}: turnCompleteEvent must use native event {expected_turn}")
        args = adapter.get("turnCompleteArgs")
        if not isinstance(args, list) or len(args) != 1 or args[0] not in PROFILES:
            fail(f"{agent}: adapter must call one shared runner profile")
        edit_args = adapter.get("afterEditArgs")
        if edit_args is not None and (
            not isinstance(edit_args, list) or len(edit_args) != 1 or edit_args[0] != "after-edit"
        ):
            fail(f"{agent}: after-edit must call the shared runner profile")
        if edit_args is not None and adapter.get("afterEditEvent") != NATIVE_EVENTS[agent]["edit"]:
            fail(f"{agent}: afterEditEvent must use native event {NATIVE_EVENTS[agent]['edit']}")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_adapter_plan.py <adapter-plan.json>", file=sys.stderr)
        return 2
    try:
        data = json.loads(Path(sys.argv[1]).read_text())
        if not isinstance(data, dict):
            fail("adapter plan root must be an object")
        validate(data)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"invalid adapter plan: {exc}", file=sys.stderr)
        return 1
    print("Adapter plan is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
