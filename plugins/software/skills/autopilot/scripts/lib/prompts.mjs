// Prompts handed to each role. They carry context pointers (paths on the
// branch the agent works on), never pasted contents, and end by asking for a
// JSON result the orchestrator reads.

const footer = (shape) =>
  `\nEnd your reply with one fenced \`\`\`json block holding exactly this object, and nothing after it:\n${shape}\n`;

const pause =
  "Always stop and report instead of acting on anything irreversible: force-pushing a shared branch, deploying, deleting data, or messaging customers.";

export function implementerPrompt({ spec, ticket, branch, trackerDoc, blockers, findings }) {
  return [
    "Agent: implementer",
    `Spec: ${spec}`,
    `Ticket: ${ticket}`,
    `Branch: ${branch}`,
    `Tracker doc: ${trackerDoc}`,
    ...blockers.map((b) => `Blocker handoff: ${b}`),
    ...findings.map((f) => `Finding to fix: ${f}`),
    "",
    findings.length
      ? "This is a fix round: the branch already holds an earlier attempt. Fix every finding above without dropping anything the ticket asks for, and commit."
      : "Build this one ticket with the `tdd` skill at the seams the spec names, and commit on the current branch.",
    "Read the spec, the ticket, and every blocker's handoff the way the tracker doc says. If a handoff contradicts the ticket, follow the handoff and say so in `handoffConflict`.",
    "If the ticket or its spec is itself wrong (contradictory acceptance criteria, a design that cannot work), stop and say so in `specConflict` instead of building around it.",
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

export function verifierPrompt({ spec, ticket, verifyDoc }) {
  return [
    "Agent: verifier",
    `Spec: ${spec}`,
    `Ticket: ${ticket}`,
    verifyDoc ? `Verification doc: ${verifyDoc}` : "Verification doc: none (fall back to tests, typecheck, and reading the change)",
    "",
    "You did not write this change. Prove the ticket's behaviour works on the real product the way a user would, following the verification doc. Do not edit code.",
    pause,
    footer('{ "verdict": "PASS" | "PASS+NOTES" | "FAIL", "evidence": "what you ran and observed", "notes": "..." }'),
  ].join("\n");
}

export function reviewPrompt({ axis, spec, ticket, base }) {
  return [
    `Agent: review-${axis}`,
    `Spec: ${spec}`,
    `Ticket: ${ticket}`,
    `Diff: git diff ${base}...HEAD`,
    "",
    axis === "spec"
      ? "Review only whether the diff implements what the ticket and spec ask for, and nothing else."
      : "Review only whether the diff follows this repository's documented standards and the smell baseline.",
    "Do not edit files. If the ticket or spec is itself contradictory or impossible, say so in `specConflict` instead of failing the code.",
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
