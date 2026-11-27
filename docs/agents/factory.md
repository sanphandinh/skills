# Factory

Settings for the `factory` skill. Every dispatcher run and every coordinator turn rereads this file, so a change applies on the next one. Merge rules live in `merge-policy.md`.

Manager: t3
Trunk: main
Max workers: 3
Max tickets: 3
Scarce resources: none
Fix rounds: 2
Conflict rounds: 3
Required checks: none
Trunk checks: none
Wake timeout: 15 minutes
Reset keeps: node_modules
Memory: ~/.local/share/factory-v2/skills
