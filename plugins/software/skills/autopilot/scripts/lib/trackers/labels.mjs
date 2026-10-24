// Canonical triage roles to the label strings in docs/agents/triage-labels.md
// (a markdown table: | `role` | `label` | meaning |). Missing doc: identity.
const ROLES = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"];

export function labelMap(doc) {
  const map = Object.fromEntries(ROLES.map((r) => [r, r]));
  for (const line of String(doc ?? "").split("\n")) {
    const cells = line.split("|").map((c) => c.trim().replace(/^`|`$/g, ""));
    if (cells.length > 3 && ROLES.includes(cells[1]) && cells[2]) map[cells[1]] = cells[2];
  }
  return map;
}

// The canonical role a set of labels expresses, or null.
export function roleOf(labels, map) {
  const names = new Set(labels);
  return ROLES.find((r) => names.has(map[r])) ?? null;
}

export const ALL_ROLES = ROLES;
