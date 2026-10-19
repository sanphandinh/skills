// The merge policy (docs/agents/merge-policy.md) and the decision it drives.
// Some gates are mandatory and cannot be configured away.
import path from "node:path";

export const POLICY_DOC = "docs/agents/merge-policy.md";

export const DEFAULT_PROTECTED = [
  "migrations/",
  "infra/",
  ".github/",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "uv.lock",
  "Gemfile.lock",
  ".env",
  ".env.*",
];

const DEFAULT_BLAST = ["none", "low", "docs", "tests", "internal"];

function bullets(text, heading) {
  const m = text.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m"));
  if (!m) return null;
  return [...m[1].matchAll(/^- (.+)$/gm)].map((b) => b[1].trim()).filter((b) => b !== "(none)");
}

export function loadPolicy(text) {
  if (text === null) return { autoMerge: true, allowedBlast: DEFAULT_BLAST, protectedPaths: DEFAULT_PROTECTED };
  const auto = text.match(/^Auto-merge:\s*(\w+)/im)?.[1]?.toLowerCase();
  const unprotect = (bullets(text, "Unprotected defaults") ?? [])
    .map((b) => b.match(/^(.+?):\s*(\S.*)$/))
    .filter(Boolean)
    .map((m) => m[1].trim());
  return {
    autoMerge: auto !== "off",
    allowedBlast: (bullets(text, "Allowed blast radius") ?? DEFAULT_BLAST).map((b) => b.toLowerCase()),
    protectedPaths: [...DEFAULT_PROTECTED.filter((p) => !unprotect.includes(p)), ...(bullets(text, "Protected paths") ?? [])],
  };
}

// `dir/` matches that directory anywhere in the path; anything else is a
// basename glob (`*` only) or an exact path.
export function isProtected(file, patterns) {
  const segments = file.split("/");
  return patterns.find((p) => {
    if (p.endsWith("/")) {
      const want = p.slice(0, -1).split("/");
      return segments.some((_, i) => want.every((w, j) => segments[i + j] === w));
    }
    if (p.includes("/")) return file === p;
    const re = new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    return re.test(path.posix.basename(file));
  });
}

export function mergeDanger(prBody = "") {
  return {
    door: prBody.match(/\*\*Door:\*\*\s*([\w-]+)/i)?.[1]?.toLowerCase() ?? null,
    blast: prBody.match(/\*\*Blast Radius:\*\*\s*(.+)/i)?.[1]?.trim() ?? null,
  };
}

// Every reason a merge must wait for a human; an empty list means merge.
export function refusals(policy, facts) {
  const out = [];
  if (!policy.autoMerge) out.push("auto-merge is off in the merge policy");
  if (!facts.verifyDoc) out.push("no verification doc, so no verdict ran the product");
  const { door, blast } = mergeDanger(facts.prBody);
  if (door !== "two-way") out.push(door ? `${door} door` : "the pull request states no door");
  if (!blast) out.push("the pull request states no blast radius");
  else if (!policy.allowedBlast.includes(blast.toLowerCase())) out.push(`blast radius "${blast}" is not allowed`);
  for (const file of facts.changedFiles) {
    if (file.startsWith(".scratch/") || file.startsWith(".autopilot/")) continue;
    if (isProtected(file, policy.protectedPaths)) out.push(`protected path: ${file}`);
  }
  return out;
}
