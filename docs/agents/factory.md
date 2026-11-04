# Factory

Settings for the `factory` skill. The coordinator rereads this file on every wake, so a change applies on the next wake. Merge rules live in `merge-policy.md`.

Manager: orca
Agent: omp
Trunk: main
Max workers: 3
Scarce resources: none
Fix rounds: 2
Required checks: none
Trunk checks: none
Wake timeout: 15 minutes
Memory: ~/.local/share/factory/skills
