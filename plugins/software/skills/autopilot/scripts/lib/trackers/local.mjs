// Tracker adapter for local markdown tickets under `.scratch/<feature>/`,
// committed with the repository. Trunk is the source of truth: a claim is a
// tracker-only commit pushed to trunk (a rejected push is the lock), and a
// ticket closes on trunk right after its pull request merges. A feature
// folder with a `spec.md` is a spec; one without is a group of standalone
// tickets (fix tickets live in `.scratch/autopilot-fixes/`).
import fs from "node:fs";
import path from "node:path";
import { changedFiles, git, gitOk, listTree, show, worktree } from "../git.mjs";
import { appendComment, getField, latestHumanNote, parseTicket, removeField, setField, tickAll } from "../tracker.mjs";

export const FIXES_DIR = ".scratch/autopilot-fixes";

// Every spec and standalone group on trunk: [{ spec, dir }].
export function localGroups({ repo, remote, trunk }) {
  const trunkRef = `${remote}/${trunk}`;
  return listTree(repo, trunkRef, ".scratch")
    .map((name) => path.posix.join(".scratch", name))
    .filter((dir) => listTree(repo, trunkRef, dir).length)
    .map((dir) => {
      const files = listTree(repo, trunkRef, dir);
      if (files.includes("spec.md")) return { spec: path.posix.join(dir, "spec.md"), dir };
      return files.includes("issues") ? { spec: null, dir } : null;
    })
    .filter(Boolean);
}

