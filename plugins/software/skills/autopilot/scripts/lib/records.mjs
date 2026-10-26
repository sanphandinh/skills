// Run records: append-only marker comments a run leaves on the ticket's pull
// request. The next run reads them instead of remembering (ADR-0001).
const MARK = /<!-- autopilot:record (\{.*?\}) -->/;

// The JSON rides inside an HTML comment, so it must never contain "-->".
export function formatRecord(record, line = "") {
  const json = JSON.stringify(record).replace(/-->/g, "--\\u003e");
  return `<!-- autopilot:record ${json} -->\n${line || summaryLine(record)}`;
}

export function parseRecord(body) {
  const m = String(body ?? "").match(MARK);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export const parseRecords = (comments) => comments.map(parseRecord).filter(Boolean);

export const isRecord = (body) => MARK.test(String(body ?? ""));

function summaryLine(r) {
  const parts = [`autopilot ${r.kind}`];
  if (r.patch) parts.push(`patch ${String(r.patch).slice(0, 12)}`);
  if (r.verdict) parts.push(r.verdict);
  if (r.attempts) parts.push(`${r.attempts} attempt(s)`);
  return parts.join(" · ");
}

// Records since the human last handed the ticket back; a human return resets
// the fix rounds and the budget.
export function sinceHuman(records) {
  const i = records.map((r) => r.kind).lastIndexOf("human-return");
  return i === -1 ? records : records.slice(i);
}

export function usage(records) {
  const live = sinceHuman(records);
  const sum = (key) => live.reduce((n, r) => n + (Number(r[key]) || 0), 0);
  const attempts = live.filter((r) => r.counted !== false).reduce((n, r) => n + (Number(r.attempts) || 0), 0);
  return { tokens: sum("tokens"), ms: sum("ms"), fixRounds: Math.max(0, attempts - 1) };
}

// The verdict that covers the current patch: gates on that patch, run after
// the last implementer run, so every rework gets fresh gates.
const WORK = new Set(["implement", "rework", "human-return"]);

export function latestGate(records, patch) {
  const lastWork = records.findLastIndex((r) => WORK.has(r.kind));
  return records.findLast((r, i) => i > lastWork && r.kind === "gates" && r.patch === patch) ?? null;
}

// The last hand-off between the machine and the human: "brief" means the
// human holds the ticket, "human-return" that they gave it back.
export function lastHandoff(records) {
  return [...records].reverse().find((r) => r.kind === "brief" || r.kind === "human-return")?.kind ?? null;
}

export const trailRows = (records) => records.flatMap((r) => r.rows ?? []);
