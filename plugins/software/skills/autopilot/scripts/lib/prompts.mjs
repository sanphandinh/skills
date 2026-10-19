// Prompts handed to each role. They carry context pointers (paths on the
// branch the agent works on), never pasted contents, and end by asking for a
// JSON result the orchestrator reads.

const footer = (shape) =>
  `\nEnd your reply with one fenced \`\`\`json block holding exactly this object, and nothing after it:\n${shape}\n`;

const pause =
  "Always stop and report instead of acting on anything irreversible: force-pushing a shared branch, deploying, deleting data, or messaging customers.";

export function implementerPrompt({ spec, ticket, trackerDoc, blockers, findings }) {
  return [
    "Agent: implementer",
    `Spec: ${spec}`,
    `Ticket: ${ticket}`,
    `Tracker doc: ${trackerDoc}`,
    ...blockers.map((b) => `Blocker handoff: ${b}`),
    ...findings.map((f) => `Finding to fix: ${f}`),
    "",
    "Build this one ticket with the `tdd` skill at the seams the spec names, and commit on the current branch.",
    "Before starting, read every blocker handoff. If one contradicts the ticket, follow the handoff and say so in `handoffConflict`.",
    "When done, append the ticket's `## Handoff` section using the tracker doc's template, and commit it.",
    "Write the pull request body with the `pr` skill, including its Merge Danger section.",
    "Do not review your own work; independent reviewers follow.",
    pause,
    footer(
      '{ "ok": true, "prBody": "<markdown>", "decisions": [{ "decision": "...", "reason": "..." }], "handoffConflict": null | { "touchesAcceptance": false, "note": "..." } }',
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
    "Do not edit files.",
    footer(
      axis === "spec"
        ? '{ "verdict": "pass" | "fail", "summary": "...", "findings": [{ "kind": "missing" | "partial" | "scope-creep" | "wrong", "requirement": "...", "detail": "..." }] }'
        : '{ "verdict": "pass" | "fail", "summary": "...", "findings": [{ "file": "...", "rule": "...", "severity": "hard" | "judgement", "detail": "..." }] }',
    ),
  ].join("\n");
}
