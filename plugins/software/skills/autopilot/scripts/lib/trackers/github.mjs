// Tracker adapter for GitHub Issues. A spec is an issue; its tickets are its
// sub-issues; blockers come from native issue dependencies, else a
// `Blocked by: #n` line; status is a triage label, or `closed` once the issue
// is closed as completed. Claims use the shared comment lock.
import { spawnSync } from "node:child_process";
import { claimWith, holder, releaseBody } from "./claims.mjs";
import { ALL_ROLES, roleOf } from "./labels.mjs";

// `gh api` as a transport: (method, path, body?) -> parsed JSON.
export function ghApi({ command = "gh", cwd } = {}) {
  return async (method, path, body) => {
    const args = ["api", "-X", method, path, "-H", "Accept: application/vnd.github+json"];
    if (body !== undefined) args.push("--input", "-");
    const r = spawnSync(command, args, { cwd, input: body === undefined ? undefined : JSON.stringify(body), encoding: "utf8" });
    if (r.status !== 0) throw new Error(`gh api ${method} ${path} failed: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
    return r.stdout.trim() ? JSON.parse(r.stdout) : null;
  };
}

const number = (ref) => Number(String(ref).match(/(\d+)\s*$/)?.[1]);
const field = (body, name) => String(body ?? "").match(new RegExp(`^(?:\\*\\*)?${name}:(?:\\*\\*)?\\s*(.+)$`, "mi"))?.[1]?.trim() ?? null;

export function githubTracker({ repo, spec, api, labels, cwd = process.cwd() }) {
  const specNo = number(spec);
  const issue = (n) => `repos/${repo}/issues/${n}`;
  const comments = (n) => api("GET", `${issue(n)}/comments?per_page=100`).then((c) => c ?? []);

  const status = (i) => {
    if (i.state === "closed") return i.state_reason === "not_planned" ? "wontfix" : "closed";
    return roleOf((i.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)), labels);
  };

  async function blockers(i) {
    let native = null;
    try {
      native = await api("GET", `${issue(i.number)}/dependencies/blocked_by?per_page=100`);
    } catch {
      native = null;
    }
    if (native?.length) return native.map((b) => String(b.number));
    const line = field(i.body, "Blocked by");
    return line && !/^none/i.test(line) ? [...line.matchAll(/#?(\d+)/g)].map((m) => m[1]) : [];
  }

  async function setRole(n, role) {
    for (const r of ALL_ROLES) {
      if (r === role) continue;
      await api("DELETE", `${issue(n)}/labels/${encodeURIComponent(labels[r])}`).catch(() => null);
    }
    if (role) await api("POST", `${issue(n)}/labels`, { labels: [labels[role]] });
  }

  async function list() {
    const subs = (await api("GET", `${issue(specNo)}/sub_issues?per_page=100`)) ?? [];
    const out = [];
    for (const i of subs) {
      const claim = holder(await comments(i.number));
      out.push({
        id: String(i.number),
        ref: `#${i.number}`,
        title: i.title,
        status: status(i),
        blockedBy: await blockers(i),
        claimedBy: claim?.who ?? null,
        door: field(i.body, "Door")?.toLowerCase() ?? null,
      });
    }
    return out.sort((a, b) => Number(a.id) - Number(b.id));
  }

  return {
    kind: "github",
    key: `gh-${specNo}`,
    trailDir: `.autopilot/gh-${specNo}/trail`,

    async spec() {
      try {
        const i = await api("GET", issue(specNo));
        return { ref: `#${specNo}`, status: status(i), title: i.title };
      } catch {
        return null;
      }
    },

    tickets: list,

    claim: (ticket, who) => claimWith({ comments: () => comments(ticket.id), post: (body) => api("POST", `${issue(ticket.id)}/comments`, { body }) }, who),

    async handToHuman(ticket, reason) {
      await setRole(ticket.id, "ready-for-human");
      const held = holder(await comments(ticket.id));
      await api("POST", `${issue(ticket.id)}/comments`, { body: releaseBody(held?.who ?? "autopilot", reason) });
    },

    pointer: (ticket) => `github ${repo}${String(ticket.ref).startsWith("#") ? ticket.ref : `#${number(ticket.ref)}`}`,
    prLink: (ticket) => `Closes ${repo}#${ticket.id}`,
    onBranch() {},

    // The handoff goes on the ticket once its code is on trunk; the issue is
    // closed if the pull request's closing keyword did not already do it.
    async afterMerge(ticket, { handoff, pr }) {
      await api("POST", `${issue(ticket.id)}/comments`, { body: `## Handoff\n\n${handoff.trim()}\n\nMerged in ${pr.url}` });
      const i = await api("GET", issue(ticket.id));
      if (i.state !== "closed") await api("PATCH", issue(ticket.id), { state: "closed", state_reason: "completed" });
    },

    splitPrompt: {
      where: `Spec issue: github ${repo}#${specNo}. Publish each ticket as a sub-issue of it, with a \`Blocked by:\` line or native dependencies.`,
      rule: "Create issues only; change no file in the repository.",
    },

    async split({ runSplitter, statusFor, trailRows }) {
      const result = await runSplitter(cwd);
      if (!result.ok) return { stop: `splitting the spec failed: ${result.output?.error ?? result.output?.note ?? "no reason given"}` };
      const tickets = await list();
      if (!tickets.length) return { stop: "the split published no sub-issues" };
      const role = statusFor(tickets);
      for (const t of tickets) await setRole(t.id, role);
      await api("POST", `${issue(specNo)}/comments`, { body: `Autopilot split this spec:\n\n\`\`\`tsv\n${trailRows(result)}\`\`\`` });
      return { tickets };
    },
  };
}
