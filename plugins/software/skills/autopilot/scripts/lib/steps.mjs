// The next step for one ticket, from facts read off the tracker, the ticket
// branch and its pull request. Pure: every rule that decides what happens
// next lives here, so it is tested as a table.
import { lastHandoff, latestGate, usage } from "./records.mjs";

// facts: {
//   ticket: { status, claimedBy }, me, blockers: [{ id, status }], verifiable,
//   branchExists, pr: null | { state: "open"|"merged"|"closed", draft },
//   records, patch, conflict: null | [files], humanNote,
//   limits: { fixRounds, tokens, timeMs },
// }
// Returns { step, ... }: none, finish, triage, implement, human, rework,
// gates, merge.
export function nextStep(facts) {
  const { ticket, pr, records = [], limits } = facts;
  const none = (why) => ({ step: "none", why });

  if (ticket.status === "closed") return none("closed");
  if (pr?.state === "merged") return { step: "finish" };
  if (pr?.state === "closed") return none("pull request closed by a human");
  if (ticket.status !== "ready-for-agent") return none(ticket.status ?? "no status");
  if (ticket.claimedBy && ticket.claimedBy !== facts.me) return none(`claimed by ${ticket.claimedBy}`);
  const waiting = (facts.blockers ?? []).filter((b) => b.status !== "closed");
  if (waiting.length) return none(`waiting on ${waiting.map((b) => `${b.id} (${b.status ?? "missing"})`).join(", ")}`);

  if (!pr) {
    if (!facts.verifiable && !facts.branchExists) return { step: "triage", why: "an acceptance criterion has no `Verify:` line saying how to check it" };
    return { step: "implement" };
  }

  // The human handed the ticket back after a brief.
  if (lastHandoff(records) === "brief") {
    return { step: "rework", humanReturn: true, counted: true, findings: [facts.humanNote ? `the human asked: ${facts.humanNote}` : "the human handed this back without a comment; re-read the ticket and the pull request"] };
  }

  const used = usage(records);
  if (limits.tokens != null && used.tokens > limits.tokens) return { step: "human", why: `over the token budget (${used.tokens} > ${limits.tokens})` };
  if (limits.timeMs != null && used.ms > limits.timeMs) return { step: "human", why: `over the time budget (${Math.round(used.ms / 60_000)} min)` };

  if (facts.conflict) return { step: "rework", counted: false, conflict: true, findings: [`merging trunk into the branch conflicts in: ${facts.conflict.join(", ") || "unknown files"}; resolve the conflicts keeping both intents`] };

  const gate = latestGate(records, facts.patch);
  if (!gate) return { step: "gates" };
  if (gate.blocking?.length) {
    if (used.fixRounds >= limits.fixRounds) return { step: "human", why: gate.blocking.join("; ") };
    return { step: "rework", counted: true, findings: gate.blocking };
  }
  return { step: "merge", gate };
}

// Steps that call no agent: cheap, never counted against runs per tick, and
// still allowed when the daily token limit is spent.
export const CHEAP = new Set(["merge", "finish", "human", "triage", "close-spec"]);

// Finish what is started before starting more.
export const PRIORITY = { finish: 0, merge: 0, human: 0, triage: 0, "close-spec": 0, gates: 2, rework: 3, implement: 4, decompose: 5 };

// The task each step belongs to, for the enabled-tasks setting.
export const TASK_OF = { implement: "implement", gates: "gates", rework: "rework", merge: "merge", finish: "merge", decompose: "decompose" };
