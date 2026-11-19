# 08: Acceptance

**What to build:** bằng chứng trên harness thật.

- **Claude Code** (`claude -p`): ba yêu cầu thường vào smode, chọn đúng playbook, không spawn worker.
- **OpenCode** (nâng lên ≥ 1.18.0, project nháp cài skill vào `.agents/skills`): cùng ba yêu cầu.
- **Cursor và Antigravity** qua T3: đọc smode theo đường dẫn và chọn đúng playbook.

**Blocked by:** 07

**Status:** closed

**Door:** two-way

- [x] Câu đầu của từng reply chép vào handoff
  Verify: đọc handoff

## Handoff

**Delivered:** acceptance ngày 2026-11-18, cả bốn harness đều không spawn worker nào từ smode.

- **Claude Code** (`claude -p --model sonnet --plugin-dir`, ba phiên mới):
  - `Playbook: quick (câu hỏi về code, vài lần đọc file là đủ)`
  - `Playbook: investigation (a question that needs a few reads, no change).` cho "tìm nguyên nhân, đừng sửa file" (luật phân xử 3)
  - `Playbook: review (tên PR #21 trong yêu cầu)`
  - Không có lời gọi `Agent` nào; phiên review chạy hai trục của `code-review` ngay trong phiên.
- **Cursor** qua T3 (grok-4.7): `Playbook: investigation (câu hỏi cần hơn vài lượt đọc, và yêu cầu không thay đổi gì)`; đọc `harness/cursor.md`; không sub-agent; tìm đúng nguyên nhân (gộp `factory` và `factory-v2` ở `785651e`).
- **Antigravity** qua T3 (gemini-4-hydrogen): `Playbook: investigation (câu hỏi chỉ đọc về số lượng skill trong npm run validate, không sửa file)`; đọc `harness/antigravity.md`; không sub-agent; cùng nguyên nhân.
- **OpenCode:** chưa chạy được phiên. `brew upgrade` bị chặn vì tap `anomalyco/tap` chưa được tin cậy (không tự trust). Bản 1.19.6 chạy qua `npx opencode-ai`: `opencode debug skill` liệt kê `smode`, `tdd`, `code-review` từ `.agents/skills/` của project nháp; `task` vẫn không có `model`. Phiên bị dừng vì free tier hết lượt và khoá `opencode-go` đã hết hạn.

**Deviations from spec:** OpenCode chưa chạy phiên; Cursor và Antigravity chạy qua T3, đọc skill theo đường dẫn, chưa cài plugin.
**Gotchas:** cần khoá API OpenCode mới để chạy phiên; cài plugin Cursor và Antigravity bằng tay vẫn chưa thử.

## Chạy lại ngày 2026-11-19

- **OpenCode** 1.19.6 (`opencode run`, `opencode/deepseek-v4.1-flash-free`, skill trong `.agents/skills/`):
  - "Why does add(2, 3) … Explain only": phiên gọi `skill` `smode`, trả `Playbook: quick (a question one file read settles; no change requested)`, không gọi `task`.
  - "smode bug-fix …": `Playbook: bug-fix (named in the arguments)`. Phiên đọc `harness/opencode.md`, chạy `diagnosing-bugs` và `tdd` (test đỏ rồi xanh), sau đó `verify` và `review`. `code-review` mở hai `task` `explore` và không truyền model.
  - Lần chạy đầu không có `--auto` thì treo không ra event nào: `opencode run` chờ quyền sửa file.
- **Antigravity** `agy` 1.5.11:
  - `agy plugin validate --strict` qua cho `core` và `software`; ghi chú duy nhất là chưa có logo.
  - Phiên `agy -p` trên `.agents/skills/`: smode tự vào, đọc `harness/antigravity.md`, trả `Playbook: quick (…)`.
  - `agy plugin install` cả hai plugin (vào `~/.gemini/config/plugins/`), rồi chạy phiên `bug-fix` trên một project không có `.agents/skills`: smode tự vào từ plugin và tìm thấy các skill khác. `code-review` mở hai `invoke_subagent` `research` với `Model` mặc định `inherit`. Gỡ plugin sau khi đo.
  - Phát hiện: `agy` CLI nhận field của `invoke_subagent` ở top level, không bọc trong `Subagents`, và có `ask_question` và `schedule`. Đã sửa `harness/antigravity.md`.
- Cursor: chưa thử cài plugin bằng tay.