export function localTracker({ repo, remote, trunk, spec, dir }) {
  const trunkRef = `${remote}/${trunk}`;
  const specDir = spec ? path.posix.dirname(spec) : dir;
  const issuesDir = path.posix.join(specDir, "issues");
  const fetch = () => git(repo, ["fetch", "-q", remote]);

  // Commit a tracker-only edit straight to trunk. A rejected push means trunk
  // moved; with `retry` the edit is re-applied on the new trunk.
  function editTrunk(rel, edit, message, { retry = true } = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const wt = worktree(repo, trunkRef);
      try {
        const file = path.join(wt.dir, rel);
        const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
        const after = edit(before);
        if (after === null) return false;
        if (after === "resume") return true;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, after);
        git(wt.dir, ["add", rel]);
        git(wt.dir, ["commit", "-qm", message]);
        if (gitOk(wt.dir, ["push", "-q", remote, `HEAD:${trunk}`])) {
          fetch();
          return true;
        }
      } finally {
        wt.cleanup();
      }
      fetch();
      if (!retry) return false;
    }
    return false;
  }

  const readAt = (dir) =>
    fs
      .readdirSync(path.join(dir, issuesDir))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => parseTicket(path.posix.join(issuesDir, f), fs.readFileSync(path.join(dir, issuesDir, f), "utf8")));

  const comments = (text) => {
    const m = String(text ?? "").match(/^## Comments\s*\n([\s\S]*)$/m);
    return m ? m[1].split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean) : [];
  };

  return {
    kind: "local",
    key: path.posix.basename(specDir),
    trailDir: path.posix.join(specDir, "trail"),
    stateDir: specDir,

    async spec() {
      if (!spec) return { ref: null, status: "ready-for-agent", standalone: true };
      const text = show(repo, trunkRef, spec);
      return text === null ? null : { ref: spec, status: getField(text, "Status"), title: text.match(/^# (.+)$/m)?.[1] };
    },

    async tickets() {
      return listTree(repo, trunkRef, issuesDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => {
          const rel = path.posix.join(issuesDir, f);
          const text = show(repo, trunkRef, rel);
          return { ...parseTicket(rel, text), ref: rel, body: text };
        });
    },

    // "claimed", "resumed" (held under this name already), or false.
    async claim(ticket, who) {
      let resumed = false;
      const ok = editTrunk(
        ticket.ref,
        (text) => {
          const holder = getField(text, "Claimed-by");
          if (holder === who) return (resumed = true), "resume";
          return holder ? null : setField(text, "Claimed-by", who);
        },
        `autopilot: claim ${ticket.id}`,
        { retry: false },
      );
      return ok && (resumed ? "resumed" : "claimed");
    },

    async handToHuman(ticket, reason) {
      editTrunk(
        ticket.ref,
        (text) => appendComment(removeField(setField(text, "Status", "ready-for-human"), "Autopilot"), `Autopilot handed this to a human: ${reason}`),
        `autopilot: ${ticket.id} needs a human`,
      );
    },

    async setStatus(ticket, role, note) {
      editTrunk(ticket.ref, (text) => (note ? appendComment(setField(text, "Status", role), note) : setField(text, "Status", role)), `autopilot: ${ticket.id} is ${role}`);
    },

    // A comment on a ticket, or on the spec when `ticket` is null.
    async comment(ticket, body) {
      const rel = ticket?.ref ?? spec;
      if (rel) editTrunk(rel, (text) => appendComment(text, body), `autopilot: comment on ${ticket?.id ?? "the spec"}`);
    },

    async humanNote(ticket) {
      return latestHumanNote(comments(show(repo, trunkRef, ticket.ref)));
    },

    pointer: (ticket) => ticket.ref,
    prLink: () => "",

    // The handoff lands on the ticket and the ticket closes, on trunk, once
    // its code is there.
    async afterMerge(ticket, { handoff }) {
      editTrunk(
        ticket.ref,
        (text) => {
          let out = text;
          if (handoff && !/^## Handoff\s*$/m.test(out)) {
            const at = out.search(/^## Comments\s*$/m);
            const section = `## Handoff\n\n${handoff.trim()}\n`;
            out = at === -1 ? `${out.replace(/\n*$/, "\n")}\n${section}` : `${out.slice(0, at)}${section}\n${out.slice(at)}`;
          }
          return tickAll(removeField(setField(out, "Status", "closed"), "Autopilot"));
        },
        `autopilot: close ${ticket.id}`,
      );
    },

    async closeSpec(summary) {
      if (spec) editTrunk(spec, (text) => appendComment(setField(text, "Status", "closed"), summary), `autopilot: close ${path.posix.basename(specDir)}`);
    },

    // A new standalone ticket, numbered after the last one in this group.
    async createTicket({ title, body }) {
      const files = listTree(repo, trunkRef, issuesDir).filter((f) => /^\d+/.test(f));
      const next = String(files.reduce((n, f) => Math.max(n, Number(f.match(/^\d+/)[0])), 0) + 1).padStart(2, "0");
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const rel = path.posix.join(issuesDir, `${next}-${slug}.md`);
      editTrunk(rel, () => `# ${next}: ${title}\n\n**Status:** ready-for-agent\n\n**Blocked by:** None\n\n${body.trim()}\n`, `autopilot: file ${title}`);
      return (await this.tickets()).find((t) => t.ref === rel);
    },

    splitPrompt: { where: `Issues dir: ${issuesDir}`, rule: "Write one file per ticket into the issues dir, commit, and touch nothing outside it." },

    // Run the splitter in a trunk worktree, keep only ticket files, set each
    // ticket's status, and push the tickets to trunk. Returns the tickets, or
    // a reason to stop.
    async split({ runSplitter, statusFor, trailRows, open }) {
      const wt = open ? await open({ ref: trunkRef }) : worktree(repo, trunkRef);
      try {
        const result = await runSplitter(wt.dir, wt);
        if (!result.ok) return { stop: `splitting the spec failed: ${result.output?.error ?? result.output?.note ?? "no reason given"}` };
        const outside = changedFiles(wt.dir, trunkRef, "HEAD").filter((f) => !f.startsWith(`${issuesDir}/`));
        if (outside.length) return { stop: `the split touched files outside ${issuesDir}: ${outside.join(", ")}` };
        if (!fs.existsSync(path.join(wt.dir, issuesDir))) return { stop: "the split wrote no tickets" };
        const tickets = readAt(wt.dir).map((t) => ({ ...t, ref: t.rel }));
        if (!tickets.length) return { stop: "the split wrote no tickets" };
        const status = statusFor(tickets);
        for (const t of tickets) fs.writeFileSync(path.join(wt.dir, t.ref), setField(t.text, "Status", status));
        const trail = path.posix.join(specDir, "trail", "split.tsv");
        fs.mkdirSync(path.join(wt.dir, path.posix.dirname(trail)), { recursive: true });
        fs.writeFileSync(path.join(wt.dir, trail), trailRows(result));
        git(wt.dir, ["add", "-A", issuesDir, trail]);
        git(wt.dir, ["commit", "-qm", `autopilot: split ${path.posix.basename(specDir)} into ${tickets.length} tickets`, "--allow-empty"]);
        for (let attempt = 0; !gitOk(wt.dir, ["push", "-q", remote, `HEAD:${trunk}`]); attempt++) {
          if (attempt >= 4) return { stop: "could not push the tickets to trunk" };
          fetch();
          git(wt.dir, ["rebase", "-q", trunkRef]);
        }
        fetch();
        return { tickets };
      } finally {
        await wt.cleanup();
      }
    },
  };
}
