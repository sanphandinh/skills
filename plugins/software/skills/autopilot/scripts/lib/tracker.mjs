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
