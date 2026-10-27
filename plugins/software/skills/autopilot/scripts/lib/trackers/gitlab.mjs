// GitLab adapters over the REST v4 API. Tracker: a spec is an issue with the
// spec label, its tickets are the issues linked to it (`relates_to`); with no
// spec, the adapter serves standalone tickets (open issues with a triage role
// that are neither a spec nor linked to an open spec). Blockers come from
// `is_blocked_by` links or a `Blocked by: #n` line, and status is a triage
// label or `closed`. Forge: merge requests on the configured project.
import { spawnSync } from "node:child_process";
import { latestHumanNote } from "../tracker.mjs";
import { claimWith, holder, releaseBody } from "./claims.mjs";
import { ALL_ROLES, roleOf } from "./labels.mjs";

// `glab api` as a transport: (method, path, body?) -> parsed JSON. Flat
// bodies only, sent as fields.
export function glabApi({ command = "glab", cwd } = {}) {
  return async (method, path, body) => {
    const args = ["api", "--method", method, path];
    for (const [k, v] of Object.entries(body ?? {})) args.push(typeof v === "string" ? "--raw-field" : "--field", `${k}=${v}`);
    const r = spawnSync(command, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`glab api ${method} ${path} failed: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
    return r.stdout.trim() ? JSON.parse(r.stdout) : null;
  };
}

const iidOf = (ref) => Number(String(ref).match(/(\d+)\s*$/)?.[1]);
const field = (body, name) => String(body ?? "").match(new RegExp(`^(?:\\*\\*)?${name}:(?:\\*\\*)?\\s*(.+)$`, "mi"))?.[1]?.trim() ?? null;

// Open spec issues: ["#12", ...].
export async function gitlabSpecs({ repo, api, labels }) {
  const found = (await api("GET", `projects/${encodeURIComponent(repo)}/issues?state=opened&labels=${encodeURIComponent(labels.spec)}&per_page=100`)) ?? [];
  return found.map((i) => `#${i.iid}`);
}

export function gitlabTracker({ repo, spec, api, labels, cwd = process.cwd() }) {
  const project = `projects/${encodeURIComponent(repo)}`;
  const specIid = spec ? iidOf(spec) : null;
  const issue = (iid) => `${project}/issues/${iid}`;
  const notes = (iid) => api("GET", `${issue(iid)}/notes?sort=asc&per_page=100`).then((n) => n ?? []);
  const status = (i) => (i.state === "closed" ? "closed" : roleOf(i.labels ?? [], labels));

  async function blockers(i) {
    const links = (await api("GET", `${issue(i.iid)}/links`)) ?? [];
    const native = links.filter((l) => l.link_type === "is_blocked_by").map((l) => String(l.iid));
    if (native.length) return native;
    const line = field(i.description, "Blocked by");
    return line && !/^none/i.test(line) ? [...line.matchAll(/#?(\d+)/g)].map((m) => m[1]) : [];
  }

  async function setRole(iid, role) {
    await api("PUT", issue(iid), {
      remove_labels: ALL_ROLES.filter((r) => r !== role).map((r) => labels[r]).join(","),
      ...(role ? { add_labels: labels[role] } : {}),
    });
  }

  async function standaloneIids() {
    const owned = new Set();
    for (const s of await gitlabSpecs({ repo, api, labels })) {
      owned.add(iidOf(s));
      for (const l of (await api("GET", `${issue(iidOf(s))}/links`)) ?? []) if (l.link_type === "relates_to") owned.add(l.iid);
    }
    const seen = new Set();
    for (const role of ["ready-for-agent", "ready-for-human"]) {
      for (const i of (await api("GET", `${project}/issues?state=opened&labels=${encodeURIComponent(labels[role])}&per_page=100`)) ?? []) {
        if (!owned.has(i.iid) && !(i.labels ?? []).includes(labels.spec)) seen.add(i.iid);
      }
    }
    return [...seen];
  }

  async function list() {
    const iids = specIid
      ? ((await api("GET", `${issue(specIid)}/links`)) ?? []).filter((l) => l.link_type === "relates_to").map((l) => l.iid)
      : await standaloneIids();
    const out = [];
    for (const iid of iids) {
      const i = await api("GET", issue(iid));
      out.push({
        id: String(i.iid),
        ref: `#${i.iid}`,
        title: i.title,
        status: status(i),
        blockedBy: await blockers(i),
        claimedBy: holder(await notes(i.iid))?.who ?? null,
        door: field(i.description, "Door")?.toLowerCase() ?? null,
        body: i.description ?? "",
      });
    }
    return out.sort((a, b) => Number(a.id) - Number(b.id));
  }

  const key = specIid ? `gl-${specIid}` : "gl";

  return {
    kind: "gitlab",
    key,
    trailDir: `.autopilot/${key}/trail`,
    stateDir: `.autopilot/${key}`,

    async spec() {
      if (!specIid) return { ref: null, status: "ready-for-agent", standalone: true };
      try {
        const i = await api("GET", issue(specIid));
        return { ref: `#${specIid}`, status: status(i), title: i.title };
      } catch {
        return null;
      }
    },

    tickets: list,

    async statusOf(id) {
      try {
        return status(await api("GET", issue(id)));
      } catch {
        return null;
      }
    },

    claim: (ticket, who) => claimWith({ comments: () => notes(ticket.id), post: (body) => api("POST", `${issue(ticket.id)}/notes`, { body }) }, who),

    async handToHuman(ticket, reason) {
      await setRole(ticket.id, "ready-for-human");
      const held = holder(await notes(ticket.id));
      await api("POST", `${issue(ticket.id)}/notes`, { body: releaseBody(held?.who ?? "autopilot", reason) });
    },

    async setStatus(ticket, role, note) {
      await setRole(ticket.id, role);
      if (note) await api("POST", `${issue(ticket.id)}/notes`, { body: note });
    },

    async comment(ticket, body) {
      const iid = ticket ? ticket.id : specIid;
      if (iid) await api("POST", `${issue(iid)}/notes`, { body });
    },

    async humanNote(ticket) {
      return latestHumanNote((await notes(ticket.id)).filter((n) => !n.system).map((n) => n.body ?? ""));
    },

    pointer: (ticket) => `gitlab ${repo}#${iidOf(ticket.ref)}`,
    prLink: (ticket) => `Closes ${repo}#${ticket.id}`,

    async afterMerge(ticket, { handoff, pr }) {
      await api("POST", `${issue(ticket.id)}/notes`, { body: `## Handoff\n\n${String(handoff ?? "").trim()}\n\nMerged in ${pr.url}` });
      const i = await api("GET", issue(ticket.id));
      if (i.state !== "closed") await api("PUT", issue(ticket.id), { state_event: "close" });
    },

    async closeSpec(summary) {
      if (!specIid) return;
      await api("POST", `${issue(specIid)}/notes`, { body: summary });
      await api("PUT", issue(specIid), { state_event: "close" });
    },

    async createTicket({ title, body }) {
      const i = await api("POST", `${project}/issues`, { title, description: body, labels: labels["ready-for-agent"] });
      return (await list()).find((t) => t.id === String(i.iid)) ?? { id: String(i.iid), ref: `#${i.iid}`, title, status: "ready-for-agent", blockedBy: [], claimedBy: null, body };
    },

    splitPrompt: {
      where: `Spec issue: gitlab ${repo}#${specIid}. Publish each ticket as an issue linked to it (relates_to), with is_blocked_by links or a \`Blocked by:\` line.`,
      rule: "Create issues only; change no file in the repository.",
    },

    async split({ runSplitter, statusFor, trailRows }) {
      const result = await runSplitter(cwd);
      if (!result.ok) return { stop: `splitting the spec failed: ${result.output?.error ?? result.output?.note ?? "no reason given"}` };
      const tickets = await list();
      if (!tickets.length) return { stop: "the split published no linked issues" };
      const role = statusFor(tickets);
      for (const t of tickets) await setRole(t.id, role);
      await api("POST", `${issue(specIid)}/notes`, { body: `Autopilot split this spec:\n\n\`\`\`tsv\n${trailRows(result)}\`\`\`` });
      return { tickets };
    },
  };
}

export function gitlabForge({ repo, api }) {
  const project = `projects/${encodeURIComponent(repo)}`;
  const mr = (iid) => `${project}/merge_requests/${iid}`;
  const DRAFT = /^(Draft:|\[Draft\]|\(Draft\))\s*/i;
  const pipeline = (status) => {
    if (!status) return "none";
    if (status === "success" || status === "skipped") return "pass";
    if (["failed", "canceled"].includes(status)) return "fail";
    return "pending";
  };
  return {
    repo,
    async openPr({ branch, base, title, body, draft = false }) {
      const m = await api("POST", `${project}/merge_requests`, { source_branch: branch, target_branch: base, title: draft ? `Draft: ${title}` : title, description: body });
      return { number: m.iid, url: m.web_url };
    },
    // The newest merge request for a branch, in any state.
    async findPr(branch) {
      const [m] = (await api("GET", `${project}/merge_requests?source_branch=${encodeURIComponent(branch)}&order_by=created_at&sort=desc`)) ?? [];
      if (!m) return null;
      const state = m.state === "merged" ? "merged" : m.state === "opened" ? "open" : "closed";
      return { number: m.iid, url: m.web_url, state, draft: Boolean(m.draft ?? DRAFT.test(m.title ?? "")), body: m.description ?? "", author: m.author?.username ?? null };
    },
    async comment(iid, body) {
      await api("POST", `${mr(iid)}/notes`, { body });
    },
    // GitLab notes carry no access level, so every note counts as trusted;
    // only the merge request's author writes run records.
    async comments(iid) {
      return ((await api("GET", `${mr(iid)}/notes?sort=asc&per_page=100`)) ?? []).filter((n) => !n.system).map((n) => ({ body: n.body ?? "", author: n.author?.username ?? null, trusted: true }));
    },
    async updatePr(iid, { body }) {
      await api("PUT", mr(iid), { description: body });
    },
    async markReady(iid) {
      const m = await api("GET", mr(iid));
      await api("PUT", mr(iid), { title: String(m.title ?? "").replace(DRAFT, "") });
    },
    async ciStatus(iid) {
      const state = pipeline((await api("GET", mr(iid)))?.head_pipeline?.status);
      return state === "none" ? "pass" : state;
    },
    async merge(iid) {
      await api("PUT", `${mr(iid)}/merge`, { squash: true });
    },
    async isMerged(iid) {
      return (await api("GET", mr(iid)))?.state === "merged";
    },
    async trunkStatus(branch) {
      const c = await api("GET", `${project}/repository/commits/${encodeURIComponent(branch)}`);
      return { sha: c?.id ?? null, state: pipeline(c?.last_pipeline?.status), url: c?.last_pipeline?.web_url ?? null };
    },
    async statusFor(sha) {
      const c = await api("GET", `${project}/repository/commits/${encodeURIComponent(sha)}`);
      return { state: pipeline(c?.last_pipeline?.status), url: c?.last_pipeline?.web_url ?? null };
    },
    async rerunFailed(sha) {
      const c = await api("GET", `${project}/repository/commits/${sha}`);
      if (!c?.last_pipeline?.id) return false;
      await api("POST", `${project}/pipelines/${c.last_pipeline.id}/retry`);
      return true;
    },
    async prForCommit(sha) {
      const [m] = (await api("GET", `${project}/repository/commits/${sha}/merge_requests`)) ?? [];
      return m ? { number: m.iid, branch: m.source_branch ?? "" } : null;
    },
  };
}
