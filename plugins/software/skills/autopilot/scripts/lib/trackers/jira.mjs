// Tracker adapter for Jira Cloud (REST v3). A spec is an epic; its tickets are
// the issues whose parent is the epic. With no spec, the adapter serves the
// standalone tickets: open issues with no parent that are not epics. Blockers come from "Blocks" links (the
// inward "is blocked by" side) or a `Blocked by:` line; status is the Jira
// workflow status mapped by the tracker doc's `Jira statuses:` line, moved with
// transitions. Pull requests live on a separate forge.
import { latestHumanNote } from "../tracker.mjs";
import { claimWith, holder, releaseBody } from "./claims.mjs";

const DEFAULT_STATUSES = { "needs-triage": "Backlog", "ready-for-agent": "To Do", "ready-for-human": "Blocked", closed: "Done" };

// `Jira statuses: ready-for-agent=To Do, closed=Done` -> role map.
export function jiraStatuses(doc) {
  const line = String(doc ?? "").match(/^(?:\*\*)?Jira statuses:(?:\*\*)?\s*(.+)$/im)?.[1];
  const map = { ...DEFAULT_STATUSES };
  for (const pair of String(line ?? "").split(",")) {
    const [role, name] = pair.split("=").map((x) => x?.trim());
    if (role && name) map[role] = name;
  }
  return map;
}

