import assert from "node:assert/strict";
import { test } from "node:test";
import { holder } from "./lib/trackers/claims.mjs";
import { githubTracker } from "./lib/trackers/github.mjs";
import { labelMap } from "./lib/trackers/labels.mjs";
import { runAutopilot } from "./lib/run.mjs";
import { PASS, SPEC_OK, STANDARDS_OK, fakeForge, fakeGitHub, fakeHarness, implementer, onTrunk, repoFixture } from "./test-helpers.mjs";

const V = "- [ ] It works\n  Verify: run it";
const LABELS = labelMap("| `ready-for-agent` | `agent:ready` | x |\n| `ready-for-human` | `human` | x |\n| `needs-triage` | `triage` | x |");

function github() {
  const gh = fakeGitHub();
  gh.add({ number: 1, title: "Spec", labels: ["agent:ready"], subIssues: [2, 3, 4] });
  gh.add({ number: 2, title: "Base", labels: ["agent:ready"], body: `**Door:** two-way\n\n${V}` });
  gh.add({ number: 3, title: "On top", labels: ["agent:ready"], blockedBy: [2], body: V });
  gh.add({ number: 4, title: "Fallback edge", labels: ["triage"], body: "Blocked by: #2, #3\n\n**Door:** one-way" });
  return { gh, tracker: githubTracker({ repo: gh.repo, spec: "#1", api: gh.api, labels: LABELS }) };
}

test("github: a spec's sub-issues are its tickets, with blockers, mapped status, and door", async () => {
  const { tracker } = github();
  assert.deepEqual(await tracker.spec(), { ref: "#1", status: "ready-for-agent", title: "Spec" });
  const tickets = await tracker.tickets();
  assert.deepEqual(
    tickets.map((t) => [t.id, t.status, t.blockedBy, t.door]),
    [
      ["2", "ready-for-agent", [], "two-way"],
      ["3", "ready-for-agent", ["2"], null],
      ["4", "needs-triage", ["2", "3"], "one-way"],
    ],
  );
  assert.equal(tracker.pointer(tickets[0]), "github acme/app#2");
  assert.equal(tracker.prLink(tickets[0]), "Closes acme/app#2");
});

test("github: the earliest unreleased claim holds the ticket, and handing to the human releases it", async () => {
  const { gh, tracker } = github();
  const [t2] = await tracker.tickets();
  assert.equal(await tracker.claim(t2, "autopilot@a"), "claimed");
  assert.equal(await tracker.claim(t2, "autopilot@b"), false, "a later claimant loses");
  assert.equal(await tracker.claim(t2, "autopilot@a"), "resumed");
  assert.equal((await tracker.tickets())[0].claimedBy, "autopilot@a");

  await tracker.handToHuman(t2, "CI is red");
  assert.equal(holder(gh.issues.get(2).comments), null, "released");
  assert.deepEqual(gh.issues.get(2).labels, ["human"]);
  assert.match(gh.issues.get(2).comments.at(-1).body, /CI is red/);
});

test("github: two claimants posting before either re-reads still yield one holder", async () => {
  const { gh, tracker } = github();
  const [t2] = await tracker.tickets();
  // b's claim lands between a's post and a's re-read.
  const api = gh.api;
  let raced = false;
  const racing = githubTracker({
    repo: gh.repo,
    spec: "#1",
    labels: LABELS,
    api: async (method, p, body) => {
      const r = await api(method, p, body);
      if (!raced && method === "POST" && p.endsWith("/2/comments")) {
        raced = true;
        await api("POST", p, { body: "<!-- autopilot:claim who=autopilot@b nonce=bbb -->" });
      }
      return r;
    },
  });
  assert.equal(await racing.claim(t2, "autopilot@a"), "claimed", "a posted first");
  assert.equal(await tracker.claim(t2, "autopilot@b"), false);
});

