// Tracker adapter for local markdown tickets under `.scratch/<feature>/`,
// committed with the repository. Trunk is the source of truth: a claim is a
// tracker-only commit pushed to trunk (a rejected push is the lock), and a
// ticket closes on its own branch so the close lands with the merge.
import fs from "node:fs";
import path from "node:path";
import { changedFiles, git, gitOk, listTree, show, worktree } from "../git.mjs";
import { appendComment, getField, parseTicket, removeField, setField, tickAll } from "../tracker.mjs";

export function localTracker({ repo, remote, trunk, spec }) {
  const trunkRef = `${remote}/${trunk}`;
  const specDir = path.posix.dirname(spec);
  const issuesDir = path.posix.join(specDir, "issues");
  const fetch = () => git(repo, ["fetch", "-q", remote]);

  // Commit a tracker-only edit straight to trunk. A rejected push means trunk
  // moved; with `retry` the edit is re-applied on the new trunk.
  function editTrunk(rel, edit, message, { retry = true } = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const wt = worktree(repo, trunkRef);
      try {
        const file = path.join(wt.dir, rel);
        const after = edit(fs.readFileSync(file, "utf8"));
        if (after === null) return false;
        if (after === "resume") return true;
        fs.writeFileSync(file, after);
        git(wt.dir, ["add", rel]);
        git(wt.dir, ["commit", "-qm", message]);
        if (gitOk(wt.dir, ["push", "-q", remote, `HEAD:${trunk}`])) return true;
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

  return {
    kind: "local",
    key: path.posix.basename(specDir),
    trailDir: path.posix.join(specDir, "trail"),

    async spec() {
      const text = show(repo, trunkRef, spec);
      return text === null ? null : { ref: spec, status: getField(text, "Status") };
    },

    async tickets() {
      return listTree(repo, trunkRef, issuesDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => {
          const rel = path.posix.join(issuesDir, f);
          return { ...parseTicket(rel, show(repo, trunkRef, rel)), ref: rel };
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
          return holder ? null : setField(setField(text, "Claimed-by", who), "Autopilot", "implementing");
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

    pointer: (ticket) => ticket.ref,
    prLink: () => "",

    // The handoff and the close travel on the ticket branch, so they land with
    // the code in one merge.
    onBranch(dir, ticket, { handoff }) {
      const file = path.join(dir, ticket.ref);
      let text = fs.readFileSync(file, "utf8");
      if (!/^## Handoff\s*$/m.test(text)) text = `${text.replace(/\n*$/, "\n")}\n## Handoff\n\n${handoff.trim()}\n`;
      if (getField(text, "Status") !== "closed") text = tickAll(removeField(setField(text, "Status", "closed"), "Autopilot"));
      fs.writeFileSync(file, text);
      git(dir, ["add", ticket.ref]);
      if (!gitOk(dir, ["diff", "--cached", "--quiet"])) git(dir, ["commit", "-qm", `autopilot: close ${ticket.id}`]);
    },

    async afterMerge() {},

    splitPrompt: { where: `Issues dir: ${issuesDir}`, rule: "Write one file per ticket into the issues dir, commit, and touch nothing outside it." },

    // Run the splitter in a trunk worktree, keep only ticket files, set each
    // ticket's status, and push the tickets to trunk. Returns the tickets, or
    // a reason to stop.
    async split({ runSplitter, statusFor, trailRows }) {
      const wt = worktree(repo, trunkRef);
      try {
        const result = await runSplitter(wt.dir);
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
        wt.cleanup();
      }
    },
  };
}
