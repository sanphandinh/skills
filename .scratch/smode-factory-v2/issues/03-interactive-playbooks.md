# 03: Các playbook làm việc tương tác

**What to build:** `smode` xử lý được các tình huống thường gặp khi làm việc tay. Có 9 playbook: `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `spec-run`, `triage`, `pickup`, `retro`.

- Mỗi playbook dài 10 đến 30 dòng.
- Mỗi bước gọi skill sẵn có theo tên. Một playbook có thể gọi playbook khác, ví dụ `feature` gọi `plan-ticket`, `verify`, `review`. Những playbook đó do ticket 04 viết: ở ticket này chúng được nhắc tên và ghi "chưa có".
- Bảng trigger trong `SKILL.md` được đầy đủ:
  - `grilling`, `domain-modeling`, `codebase-design`, `tdd`, `diagnosing-bugs`, `pr`, `writing-for-agents`, `research`, `wizard`;
  - `prototype`, cho câu hỏi kiểm được bằng thử nghiệm.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] Có đủ 9 playbook, mỗi file từ 10 đến 30 dòng, và mỗi file có phần trả lời riêng của nó
  Verify: `wc -l plugins/software/skills/smode/playbooks/*.md`
- [x] Mọi skill mà các playbook nhắc tới đều tồn tại
  Verify: `npm run validate`
- [x] Bảng trigger trong `SKILL.md` có đủ các dòng nêu trên
  Verify: đọc `SKILL.md`
- [x] Chạy `smode` với một bug nhỏ trong một repo thử thì đi theo `bug-fix`: tái hiện trước, gọi `diagnosing-bugs` và `tdd`, có todo list với các bước chép nguyên
  Verify: chạy `smode` trên một repo sandbox có một bug cố ý, đọc todo list và diff
- [x] Chạy `smode` với một ý tưởng tính năng thì đi theo `spec`, gọi `grill-with-docs` rồi tới `to-spec`. Đây là skill chỉ người dùng gọi, và nó được đọc từ file.
  Verify: chạy `smode` với một ý tưởng nhỏ trên repo sandbox, đọc todo list và các lần đọc file skill
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** 9 playbook `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `spec-run`, `triage`, `pickup`, `retro` (10–15 dòng mỗi file), mục lục trong `SKILL.md` trỏ link tới từng file; bảng trigger đủ dòng từ ticket 02. Validator sạch. Chạy thật bằng Claude Code (Sonnet) trên sandbox:
- `bug-fix` với bug cố ý `wordCount`: chạy `diagnosing-bugs` (claim, cả hai `Verify:` của người báo exit 1 trước khi sửa), nguyên nhân gốc tới đúng dòng, test đỏ rồi xanh qua `tdd`, todo list đủ bước. Model tự bỏ verify/review độc lập vì "một dòng" → sửa playbook: bước 7 không bao giờ bỏ.
- `spec` với ý tưởng "rút gọn tiêu đề dài": đọc `grill-with-docs`, `to-spec`, `to-tickets` từ bản checkout (hai skill sau là user-invoked), viết spec, 3 ticket có `Verify:` và cạnh chặn, `GLOSSARY.md`; mọi câu trả lời tự đưa ra đánh dấu "assumed".
**Interfaces introduced:** không.
**Deviations from spec:** ticket ghi "nhắc playbook chưa có thì ghi chưa có"; vì ticket 04 xong trước nên mọi playbook được nhắc đều đã có file.
**Decisions:** làm ticket 04 trước 03 để validator kiểm được mọi tham chiếu playbook ngay.
**Gotchas:** model đôi khi chỉ đọc phần đầu `SKILL.md` của skill được gọi (`cat … | head -80`). Chưa có cách ép đọc hết bằng lời; theo dõi trong nghiệm thu.
**For the next ticket:** 05: còn một dòng "Not written yet" (Setup), và một dòng Factory cho ticket 07.
**Links:** commit các playbook và commit sửa `bug-fix`
