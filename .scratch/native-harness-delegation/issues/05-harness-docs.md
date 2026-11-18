# 05: Bốn harness doc native

**What to build:** `smode/harness/` có đúng `claude-code.md`, `opencode.md`, `antigravity.md`, `cursor.md`. Mỗi doc:

- mở đầu bằng **Verified**;
- có cách tìm skill;
- có bảng action: hỏi người dùng, todo list, lập lịch, theo dõi pull request, sub-agent cho skill cần nó (không có model).

`SKILL.md` liệt kê bốn doc. Validator đòi đủ bốn file.

**Blocked by:** 04

**Status:** closed

**Door:** two-way

- [x] Bốn doc tồn tại, mỗi doc có dòng **Verified**, mọi điều ghi trong doc đều đã đo
  Verify: đọc bốn file
- [x] Validator báo lỗi khi thiếu một doc
  Verify: test mới

## Handoff

**Delivered:** `smode/harness/` có `claude-code.md` (bỏ **Candidates**, **Models on offer**, chọn model; còn sub-agent không truyền model và **Migration** cho `~/.claude/rules/smode-roles.md`), `opencode.md`, `antigravity.md`, `cursor.md`. Mỗi doc có dòng **Verified**. `SKILL.md` liệt kê bốn doc. Validator đòi `harness/` có đúng bốn doc này.
**Deviations from spec:** spec nói chỉ ghi điều đã đo. Các dòng tìm skill của OpenCode, Antigravity, Cursor và tool hỏi người dùng của Cursor lấy từ docs chính hãng, ghi rõ **docs**, vì không có chúng thì harness không tìm được skill. Ticket 08 sẽ chạy thử những gì chạy được.
**For the next ticket:** 06.
