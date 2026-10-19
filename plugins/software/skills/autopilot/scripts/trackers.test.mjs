import assert from "node:assert/strict";
import { test } from "node:test";
import { holder } from "./lib/trackers/claims.mjs";
import { githubTracker } from "./lib/trackers/github.mjs";
import { labelMap } from "./lib/trackers/labels.mjs";
import { runAutopilot } from "./lib/run.mjs";
import { PASS, SPEC_OK, STANDARDS_OK, fakeForge, fakeGitHub, fakeHarness, implementer, onTrunk, repoFixture } from "./test-helpers.mjs";

const LABELS = labelMap("| `ready-for-agent` | `agent:ready` | x |\n| `ready-for-human` | `human` | x |\n| `needs-triage` | `triage` | x |");

function github() {
  const gh = fakeGitHub();
  gh.add({ number: 1, title: "Spec", labels: ["agent:ready"], subIssues: [2, 3, 4] });
  gh.add({ number: 2, title: "Base", labels: ["agent:ready"], body: "**Door:** two-way" });
  gh.add({ number: 3, title: "On top", labels: ["agent:ready"], blockedBy: [2] });
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
  gl.add({ iid: 2, title: "Base", labels: ["agent:ready"] });
  gl.add({ iid: 3, title: "On top", labels: ["agent:ready"], links: [{ iid: 2, type: "is_blocked_by" }], description: "**Door:** two-way" });
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
  assert.deepEqual(await forge.findPr("autopilot/gl-1/2"), pr);
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