// fetch as a transport. Credentials only ever go into the Authorization header.
export function jiraApi({ site, email, token, fetchImpl = globalThis.fetch }) {
  if (!email || !token) throw new Error("Jira needs JIRA_EMAIL and JIRA_API_TOKEN in the environment");
  const auth = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  return async (method, path, body) => {
    const res = await fetchImpl(`${site.replace(/\/$/, "")}/rest/api/3/${path}`, {
      method,
      headers: { Authorization: auth, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Jira ${method} ${path} failed with ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
}

// Plain text of an Atlassian Document Format value (or a plain string).
export function adfText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(adfText).join(node.type === "doc" ? "\n" : "");
  return node.type === "paragraph" || node.type === "heading" ? `${inner}\n` : inner;
}

const adf = (text) => ({
  type: "doc",
  version: 1,
  content: String(text)
    .split("\n")
    .map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
});

const field = (text, name) => String(text ?? "").match(new RegExp(`^(?:\\*\\*)?${name}:(?:\\*\\*)?\\s*(.+)$`, "mi"))?.[1]?.trim() ?? null;

// Open epics in the project: ["APP-1", ...].
export async function jiraSpecs({ project, api }) {
  const jql = `project = ${project} AND issuetype = Epic AND statusCategory != Done ORDER BY key ASC`;
  const r = await api("GET", `search/jql?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=100`);
  return (r?.issues ?? []).map((i) => i.key);
}

export function jiraTracker({ project, spec, api, statuses = DEFAULT_STATUSES, cwd = process.cwd() }) {
  const roleOf = (status) => {
    const name = status?.name;
    if (status?.statusCategory?.key === "done" || name === statuses.closed) return "closed";
    return Object.entries(statuses).find(([, n]) => n === name)?.[0] ?? null;
  };
  const comments = (key) =>
    api("GET", `issue/${key}/comment?orderBy=created&maxResults=100`).then((r) => (r?.comments ?? []).map((c) => ({ body: adfText(c.body) })));
  // Rich text drops HTML comments, so markers are posted as visible brackets.
  const post = (key, text) => api("POST", `issue/${key}/comment`, { body: adf(String(text).replace(/<!-- (.*?) -->/g, "[$1]")) });

  async function moveTo(key, role) {
    const want = statuses[role];
    const { transitions = [] } = (await api("GET", `issue/${key}/transitions`)) ?? {};
    const t = transitions.find((x) => x.to?.name === want);
    if (!t) throw new Error(`Jira ${key}: no transition to "${want}" (${role}); fix the Jira statuses line in the tracker doc`);
    await api("POST", `issue/${key}/transitions`, { transition: { id: t.id } });
  }

  async function list() {
    const jql = spec ? `parent = ${spec} ORDER BY key ASC` : `project = ${project} AND parent is EMPTY AND issuetype != Epic AND statusCategory != Done ORDER BY key ASC`;
    const r = await api("GET", `search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,issuelinks,description&maxResults=100`);
    const out = [];
    for (const i of r?.issues ?? []) {
      const text = adfText(i.fields.description);
      const native = (i.fields.issuelinks ?? []).filter((l) => l.type?.name === "Blocks" && l.inwardIssue).map((l) => l.inwardIssue.key);
      const line = field(text, "Blocked by");
      out.push({
        id: i.key,
        ref: i.key,
        title: i.fields.summary,
        status: roleOf(i.fields.status),
        blockedBy: native.length ? native : line && !/^none/i.test(line) ? line.split(/[\s,]+/).filter((k) => /^[A-Z][A-Z0-9]*-\d+$/.test(k)) : [],
        claimedBy: holder(await comments(i.key))?.who ?? null,
        door: field(text, "Door")?.toLowerCase() ?? null,
        body: text,
      });
    }
    return out;
  }

  const key = spec ? `jira-${spec}` : `jira-${project}`;

  return {
    kind: "jira",
    key,
    trailDir: `.autopilot/${key}/trail`,
    stateDir: `.autopilot/${key}`,

    async spec() {
      if (!spec) return { ref: null, status: "ready-for-agent", standalone: true };
      try {
        const i = await api("GET", `issue/${spec}?fields=summary,status`);
        return { ref: spec, status: roleOf(i.fields.status), title: i.fields.summary };
      } catch {
        return null;
      }
    },

    tickets: list,

    async statusOf(id) {
      try {
        return roleOf((await api("GET", `issue/${id}?fields=status`)).fields.status);
      } catch {
        return null;
      }
    },

    claim: (ticket, who) => claimWith({ comments: () => comments(ticket.id), post: (body) => post(ticket.id, body) }, who),

    async handToHuman(ticket, reason) {
      await moveTo(ticket.id, "ready-for-human");
      const held = holder(await comments(ticket.id));
      await post(ticket.id, releaseBody(held?.who ?? "autopilot", reason));
    },

    async setStatus(ticket, role, note) {
      await moveTo(ticket.id, role);
      if (note) await post(ticket.id, note);
    },

    async comment(ticket, body) {
      const key = ticket ? ticket.id : spec;
      if (key) await post(key, body);
    },

    async humanNote(ticket) {
      return latestHumanNote((await comments(ticket.id)).map((c) => c.body));
    },

    pointer: (ticket) => `jira ${ticket.ref}`,
    prLink: (ticket) => `Jira: ${ticket.id}`,

    async afterMerge(ticket, { handoff, pr }) {
      await post(ticket.id, `## Handoff\n\n${String(handoff ?? "").trim()}\n\nMerged in ${pr.url}`);
      await moveTo(ticket.id, "closed");
    },

    async closeSpec(summary) {
      if (!spec) return;
      await post(spec, summary);
      await moveTo(spec, "closed");
    },

    async createTicket({ title, body }) {
      const created = await api("POST", "issue", { fields: { project: { key: project }, summary: title, issuetype: { name: "Task" }, description: adf(body) } });
      const ticket = (await list()).find((t) => t.id === created.key);
      if (ticket && ticket.status !== "ready-for-agent") await moveTo(created.key, "ready-for-agent");
      return { ...(ticket ?? { id: created.key, ref: created.key, title, blockedBy: [], claimedBy: null, body }), status: "ready-for-agent" };
    },

    splitPrompt: {
      where: `Spec epic: jira ${spec} in project ${project}. Publish each ticket as an issue whose parent is the epic, with "Blocks" links or a \`Blocked by:\` line.`,
      rule: "Create issues only; change no file in the repository.",
    },

    async split({ runSplitter, statusFor, trailRows }) {
      const result = await runSplitter(cwd);
      if (!result.ok) return { stop: `splitting the spec failed: ${result.output?.error ?? result.output?.note ?? "no reason given"}` };
      const tickets = await list();
      if (!tickets.length) return { stop: "the split published no issues under the epic" };
      const role = statusFor(tickets);
      for (const t of tickets) if (t.status !== role) await moveTo(t.id, role);
      await post(spec, `Autopilot split this spec:\n${trailRows(result)}`);
      return { tickets };
    },
  };
}