test("github: after a merge the handoff is posted on the ticket and the issue closes", async () => {
  const { gh, tracker } = github();
  const [t2] = await tracker.tickets();
  await tracker.afterMerge(t2, { handoff: "**Delivered:** base", pr: { url: "https://example.test/pr/9" } });
  assert.equal(gh.issues.get(2).state, "closed");
  assert.match(gh.issues.get(2).comments.at(-1).body, /## Handoff\n\n\*\*Delivered:\*\* base\n\nMerged in https:\/\/example\.test\/pr\/9/);
  assert.equal((await tracker.tickets()).find((t) => t.id === "2").status, "closed");
});

test("github: one run builds the spec's ready sub-issues in order, closes them, and links the pull requests", async () => {
  const { gh, tracker } = github();
  const fx = repoFixture({});
  const forge = fakeForge(fx);
  const harness = fakeHarness({ implementer: implementer(), verifier: PASS, "review-spec": SPEC_OK, "review-standards": STANDARDS_OK });
  const report = await runAutopilot({ repoDir: fx.clone, spec: "#1", tracker, harness, forge, stateDir: fx.stateDir, who: "autopilot@test" });
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["2", "merged"], ["3", "merged"], ["4", "needs-approval"]]);
  assert.equal(gh.issues.get(2).state, "closed");
  assert.equal(gh.issues.get(3).state, "closed");
  assert.match(forge.prs[0].body, /Closes acme\/app#2/);
  assert.match(harness.calls.find((c) => c.role === "implementer" && /#3$/m.test(c.prompt)).prompt, /^Blocker handoff: github acme\/app#2$/m);
  assert.match(onTrunk(fx, ".autopilot/gh-1/trail/2.tsv"), /\tautopilot\tmerge\t/);
  assert.match(gh.issues.get(2).comments.map((c) => c.body).join("\n"), /## Handoff/);
});

test("the tracker doc's Tracker line picks the adapter, and no line means local", async () => {
  const { trackerConfig } = await import("./lib/trackers/index.mjs");
  assert.deepEqual(trackerConfig("Issues live in .scratch/"), { kind: "local" });
  assert.deepEqual(trackerConfig("**Tracker:** github acme/app"), { kind: "github", repo: "acme/app" });
  assert.deepEqual(trackerConfig("Tracker: gitlab group/sub/project"), { kind: "gitlab", repo: "group/sub/project" });
  assert.deepEqual(trackerConfig("Tracker: jira https://acme.atlassian.net APP"), { kind: "jira", site: "https://acme.atlassian.net", project: "APP" });
});

// ---------- GitLab ----------

import { gitlabForge, gitlabTracker } from "./lib/trackers/gitlab.mjs";
import { fakeGitLab } from "./test-helpers.mjs";

function gitlab() {
  const gl = fakeGitLab("acme/sub/app");
  gl.add({ iid: 1, title: "Spec", labels: ["agent:ready"], links: [{ iid: 2, type: "relates_to" }, { iid: 3, type: "relates_to" }] });
  gl.add({ iid: 2, title: "Base", labels: ["agent:ready"], description: V });
  gl.add({ iid: 3, title: "On top", labels: ["agent:ready"], links: [{ iid: 2, type: "is_blocked_by" }], description: `**Door:** two-way\n\n${V}` });
  return { gl, tracker: gitlabTracker({ repo: gl.repo, spec: "#1", api: gl.api, labels: LABELS }) };
}

test("gitlab: issues linked to the spec are its tickets, with is_blocked_by edges, and claims use the shared lock", async () => {
  const { gl, tracker } = gitlab();
  const tickets = await tracker.tickets();
  assert.deepEqual(tickets.map((t) => [t.id, t.status, t.blockedBy, t.door]), [["2", "ready-for-agent", [], null], ["3", "ready-for-agent", ["2"], "two-way"]]);
  assert.equal(tracker.pointer(tickets[0]), "gitlab acme/sub/app#2");
  assert.equal(await tracker.claim(tickets[0], "autopilot@a"), "claimed");
  assert.equal(await tracker.claim(tickets[0], "autopilot@b"), false);
  await tracker.handToHuman(tickets[0], "needs a decision");
  assert.deepEqual(gl.issues.get(2).labels, ["human"]);
  await tracker.afterMerge(tickets[1], { handoff: "done", pr: { url: "https://gitlab.test/mr/1" } });
  assert.equal(gl.issues.get(3).state, "closed");
  assert.match(gl.issues.get(3).notes.at(-1).body, /## Handoff/);
});

test("gitlab forge: merge requests on the configured project, with pipeline status as CI", async () => {
  const gl = fakeGitLab("acme/sub/app");
  const forge = gitlabForge({ repo: gl.repo, api: gl.api });
  const pr = await forge.openPr({ branch: "autopilot/gl-1/2", base: "main", title: "2: Base", body: "Closes acme/sub/app#2" });
  assert.deepEqual(pr, { number: 1, url: "https://gitlab.test/acme/sub/app/-/merge_requests/1" });
  assert.deepEqual(await forge.findPr("autopilot/gl-1/2"), { ...pr, state: "open", draft: false, body: "Closes acme/sub/app#2", author: null });
  assert.equal(await forge.ciStatus(1), "pass", "no pipeline counts as passing");
  gl.mrs[0].head_pipeline = { status: "running" };
  assert.equal(await forge.ciStatus(1), "pending");
  gl.mrs[0].head_pipeline = { status: "failed" };
  assert.equal(await forge.ciStatus(1), "fail");
  await forge.comment(1, "Verdict: PASS");
  await forge.merge(1);
  assert.equal(await forge.isMerged(1), true);
  assert.deepEqual(gl.mrs[0].notes, ["Verdict: PASS"]);
});

test("gitlab: one run builds the linked issues in order and closes them", async () => {
  const { gl, tracker } = gitlab();
  const fx = repoFixture({});
  const report = await runAutopilot({
    repoDir: fx.clone,
    spec: "#1",
    tracker,
    harness: fakeHarness({ implementer: implementer(), verifier: PASS, "review-spec": SPEC_OK, "review-standards": STANDARDS_OK }),
    forge: fakeForge(fx),
    stateDir: fx.stateDir,
    who: "autopilot@test",
  });
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["2", "merged"], ["3", "merged"]]);
  assert.equal(gl.issues.get(2).state, "closed");
  assert.match(onTrunk(fx, ".autopilot/gl-1/trail/3.tsv"), /\tautopilot\tmerge\t/);
});

// ---------- Jira ----------

import { adfText, jiraApi, jiraSpecs, jiraStatuses, jiraTracker } from "./lib/trackers/jira.mjs";
import { fakeJira } from "./test-helpers.mjs";

function jira() {
  const j = fakeJira();
  j.add({ key: "APP-1", summary: "Spec epic", status: "To Do", epic: true });
  j.add({ key: "APP-2", summary: "Base", parent: "APP-1", description: V });
  j.add({ key: "APP-3", summary: "On top", parent: "APP-1", links: ["APP-2"], description: `**Door:** two-way\n\n${V}` });
  j.add({ key: "APP-4", summary: "Fallback", parent: "APP-1", status: "Backlog", description: "Blocked by: APP-2, APP-3" });
  return { j, tracker: jiraTracker({ project: "APP", spec: "APP-1", api: j.api, statuses: jiraStatuses("Jira statuses: ready-for-human=Blocked") }) };
}

test("jira: an epic's children are its tickets, blockers from Blocks links or the body, status from mapped workflow names", async () => {
  const { tracker } = jira();
  assert.deepEqual(await tracker.spec(), { ref: "APP-1", status: "ready-for-agent", title: "Spec epic" });
  assert.deepEqual(
    (await tracker.tickets()).map((t) => [t.id, t.status, t.blockedBy, t.door]),
    [
      ["APP-2", "ready-for-agent", [], null],
      ["APP-3", "ready-for-agent", ["APP-2"], "two-way"],
      ["APP-4", "needs-triage", ["APP-2", "APP-3"], null],
    ],
  );
});

test("jira: claims survive rich-text comments, handing to the human transitions to the mapped status, and merge closes with the handoff", async () => {
  const { j, tracker } = jira();
  const [t2] = await tracker.tickets();
  assert.equal(await tracker.claim(t2, "autopilot@a"), "claimed");
  assert.equal(await tracker.claim(t2, "autopilot@b"), false);
  assert.doesNotMatch(adfText(j.issues.get("APP-2").comments[0]), /<!--/, "markers are visible text, not HTML comments");
  await tracker.handToHuman(t2, "unclear criteria");
  assert.equal(j.issues.get("APP-2").status, "Blocked");
  assert.equal((await tracker.tickets())[0].claimedBy, null, "released");
  await tracker.afterMerge(t2, { handoff: "done", pr: { url: "https://example.test/pr/1" } });
  assert.equal(j.issues.get("APP-2").status, "Done");
  assert.equal((await tracker.tickets())[0].status, "closed");
  assert.equal(tracker.prLink(t2), "Jira: APP-2");
});

test("jira: the API token only ever goes into the Authorization header", async () => {
  const seen = [];
  const api = jiraApi({
    site: "https://acme.atlassian.net/",
    email: "me@acme.test",
    token: "s3cret-token",
    fetchImpl: async (url, init) => (seen.push({ url, init }), { ok: false, status: 401, text: async () => "" }),
  });
  await assert.rejects(api("GET", "issue/APP-1"), (err) => !String(err.message).includes("s3cret") && /401/.test(err.message));
  assert.equal(seen[0].url, "https://acme.atlassian.net/rest/api/3/issue/APP-1");
  assert.ok(!seen[0].url.includes("s3cret"));
  assert.equal(seen[0].init.headers.Authorization, `Basic ${Buffer.from("me@acme.test:s3cret-token").toString("base64")}`);
  assert.throws(() => jiraApi({ site: "https://x", email: "", token: "" }), /JIRA_EMAIL and JIRA_API_TOKEN/);
});

test("jira: one run builds the epic's ready issues and opens pull requests on the code host", async () => {
  const { j, tracker } = jira();
  const fx = repoFixture({});
  const forge = fakeForge(fx);
  const report = await runAutopilot({
    repoDir: fx.clone,
    spec: "APP-1",
    tracker,
    harness: fakeHarness({ implementer: implementer(), verifier: PASS, "review-spec": SPEC_OK, "review-standards": STANDARDS_OK }),
    forge,
    stateDir: fx.stateDir,
    who: "autopilot@test",
  });
  assert.deepEqual(report.tickets.map((t) => [t.id, t.outcome]), [["APP-2", "merged"], ["APP-3", "merged"], ["APP-4", "needs-approval"]]);
  assert.equal(j.issues.get("APP-3").status, "Done");
  assert.match(forge.prs[0].body, /Jira: APP-2/);
  assert.match(forge.prs[0].branch, /^autopilot\/jira-APP-1\/APP-2$/);
});

test("every seed tracker template names its tracker on a line autopilot reads", async () => {
  const fs = await import("node:fs");
  const { trackerConfig } = await import("./lib/trackers/index.mjs");
  const seed = (name) => fs.readFileSync(new URL(`../../setup-software-context/issue-tracker-${name}.md`, import.meta.url), "utf8");
  assert.equal(trackerConfig(seed("local")).kind, "local");
  assert.equal(trackerConfig(seed("github")).kind, "github");
  assert.equal(trackerConfig(seed("gitlab")).kind, "gitlab");
  assert.deepEqual(trackerConfig(seed("jira")), { kind: "jira", site: "https://<site>.atlassian.net", project: "<PROJECT-KEY>" });
  assert.deepEqual(jiraStatuses(seed("jira")), { "needs-triage": "Backlog", "ready-for-agent": "To Do", "ready-for-human": "Blocked", closed: "Done" });
});

// ---------- whole-tracker scope ----------

test("github: spec-labelled issues are specs, other open issues with a triage role are standalone tickets, and fix tickets can be filed", async () => {
  const { githubSpecs } = await import("./lib/trackers/github.mjs");
  const gh = fakeGitHub();
  const labels = labelMap("| `ready-for-agent` | `agent:ready` | x |\n| `ready-for-human` | `human` | x |\n| `spec` | `kind:spec` | x |");
  gh.add({ number: 1, title: "Spec", labels: ["kind:spec", "agent:ready"], subIssues: [2] });
  gh.add({ number: 2, title: "Owned", labels: ["agent:ready"], body: V });
  gh.add({ number: 3, title: "Loose bug", labels: ["agent:ready"], body: V });
  gh.add({ number: 4, title: "Waiting", labels: ["human"] });
  gh.add({ number: 5, title: "Untriaged", labels: [] });
  assert.deepEqual(await githubSpecs({ repo: gh.repo, api: gh.api, labels }), ["#1"]);
  const standalone = githubTracker({ repo: gh.repo, spec: null, api: gh.api, labels });
  assert.deepEqual(await standalone.spec(), { ref: null, status: "ready-for-agent", standalone: true });
  assert.equal(standalone.key, "gh");
  assert.deepEqual((await standalone.tickets()).map((t) => [t.id, t.status]), [["3", "ready-for-agent"], ["4", "ready-for-human"]]);
  const fix = await standalone.createTicket({ title: "Fix trunk", body: "<!-- autopilot:fix first-red=abc -->\nbody" });
  assert.equal(fix.status, "ready-for-agent");
  assert.deepEqual(gh.issues.get(Number(fix.id)).labels, ["agent:ready"]);

  const spec = githubTracker({ repo: gh.repo, spec: "#1", api: gh.api, labels });
  await spec.closeSpec("## Autopilot finished this spec");
  assert.equal(gh.issues.get(1).state, "closed");
  assert.match(gh.issues.get(1).comments.at(-1).body, /finished this spec/);
});

test("github: the human's note is their comment after autopilot's last one, and status changes come with a note", async () => {
  const { gh, tracker } = github();
  const [t2] = await tracker.tickets();
  await tracker.handToHuman(t2, "stuck");
  assert.equal(await tracker.humanNote(t2), null);
  await gh.api("POST", `repos/${gh.repo}/issues/2/comments`, { body: "Use cents." });
  assert.equal(await tracker.humanNote(t2), "Use cents.");
  await tracker.setStatus(t2, "needs-triage", "needs a Verify line");
  assert.deepEqual(gh.issues.get(2).labels, ["triage"]);
  assert.match(gh.issues.get(2).comments.at(-1).body, /Verify line/);
});

test("gitlab: spec-labelled issues are specs, unlinked issues with a triage role are standalone, and specs close with a note", async () => {
  const { gitlabSpecs } = await import("./lib/trackers/gitlab.mjs");
  const gl = fakeGitLab("acme/app");
  const labels = labelMap("| `ready-for-agent` | `agent:ready` | x |\n| `spec` | `spec` | x |");
  gl.add({ iid: 1, title: "Spec", labels: ["spec", "agent:ready"], links: [{ iid: 2, type: "relates_to" }] });
  gl.add({ iid: 2, title: "Owned", labels: ["agent:ready"], description: V });
  gl.add({ iid: 3, title: "Loose", labels: ["agent:ready"], description: V });
  assert.deepEqual(await gitlabSpecs({ repo: gl.repo, api: gl.api, labels }), ["#1"]);
  const standalone = gitlabTracker({ repo: gl.repo, spec: null, api: gl.api, labels });
  assert.deepEqual((await standalone.tickets()).map((t) => t.id), ["3"]);
  const fix = await standalone.createTicket({ title: "Fix trunk", body: "x" });
  assert.deepEqual(gl.issues.get(Number(fix.id)).labels, ["agent:ready"]);
  await gitlabTracker({ repo: gl.repo, spec: "#1", api: gl.api, labels }).closeSpec("done");
  assert.equal(gl.issues.get(1).state, "closed");
  assert.equal(gl.issues.get(1).notes.at(-1).body, "done");
});

test("gitlab forge: drafts, notes, trunk pipeline and its retry, and the merge request behind a commit", async () => {
  const gl = fakeGitLab("acme/app");
  const forge = gitlabForge({ repo: gl.repo, api: gl.api });
  const pr = await forge.openPr({ branch: "autopilot/gl/3", base: "main", title: "3: Loose", body: "b", draft: true });
  assert.equal((await forge.findPr("autopilot/gl/3")).draft, true);
  await forge.markReady(pr.number);
  assert.equal((await forge.findPr("autopilot/gl/3")).draft, false);
  await forge.comment(pr.number, "one");
  assert.deepEqual(await forge.comments(pr.number), [{ body: "one", author: null, trusted: true }]);
  assert.deepEqual(await forge.trunkStatus("main"), { sha: "main", state: "pass", url: null });
  gl.trunk.status = "failed";
  assert.equal((await forge.trunkStatus("main")).state, "fail");
  await forge.rerunFailed("abc");
  assert.deepEqual(gl.retried, [7]);
});

test("jira: open epics are specs, parentless issues are standalone, and fix tickets are filed as ready tasks", async () => {
  const { j } = jira();
  j.add({ key: "APP-9", summary: "Loose", description: V });
  assert.deepEqual(await jiraSpecs({ project: "APP", api: j.api }), ["APP-1"]);
  const standalone = jiraTracker({ project: "APP", spec: null, api: j.api });
  assert.equal(standalone.key, "jira-APP");
  assert.deepEqual((await standalone.tickets()).map((t) => t.id), ["APP-9"]);
  const fix = await standalone.createTicket({ title: "Fix trunk", body: "x" });
  assert.equal(j.issues.get(fix.id).status, "To Do");
  const spec = jiraTracker({ project: "APP", spec: "APP-1", api: j.api });
  await spec.closeSpec("done");
  assert.equal(j.issues.get("APP-1").status, "Done");
});

test("scanning a local tracker finds every spec folder and every standalone folder, plus the fixes folder", async () => {
  const { scanTrackers } = await import("./lib/trackers/index.mjs");
  const { SPEC: S, TICKET: TK } = await import("./test-helpers.mjs");
  const fx = repoFixture({ ".scratch/a/spec.md": S(), ".scratch/a/issues/01-x.md": TK("01", "X"), ".scratch/bugs/issues/01-y.md": TK("01", "Y"), ".scratch/notes.md": "x" });
  const { trackers, standalone } = await scanTrackers({ repoDir: fx.clone });
  assert.deepEqual(trackers.map((t) => t.key), ["a", "bugs", "autopilot-fixes"]);
  assert.equal(standalone.key, "autopilot-fixes");
  assert.deepEqual(await trackers[1].spec(), { ref: null, status: "ready-for-agent", standalone: true });
});
