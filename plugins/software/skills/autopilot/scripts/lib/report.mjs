// The end-of-run report, as plain markdown.
export function renderReport(report) {
  if (report.status === "refused") return `Autopilot refused to start: ${report.reason}`;
  const lines = [`Autopilot ${report.status}.`];
  for (const t of report.tickets) lines.push(`- ${t.id} ${t.title}: ${t.outcome}${t.pr ? ` (${t.pr})` : ""}${t.reason ? `. ${t.reason}` : ""}`);
  return lines.join("\n");
}
