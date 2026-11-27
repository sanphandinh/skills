# 04: Setup, reference T3, tracker, triage, repo

**What to build:** `plan.md` mục 3, Ticket D (bước 9–14), cùng các điểm của mục **Spike đã đổi gì** trong `spec.md`:

- `SETUP.md`: template `factory.md` bỏ `Coordinator:`, thêm `Max tickets`, `Conflict rounds: 3`, `Reset keeps:`; chuyển đổi theo `plan.md` mục 1.12 và `setup override`; không tạo `factory:hold`; kiểm label triage role trên tracker và `ready-for-human` trên host của PR; phát hiện version 1 bằng `Agent:` không có `Manager:`; role `scout` và `coordinator`; smoke test viết lại quanh các thao tác mới.
- `references/t3.md`: Before the first wake (script setup `async: false`, cleanup worktree theo project, `full-access`, snooze), Operations, Events, Wakes (watcher lấy lock rồi launch dispatcher, `wake-check.sh` chỉ đọc, due), Revive test, Candidates (option effort theo model), Traps mới.
- `roles-template.md`, smode `playbooks/factory.md` và `smode/SKILL.md` (stop, pause, resume là mode).
- Template tracker `setup-software-context/issue-tracker-{github,gitlab,jira,local}.md`, `triage-labels.md` (template và `docs/agents/`), skill `triage`, `docs/agents/issue-tracker.md` của repo này.
- Repo: `docs/adr/0007-coordinator-per-ticket.md`, `AGENTS.md`, `PLATFORMS.md`, `README.md`, `GLOSSARY.md`, `docs/agents/factory.md` của repo này, bump `software` lên 0.13.0.

**Blocked by:** 03

**Status:** ready-for-agent

**Door:** two-way

- [ ] `grep -rn "factory:hold" plugins docs` chỉ còn phần chuyển đổi trong `SETUP.md`
  Verify: chạy lệnh
- [ ] `docs/agents/factory.md` của repo này không còn dòng `Coordinator:`; ba `plugin.json` của `software` ở 0.13.0
  Verify: `grep -n Coordinator docs/agents/factory.md`; `grep version plugins/software/.*-plugin/plugin.json`
- [ ] `factory setup` trên repo thử chạy smoke test mới, mọi dòng `PASS`
  Verify: bằng chứng trong `research/`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
