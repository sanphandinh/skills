// Fakes for the harness and forge ports, and a repository fixture with a bare
// remote, so tests drive the orchestrator against real git.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function sh(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function tmp(prefix = "autopilot-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
}

export const SPEC = (status = "ready-for-agent") => `Status: ${status}\n\n# Demo spec\n\nBuild the demo.\n`;

export const TICKET = (id, title, { blockedBy = "None (can start immediately)", status = "ready-for-agent", extra = "" } = {}) =>
  `# ${id}: ${title}\n\n**What to build:** ${title}.\n\n**Blocked by:** ${blockedBy}\n\n**Status:** ${status}\n${extra}\n- [ ] It works\n`;

// A bare remote seeded with `files`, plus a clone the orchestrator runs in.
export function repoFixture(files, { verifyDoc = true } = {}) {
  const base = tmp();
  const remote = path.join(base, "remote.git");
  const seed = path.join(base, "seed");
  const clone = path.join(base, "clone");
  sh(base, "init", "-q", "--bare", "-b", "main", remote);
  fs.mkdirSync(seed);
  sh(seed, "init", "-q", "-b", "main");
  sh(seed, "config", "user.email", "seed@example.com");
  sh(seed, "config", "user.name", "seed");
  write(seed, { "README.md": "demo\n", ...(verifyDoc ? { "docs/agents/verify.md": "# Verify\n\nRun `node app.js`.\n" } : {}), ...files });
  sh(seed, "add", ".");
  sh(seed, "commit", "-qm", "seed");
  sh(seed, "remote", "add", "origin", remote);
  sh(seed, "push", "-q", "origin", "main");
  sh(base, "clone", "-q", remote, clone);
  for (const dir of [clone]) {
    sh(dir, "config", "user.email", "autopilot@example.com");
    sh(dir, "config", "user.name", "autopilot");
  }
  return { base, remote, clone, stateDir: path.join(base, "state") };
}

export function anotherClone(fx, name) {
  const dir = path.join(fx.base, name);
  sh(fx.base, "clone", "-q", fx.remote, dir);
  sh(dir, "config", "user.email", `${name}@example.com`);
  sh(dir, "config", "user.name", name);
  return dir;
}

// Read a file as it is on the remote trunk.
export function onTrunk(fx, rel) {
  return sh(fx.remote, "show", `main:${rel}`);
}

export function ticketPathFromPrompt(prompt) {
  return prompt.match(/^Ticket: (.+)$/m)?.[1];
}

// An implementer that adds a file named after the ticket, commits, and returns
// its handoff for the tracker to place.
export function implementer({ handoff = true, prBody = PR_BODY(), output = {}, change } = {}) {
  return ({ prompt, cwd }) => {
    const ticket = ticketPathFromPrompt(prompt);
    const id = path.basename(ticket).match(/\d+/)[0].padStart(2, "0");
    if (change) change({ cwd, id, prompt });
    else write(cwd, { [`src/${id}.js`]: `export const t${id} = true;\n` });
    sh(cwd, "add", "-A");
    sh(cwd, "commit", "-qm", `implement ${id}`, "--allow-empty");
    return {
      ok: true,
      prBody,
      ...(handoff ? { handoff: `**Delivered:** ticket ${id}\n**Interfaces introduced:** \`t${id}\`` } : {}),
      decisions: [{ decision: `built ${id}`, reason: "ticket asked for it" }],
      ...output,
    };
  };
}

export const PR_BODY = ({ door = "two-way", blast = "low" } = {}) =>
  `## Summary\n\nDemo.\n\n## Merge Danger\n\n**Door:** ${door}\n\n**Blast Radius:** ${blast}\n`;

export const PASS = () => ({ verdict: "PASS", evidence: "ran it" });
export const FAIL = (evidence = "it broke") => () => ({ verdict: "FAIL", evidence });
export const SPEC_OK = () => ({ verdict: "pass", findings: [] });
export const STANDARDS_OK = () => ({ verdict: "pass", findings: [] });

// Scripted harness: one handler per role, every call recorded.
export function fakeHarness(handlers) {
  const calls = [];
  return {
    calls,
    async run({ role, prompt, cwd }) {
      calls.push({ role, prompt, cwd });
      const handler = handlers[role];
      if (!handler) throw new Error(`fake harness has no handler for role ${role}`);
      const output = await handler({ prompt, cwd, call: calls.filter((c) => c.role === role).length });
      return { ok: output?.ok !== false, output, tokens: output?.tokens ?? 100 };
    },
  };
}

