# 05: Bốn harness doc native

**What to build:** `smode/harness/` có đúng `claude-code.md`, `opencode.md`, `antigravity.md`, `cursor.md`. Mỗi doc:

- mở đầu bằng **Verified**;
- có cách tìm skill;
- có bảng action: hỏi người dùng, todo list, lập lịch, theo dõi pull request, sub-agent cho skill cần nó (không có model).

`SKILL.md` liệt kê bốn doc. Validator đòi đủ bốn file.

**Blocked by:** 04

**Status:** ready-for-agent

**Door:** two-way

- [ ] Bốn doc tồn tại, mỗi doc có dòng **Verified**, mọi điều ghi trong doc đều đã đo
  Verify: đọc bốn file
- [ ] Validator báo lỗi khi thiếu một doc
  Verify: test mới
