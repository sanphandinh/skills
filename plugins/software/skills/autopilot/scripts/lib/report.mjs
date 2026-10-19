// The end-of-run report, as plain markdown grouped by what each ticket needs.
const SECTIONS = [
  ["merged", "Merged", (t) => `${t.pr}`],
  ["ready-for-human", "Waiting for a human", (t) => `${t.reason}${t.pr ? ` (${t.pr})` : ""}`],
  ["blocked", "Blocked", (t) => t.reason],
  ["needs-approval", "Needs approval", null],
  ["needs-triage", "Needs approval", null],
  ["ready", "Ready", null],
];

export function renderReport(report) {
  if (report.status === "refused") return `Autopilot refused to start: ${report.reason}`;
  const lines = [`# Autopilot ${report.status}`];
  if (report.reason) lines.push("", report.reason);
  const groups = new Map();
  for (const [outcome, heading, detail] of SECTIONS) {
    for (const t of report.tickets.filter((x) => x.outcome === outcome)) {
      if (!groups.has(heading)) groups.set(heading, []);
      groups.get(heading).push(`- ${t.id} ${t.title}${detail ? `: ${detail(t)}` : ""}`);
    }
  }
  for (const [heading, items] of groups) lines.push("", `## ${heading}`, "", ...items);
  if (!report.tickets.length) lines.push("", "Nothing to do: no ticket is ready, and none is claimed under this run's name.");
  return lines.join("\n");
}
