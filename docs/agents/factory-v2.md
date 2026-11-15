# Factory v2

Settings for the `factory-v2` skill. The coordinator rereads this file on every wake, so a change applies on the next wake. Merge rules live in `merge-policy.md`.

Factory: v2
Manager: t3
Coordinator: claudeAgent/claude-opus-5-5
Trunk: main
Max workers: 3
Scarce resources: none
Fix rounds: 2
Required checks: none
Trunk checks: none
Wake timeout: 15 minutes
Memory: ~/.local/share/factory-v2/skills
Routes: ~/.claude/rules/smode-roles.md
