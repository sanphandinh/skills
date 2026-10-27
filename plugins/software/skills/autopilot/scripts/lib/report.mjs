// The end-of-run report, as plain markdown grouped by what each ticket needs.
const SECTIONS = [
  ["merged", "Merged", (t) => `${t.pr}`],
  ["ready-for-human", "Waiting for a human", (t) => `${t.reason}${t.pr ? ` (${t.pr})` : ""}`],
  ["wait-ci", "Waiting for CI", (t) => `${t.pr}`],
  ["line-stopped", "Trunk is red", (t) => `${t.reason}${t.pr ? ` (${t.pr})` : ""}`],
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

// The board from `status`, as plain markdown.
export function renderStatus(board) {
  const tokens = board.tokensPerDay == null ? `${board.tokensToday} (no daily limit)` : `${board.tokensToday} of ${board.tokensPerDay}`;
  const lines = ["# Autopilot status", "", `Trunk: ${board.trunk} · Paused: ${board.paused ? "yes" : "no"} · Tokens today: ${tokens}`];
  const section = (heading, rows, detail) => {
    if (!rows.length) return;
    lines.push("", `## ${heading}`, "", ...rows.map((r) => `- ${r.id}${r.title ? ` ${r.title}` : ""}${detail(r) ? `: ${detail(r)}` : ""}`));
  };
  section("In flight", board.inFlight, (r) => r.pr ?? r.step);
  section("Ready", board.ready, (r) => r.pr ?? r.step);
  section("Waiting for you", board.waiting, (r) => r.pr ?? r.why);
  section("Specs", board.specs, (r) => r.status);
  section("Blocked", board.blocked, (r) => r.why);
  section("Needs triage", board.needsTriage, () => "");
  section("Merged in the last day", board.merged, (r) => r.pr);
  return lines.join("\n");
}