// Forge over the bare remote: pull requests are records, merges are real
// squash merges pushed to trunk.
export function fakeForge(fx, { ci = () => "pass" } = {}) {
  const prs = [];
  const forge = {
    prs,
    async openPr({ branch, base, title, body }) {
      const pr = { number: prs.length + 1, branch, base, title, body, comments: [], state: "open" };
      prs.push(pr);
      return { number: pr.number, url: `https://example.test/pr/${pr.number}` };
    },
    async findPr(branch) {
      const pr = prs.find((p) => p.branch === branch && p.state === "open");
      return pr ? { number: pr.number, url: `https://example.test/pr/${pr.number}` } : null;
    },
    async comment(number, body) {
      prs[number - 1].comments.push(body);
    },
    async ciStatus(number) {
      return ci(prs[number - 1]);
    },
    async merge(number) {
      const pr = prs[number - 1];
      const work = path.join(fx.base, `merge-${number}-${Date.now()}`);
      sh(fx.base, "clone", "-q", fx.remote, work);
      sh(work, "config", "user.email", "forge@example.com");
      sh(work, "config", "user.name", "forge");
      sh(work, "fetch", "-q", "origin", pr.branch);
      sh(work, "merge", "-q", "--squash", "FETCH_HEAD");
      sh(work, "commit", "-qm", `${pr.title} (#${number})`);
      sh(work, "push", "-q", "origin", "HEAD:main");
      fs.rmSync(work, { recursive: true, force: true });
      pr.state = "merged";
    },
    async isMerged(number) {
      return prs[number - 1].state === "merged";
    },
  };
  return forge;
}

// In-memory GitHub REST API for the issues endpoints the tracker uses.
export function fakeGitHub(repo = "acme/app") {
  const issues = new Map();
  let commentId = 0;
  const add = (i) => {
    issues.set(i.number, { state: "open", state_reason: null, labels: [], body: "", comments: [], subIssues: [], blockedBy: [], ...i });
    return issues.get(i.number);
  };
  const api = async (method, p, body) => {
    const m = p.replace(/\?.*$/, "").match(new RegExp(`^repos/${repo}/issues/(\\d+)(?:/(.+))?$`));
    if (!m) throw new Error(`fake GitHub: no route for ${method} ${p}`);
    const i = issues.get(Number(m[1]));
    if (!i) throw new Error(`fake GitHub: 404 issue ${m[1]}`);
    const rest = m[2] ?? "";
    const view = (x) => ({ number: x.number, title: x.title, body: x.body, state: x.state, state_reason: x.state_reason, labels: x.labels.map((name) => ({ name })) });
    if (!rest && method === "GET") return view(i);
    if (!rest && method === "PATCH") return Object.assign(i, body) && view(i);
    if (rest === "comments" && method === "GET") return i.comments.map((c) => ({ ...c }));
    if (rest === "comments" && method === "POST") return i.comments.push({ id: ++commentId, body: body.body }) && null;
    if (rest === "sub_issues" && method === "GET") return i.subIssues.map((n) => view(issues.get(n)));
    if (rest === "dependencies/blocked_by" && method === "GET") return i.blockedBy.map((n) => view(issues.get(n)));
    if (rest === "labels" && method === "POST") return (i.labels = [...new Set([...i.labels, ...body.labels])]) && null;
    if (rest.startsWith("labels/") && method === "DELETE") return (i.labels = i.labels.filter((l) => l !== decodeURIComponent(rest.slice(7)))) && null;
    throw new Error(`fake GitHub: no route for ${method} ${p}`);
  };
  return { api, issues, add, repo };
}

