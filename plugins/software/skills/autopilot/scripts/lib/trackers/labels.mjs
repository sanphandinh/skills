// Canonical triage roles to the label strings in docs/agents/triage-labels.md
// (a markdown table: | `role` | `label` | meaning |). Missing doc: identity.
// A `spec` row names the label that marks an issue as a spec.
const ROLES = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"];

const rows = (doc) =>
  String(doc ?? "")
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim().replace(/^`|`$/g, "")))
    .filter((cells) => cells.length > 3 && cells[2]);

export function labelMap(doc) {
  const map = Object.fromEntries([...ROLES, "spec"].map((r) => [r, r]));
  for (const cells of rows(doc)) if (ROLES.includes(cells[1]) || cells[1] === "spec") map[cells[1]] = cells[2];
  return map;
}

// The canonical triage role a set of labels expresses, or null.
export function roleOf(labels, map) {
  const names = new Set(labels);
  return ROLES.find((r) => names.has(map[r])) ?? null;
}

export const ALL_ROLES = ROLES;
