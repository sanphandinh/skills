// Prompts handed to each role. They carry context pointers (paths on the
// branch the agent works on), never pasted contents, and end by asking for a
// JSON result the orchestrator reads.

const footer = (shape) =>
  `\nEnd your reply with one fenced \`\`\`json block holding exactly this object, and nothing after it:\n${shape}\n`;

const pause =
  "Always stop and report instead of acting on anything irreversible: force-pushing a shared branch, deploying, deleting data, or messaging customers.";

export function implementerPrompt({ ticket, branch, trackerDoc, blockers, findings }) {
  return [
    "Agent: implementer",
    `Ticket: ${ticket}`,
    `Branch: ${branch}`,
    `Tracker doc: ${trackerDoc}`,
    ...blockers.map((b) => `Blocker handoff: ${b}`),
    ...findings.map((f) => `Finding to fix: ${f}`),
    "",
    findings.length
      ? "This is a fix round: the branch already holds an earlier attempt. Fix every finding above without dropping anything the ticket asks for, and commit."
      : "Build this one ticket with the `tdd` skill at the seams the ticket names, and commit on the current branch.",
    "The ticket's acceptance criteria, Scope boundary, and Invariants are the whole contract. A parent spec is context only; do not expand into a sibling ticket's scope.",
    "Read the ticket and every blocker's handoff the way the tracker doc says. If a handoff contradicts the ticket, follow the handoff and say so in `handoffConflict`.",
    "If the ticket is internally contradictory or impossible, stop and say so in `specConflict` instead of building around it.",
    "Return the ticket's handoff in `handoff`, filled from the tracker doc's handoff template; autopilot places it on the ticket. Do not edit the ticket yourself.",
    "Write the pull request body with the `pr` skill, including its Merge Danger section. Its Blast Radius must be one of the words under \"Allowed blast radius\" in docs/agents/merge-policy.md (by default none, low, docs, tests, internal) whenever the change fits one; otherwise name the impact plainly, and a human will review it.",
    "On a fix round, return the full pull request body again in `prBody`, and the complete handoff for the whole ticket in `handoff`, not only this round: both replace the old ones.",
    "Do not review your own work; independent reviewers follow.",
    pause,
    footer(
      '{ "ok": true, "handoff": "<markdown>", "prBody": "<markdown>", "decisions": [{ "decision": "...", "reason": "..." }], "handoffConflict": null | { "touchesAcceptance": false, "note": "..." }, "specConflict": null | { "note": "..." } }',
    ),
  ].join("\n");
}

export function verifierPrompt({ ticket, verifyDoc }) {
  return [
    "Agent: verifier",
    `Ticket: ${ticket}`,
    verifyDoc ? `Verification doc: ${verifyDoc}` : "Verification doc: none (fall back to tests, typecheck, and reading the change)",
    "",
    "You did not write this change. Prove this ticket's acceptance criteria work on the real product the way a user would, following the verification doc. Verify only this ticket; do not read the parent spec or sibling tickets. Do not edit code.",
    pause,
    footer('{ "verdict": "PASS" | "PASS+NOTES" | "FAIL", "evidence": "what you ran and observed", "notes": "..." }'),
  ].join("\n");
}

export function reviewPrompt({ axis, ticket, base }) {
  return [
    `Agent: review-${axis}`,
    `Ticket: ${ticket}`,
    `Diff: git diff ${base}...HEAD`,
    "",
    axis === "spec"
      ? "Review only whether the diff implements this ticket's acceptance criteria and Scope boundary, and nothing outside it. Do not read the parent spec or sibling tickets; a sibling's scope is out of bounds even if the parent spec mentions it."
      : "Review only whether the diff follows this repository's documented standards and the smell baseline. Do not evaluate ticket scope.",
    "Do not edit files. If the ticket is internally contradictory or impossible, say so in `specConflict` instead of failing the code.",
    footer(
      axis === "spec"
        ? '{ "verdict": "pass" | "fail", "summary": "...", "findings": [{ "kind": "missing" | "partial" | "scope-creep" | "wrong", "requirement": "...", "detail": "..." }], "specConflict": null | { "note": "..." } }'
        : '{ "verdict": "pass" | "fail", "summary": "...", "findings": [{ "file": "...", "rule": "...", "severity": "hard" | "judgement", "detail": "..." }] }',
    ),
  ].join("\n");
}

export function splitterPrompt({ spec, trackerDoc, where, rule, toTickets }) {
  return [
    "Agent: splitter",
    `Spec: ${spec}`,
    `Tracker doc: ${trackerDoc}`,
    where,
    `Process: ${toTickets}`,
    "",
    "Read the process file above and follow its unattended mode: break the spec into tickets with no quiz, and publish them the way the tracker doc says.",
    "Give every ticket a `**Door:**` line (`one-way` or `two-way`), and order foundation and low-risk tickets first and one-way-door tickets last.",
    rule,
    footer('{ "ok": true, "decisions": [{ "decision": "...", "reason": "..." }] }'),
  ].join("\n");
}
