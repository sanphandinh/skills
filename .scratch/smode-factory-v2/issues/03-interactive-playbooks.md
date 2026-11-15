# 03: Các playbook làm việc tương tác

**What to build:** `smode` xử lý được các tình huống thường gặp khi làm việc tay. Có 9 playbook: `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `spec-run`, `triage`, `pickup`, `retro`.

- Mỗi playbook dài 10 đến 30 dòng.
- Mỗi bước gọi skill sẵn có theo tên. Một playbook có thể gọi playbook khác, ví dụ `feature` gọi `plan-ticket`, `verify`, `review`. Những playbook đó do ticket 04 viết: ở ticket này chúng được nhắc tên và ghi "chưa có".
- Bảng trigger trong `SKILL.md` được đầy đủ:
  - `grilling`, `domain-modeling`, `codebase-design`, `tdd`, `diagnosing-bugs`, `pr`, `writing-for-agents`, `research`, `wizard`;
  - `prototype`, cho câu hỏi kiểm được bằng thử nghiệm.

**Blocked by:** 02

**Status:** ready-for-agent

**Door:** two-way

- [ ] Có đủ 9 playbook, mỗi file từ 10 đến 30 dòng, và mỗi file có phần trả lời riêng của nó
  Verify: `wc -l plugins/software/skills/smode/playbooks/*.md`
- [ ] Mọi skill mà các playbook nhắc tới đều tồn tại
  Verify: `npm run validate`
- [ ] Bảng trigger trong `SKILL.md` có đủ các dòng nêu trên
  Verify: đọc `SKILL.md`
- [ ] Chạy `smode` với một bug nhỏ trong một repo thử thì đi theo `bug-fix`: tái hiện trước, gọi `diagnosing-bugs` và `tdd`, có todo list với các bước chép nguyên
  Verify: chạy `smode` trên một repo sandbox có một bug cố ý, đọc todo list và diff
- [ ] Chạy `smode` với một ý tưởng tính năng thì đi theo `spec`, gọi `grill-with-docs` rồi tới `to-spec`. Đây là skill chỉ người dùng gọi, và nó được đọc từ file.
  Verify: chạy `smode` với một ý tưởng nhỏ trên repo sandbox, đọc todo list và các lần đọc file skill
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
