// Reading and editing local-markdown tracker files (see the tracker doc's
// claiming, closing, and handoff conventions). Fields are `Name: value` lines,
// optionally bold (`**Name:** value`).
import path from "node:path";

const fieldRe = (name) => new RegExp(`^(\\*\\*)?${name}:(\\*\\*)?[ \\t]*(.*)$`, "m");

export function getField(text, name) {
  return text.match(fieldRe(name))?.[3].trim() ?? null;
}

// Replace a field in place, keeping its bold style; insert a new one under the
// title (or at the top when there is no title).
export function setField(text, name, value) {
  const re = fieldRe(name);
  const m = text.match(re);
  if (m) return text.replace(re, `${m[1] ?? ""}${name}:${m[2] ?? ""} ${value}`);
  const lines = text.split("\n");
  const at = lines[0].startsWith("# ") ? 1 : 0;
  lines.splice(at, 0, ...(at ? ["", `${name}: ${value}`] : [`${name}: ${value}`]));
  return lines.join("\n");
}

export function removeField(text, name) {
  return text.replace(new RegExp(`^(\\*\\*)?${name}:(\\*\\*)?.*\\n?`, "m"), "");
}

export function hasSection(text, heading) {
  return new RegExp(`^## ${heading}\\s*$`, "m").test(text);
}

export function appendComment(text, body) {
  const withHeading = hasSection(text, "Comments") ? text : `${text.replace(/\n*$/, "\n")}\n## Comments\n`;
  return `${withHeading.replace(/\n*$/, "\n")}\n${body}\n`;
}

export function tickAll(text) {
  return text.replace(/^- \[ \]/gm, "- [x]");
}

// Every acceptance criterion (a checkbox line) names how to check it on a
// `Verify:` line, on the same line or the next one. A ticket with no checkbox
// needs at least one `Verify:` line.
const VERIFY = /^\s*(?:[-*]\s+)?(?:\*\*)?Verify:/i;

export function verifiable(text) {
  const lines = String(text ?? "").split("\n");
  const boxes = lines.map((l, i) => [l, i]).filter(([l]) => /^\s*[-*]\s+\[[ xX]\]/.test(l));
  if (!boxes.length) return lines.some((l) => VERIFY.test(l));
  return boxes.every(([l, i]) => /Verify:/i.test(l) || VERIFY.test(lines.slice(i + 1).find((x) => x.trim()) ?? ""));
}

// The handoff without a heading of its own: trackers add `## Handoff`.
export const handoffBody = (text) => String(text ?? "").replace(/^\s*#{1,6}\s*Handoff\s*\n+/i, "").trim();

// A fix ticket carries this marker with the first red trunk commit.
export const FIX_MARK = /autopilot:fix first-red=([0-9a-f]+)/;

// The human's latest words in a list of comment bodies (oldest first): the
// comments after the last one autopilot wrote.
export function latestHumanNote(bodies) {
  const mine = (b) => /autopilot:|^Autopilot\b|^## Autopilot/m.test(b);
  let last = -1;
  bodies.forEach((b, i) => mine(b) && (last = i));
  const after = bodies.slice(last + 1).map((b) => b.trim()).filter(Boolean);
  return after.length ? after.join("\n\n") : null;
}

export function parseTicket(rel, text) {
  const file = path.posix.basename(rel);
  const id = file.match(/^(\d+)/)?.[1];
  const title = text.match(/^# (?:\d+: )?(.+)$/m)?.[1]?.trim() ?? file;
  const blocked = getField(text, "Blocked by") ?? "";
  const blockedBy = /^none/i.test(blocked) ? [] : [...blocked.matchAll(/\d+/g)].map((m) => m[0].padStart(id?.length ?? 2, "0"));
  return {
    id,
    rel,
    title,
    text,
    status: getField(text, "Status"),
    blockedBy,
    claimedBy: getField(text, "Claimed-by"),
    door: getField(text, "Door"),
  };
}