// In-memory GitLab REST v4 API for the issue, link, note, and merge request
// endpoints the adapters use.
export function fakeGitLab(repo = "acme/app") {
  const issues = new Map();
  const mrs = [];
  const enc = encodeURIComponent(repo);
  const add = (i) => {
    issues.set(i.iid, { state: "opened", labels: [], description: "", notes: [], links: [], ...i });
    return issues.get(i.iid);
  };
  const view = (i) => ({ iid: i.iid, title: i.title, description: i.description, state: i.state, labels: [...i.labels] });
  const api = async (method, p, body = {}) => {
    const [pathname, query = ""] = p.split("?");
    const q = new URLSearchParams(query);
    const base = `projects/${enc}/`;
    if (!pathname.startsWith(base)) throw new Error(`fake GitLab: wrong project in ${p}`);
    const rest = pathname.slice(base.length);
    let m;
    if ((m = rest.match(/^issues\/(\d+)$/))) {
      const i = issues.get(Number(m[1]));
      if (!i) throw new Error("fake GitLab: 404");
      if (method === "GET") return view(i);
      if (method === "PUT") {
        const remove = new Set(String(body.remove_labels ?? "").split(",").filter(Boolean));
        i.labels = i.labels.filter((l) => !remove.has(l));
        if (body.add_labels) i.labels = [...new Set([...i.labels, ...body.add_labels.split(",")])];
        if (body.state_event === "close") i.state = "closed";
        return view(i);
      }
    }
    if ((m = rest.match(/^issues\/(\d+)\/links$/))) return issues.get(Number(m[1])).links.map((l) => ({ ...view(issues.get(l.iid)), link_type: l.type }));
    if ((m = rest.match(/^issues\/(\d+)\/notes$/))) {
      const i = issues.get(Number(m[1]));
      if (method === "GET") return i.notes.map((n) => ({ ...n }));
      return i.notes.push({ body: body.body }) && null;
    }
    if (rest === "merge_requests" && method === "POST") {
      const mr = { iid: mrs.length + 1, web_url: `https://gitlab.test/${repo}/-/merge_requests/${mrs.length + 1}`, state: "opened", notes: [], ...body };
      mrs.push(mr);
      return mr;
    }
    if (rest === "merge_requests" && method === "GET") return mrs.filter((x) => x.state === q.get("state") && x.source_branch === q.get("source_branch"));
    if ((m = rest.match(/^merge_requests\/(\d+)(\/notes|\/merge)?$/))) {
      const mr = mrs[Number(m[1]) - 1];
      if (m[2] === "/notes") return mr.notes.push(body.body) && null;
      if (m[2] === "/merge") return (mr.state = "merged") && mr;
      return mr;
    }
    throw new Error(`fake GitLab: no route for ${method} ${p}`);
  };
  return { api, issues, mrs, add, repo };
}

// In-memory Jira Cloud REST v3 for the issue, search, comment, and transition
// endpoints the adapter uses. Workflow: any status can move to any other.
export function fakeJira(statusNames = ["Backlog", "To Do", "Blocked", "Done"]) {
  const issues = new Map();
  const add = (i) => {
    issues.set(i.key, { status: "To Do", parent: null, links: [], description: "", comments: [], ...i });
    return issues.get(i.key);
  };
  const doc = (text) => ({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const fields = (i) => ({
    summary: i.summary,
    status: { name: i.status, statusCategory: { key: i.status === "Done" ? "done" : "new" } },
    description: i.description ? doc(i.description) : null,
    issuelinks: i.links.map((k) => ({ type: { name: "Blocks" }, inwardIssue: { key: k } })),
  });
  const api = async (method, p, body) => {
    const [pathname, query = ""] = p.split("?");
    const q = new URLSearchParams(query);
    let m;
    if (pathname === "search/jql") {
      const parent = q.get("jql").match(/parent = (\S+)/)[1];
      return { issues: [...issues.values()].filter((i) => i.parent === parent).sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true })).map((i) => ({ key: i.key, fields: fields(i) })) };
    }
    if ((m = pathname.match(/^issue\/([A-Z]+-\d+)$/))) {
      const i = issues.get(m[1]);
      if (!i) throw new Error("Jira GET failed with 404");
      return { key: i.key, fields: fields(i) };
    }
    if ((m = pathname.match(/^issue\/([A-Z]+-\d+)\/comment$/))) {
      const i = issues.get(m[1]);
      if (method === "GET") return { comments: i.comments.map((body) => ({ body })) };
      i.comments.push(body.body);
      return {};
    }
    if ((m = pathname.match(/^issue\/([A-Z]+-\d+)\/transitions$/))) {
      const i = issues.get(m[1]);
      if (method === "GET") return { transitions: statusNames.map((name, n) => ({ id: String(n + 1), to: { name } })) };
      i.status = statusNames[Number(body.transition.id) - 1];
      return null;
    }
    throw new Error(`fake Jira: no route for ${method} ${p}`);
  };
  return { api, issues, add };
}
