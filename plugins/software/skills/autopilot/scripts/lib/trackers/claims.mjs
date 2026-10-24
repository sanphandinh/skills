// Claim lock for trackers with no atomic write: every claimant posts a claim
// comment with a nonce, then re-reads; the earliest claim not released since
// holds the ticket. Shared by the remote tracker adapters.
import { randomBytes } from "node:crypto";

// Markers match with or without the HTML comment around them, because some
// trackers (Jira) store comments as rich text and drop HTML comments.
const CLAIM = /autopilot:claim who=(\S+) nonce=([0-9a-z]+)/;
const RELEASE = /autopilot:release who=([^\s\]]+?)(?:\s|\]|-->|$)/;

export const claimBody = (who, nonce) => `<!-- autopilot:claim who=${who} nonce=${nonce} -->\nClaimed by ${who} for an unattended build.`;
export const releaseBody = (who, reason) => `<!-- autopilot:release who=${who} -->\nAutopilot handed this to a human: ${reason}`;
export const newNonce = () => randomBytes(6).toString("hex");

// `comments` oldest first, each `{ body }`. Returns `{ who, nonce }` or null.
export function holder(comments) {
  let current = null;
  for (const c of comments) {
    const claim = String(c.body ?? "").match(CLAIM);
    if (claim && !current) current = { who: claim[1], nonce: claim[2] };
    const release = String(c.body ?? "").match(RELEASE);
    if (release && current?.who === release[1]) current = null;
  }
  return current;
}

// Post a claim and decide it: "claimed", "resumed" (already held under this
// name), or false.
export async function claimWith({ comments, post }, who) {
  const before = holder(await comments());
  if (before) return before.who === who ? "resumed" : false;
  const nonce = newNonce();
  await post(claimBody(who, nonce));
  const after = holder(await comments());
  return after?.who === who && after.nonce === nonce ? "claimed" : false;
}
