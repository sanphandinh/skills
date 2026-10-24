// GitLab adapters over the REST v4 API. Tracker: a spec is an issue, its
// tickets are the issues linked to it (`relates_to`), blockers come from
// `is_blocked_by` links or a `Blocked by: #n` line, and status is a triage
// label or `closed`. Forge: merge requests on the configured project.
import { spawnSync } from "node:child_process";
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

export function gitlabTracker({ repo, spec, api, labels, cwd = process.cwd() }) {
  const project = `projects/${encodeURIComponent(repo)}`;
  const specIid = iidOf(spec);
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

  async function list() {
    const linked = ((await api("GET", `${issue(specIid)}/links`)) ?? []).filter((l) => l.link_type === "relates_to");
    const out = [];
    for (const l of linked) {
      const i = await api("GET", issue(l.iid));
      out.push({
        id: String(i.iid),
        ref: `#${i.iid}`,
        title: i.title,
        status: status(i),
        blockedBy: await blockers(i),
        claimedBy: holder(await notes(i.iid))?.who ?? null,
        door: field(i.description, "Door")?.toLowerCase() ?? null,
      });
    }
    return out.sort((a, b) => Number(a.id) - Number(b.id));
  }

  return {
    kind: "gitlab",
    key: `gl-${specIid}`,
    trailDir: `.autopilot/gl-${specIid}/trail`,

    async spec() {
      try {
        const i = await api("GET", issue(specIid));
        return { ref: `#${specIid}`, status: status(i), title: i.title };
      } catch {
        return null;
      }
    },

    tickets: list,

    claim: (ticket, who) => claimWith({ comments: () => notes(ticket.id), post: (body) => api("POST", `${issue(ticket.id)}/notes`, { body }) }, who),

    async handToHuman(ticket, reason) {
      await setRole(ticket.id, "ready-for-human");
      const held = holder(await notes(ticket.id));
      await api("POST", `${issue(ticket.id)}/notes`, { body: releaseBody(held?.who ?? "autopilot", reason) });
    },

    pointer: (ticket) => `gitlab ${repo}#${iidOf(ticket.ref)}`,
    prLink: (ticket) => `Closes ${repo}#${ticket.id}`,
    onBranch() {},

    async afterMerge(ticket, { handoff, pr }) {
      await api("POST", `${issue(ticket.id)}/notes`, { body: `## Handoff\n\n${handoff.trim()}\n\nMerged in ${pr.url}` });
      const i = await api("GET", issue(ticket.id));
      if (i.state !== "closed") await api("PUT", issue(ticket.id), { state_event: "close" });
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
  return {
    repo,
    async openPr({ branch, base, title, body }) {
      const m = await api("POST", `${project}/merge_requests`, { source_branch: branch, target_branch: base, title, description: body });
      return { number: m.iid, url: m.web_url };
    },
    async findPr(branch) {
      const [m] = (await api("GET", `${project}/merge_requests?state=opened&source_branch=${encodeURIComponent(branch)}`)) ?? [];
      return m ? { number: m.iid, url: m.web_url } : null;
    },
    async comment(iid, body) {
      await api("POST", `${mr(iid)}/notes`, { body });
    },
    async ciStatus(iid) {
      const status = (await api("GET", mr(iid)))?.head_pipeline?.status;
      if (!status) return "pass";
      if (status === "success" || status === "skipped") return "pass";
      if (["failed", "canceled"].includes(status)) return "fail";
      return "pending";
    },
    async merge(iid) {
      await api("PUT", `${mr(iid)}/merge`, { squash: true });
    },
    async isMerged(iid) {
      return (await api("GET", mr(iid)))?.state === "merged";
    },
  };
}
