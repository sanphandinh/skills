# 08: Acceptance

**What to build:** bằng chứng trên harness thật.

- **Claude Code** (`claude -p`): ba yêu cầu thường vào smode, chọn đúng playbook, không spawn worker.
- **OpenCode** (nâng lên ≥ 1.18.0, project nháp cài skill vào `.agents/skills`): cùng ba yêu cầu.
- **Cursor và Antigravity** qua T3: đọc smode theo đường dẫn và chọn đúng playbook.

**Blocked by:** 07

**Status:** ready-for-agent

**Door:** two-way

- [ ] Câu đầu của từng reply chép vào handoff
  Verify: đọc handoff
