// The brief autopilot leaves whenever it hands work to a human: what to
// decide, why it stopped, the options with a recommendation, and links.
const SITUATIONS = {
  // The pull request is fine as far as the machine can tell, but the merge
  // policy wants a human.
  policy: {
    decide: "Review this pull request and merge it, or ask for changes.",
    options: [
      ["Merge it yourself", "autopilot closes the ticket and publishes the handoff on its next tick"],
      ["Set the ticket back to ready-for-agent with a comment saying what to change", "autopilot reworks it with your comment as the finding"],
      ["Close the pull request", "autopilot leaves the ticket alone"],
    ],
    recommend: 0,
  },
  // The machine tried and could not get the ticket through its gates.
  stuck: {
    decide: "Decide how this ticket continues.",
    options: [
      ["Set the ticket back to ready-for-agent with a comment saying what to change", "autopilot reworks it with your comment as the finding and fresh fix rounds"],
      ["Fix it on the branch yourself and merge", "autopilot closes the ticket after the merge"],
      ["Close the pull request or the ticket", "autopilot drops it"],
    ],
    recommend: 0,
  },
  // The ticket or its spec is wrong, not the code.
  spec: {
    decide: "Fix the ticket or its spec; the code cannot satisfy it as written.",
    options: [
      ["Edit the ticket or spec, then set the ticket back to ready-for-agent", "autopilot builds against the corrected text"],
      ["Close the ticket", "autopilot drops it"],
    ],
    recommend: 0,
  },
  // The ticket cannot be verified as written.
  triage: {
    decide: "Make every acceptance criterion verifiable, then approve the ticket.",
    options: [
      ["Add a `Verify:` line under each acceptance criterion and set the ticket to ready-for-agent", "autopilot builds it"],
      ["Close the ticket", "autopilot drops it"],
    ],
    recommend: 0,
  },
  // A large or risky breakdown waits for approval.
  approval: {
    decide: "Approve the ticket breakdown.",
    options: [
      ["Review the tickets and set each one you approve to ready-for-agent", "autopilot builds the approved ones"],
      ["Edit or delete tickets first", "autopilot only builds what you approve"],
    ],
    recommend: 0,
  },
  // Trunk is red.
  fix: {
    decide: "Restore trunk: merge the fix or the revert, or fix it yourself.",
    options: [
      ["Merge the revert pull request if there is one", "trunk goes back to the last green state; the ticket can be rebuilt later"],
      ["Let autopilot build this fix ticket, then review and merge its pull request", "fix pull requests never auto-merge"],
      ["Fix trunk yourself", "autopilot resumes merging once trunk is green"],
    ],
    recommend: 1,
  },
};

export function brief(situation, { why, links = [], trunkRed = false }) {
  const s = SITUATIONS[situation] ?? SITUATIONS.stuck;
  const options = s.options.map(([o, effect], i) => `${i + 1}. ${o}: ${effect}.${i === s.recommend ? " **(recommended)**" : ""}`);
  return [
    "## Autopilot needs you",
    "",
    `**Decide:** ${s.decide}`,
    "",
    `**Why autopilot stopped:** ${why}`,
    ...(trunkRed ? ["", "**Trunk:** CI is red; a fix pull request must merge before this one can."] : []),
    "",
    "**Options:**",
    "",
    ...options,
    ...(links.filter(Boolean).length ? ["", "**Links:**", "", ...links.filter(Boolean).map((l) => `- ${l}`)] : []),
  ].join("\n");
}
