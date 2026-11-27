# 01: Spike và sửa lỗi nhỏ

**What to build:** `plan.md` mục 3, Ticket A: chạy chín thử nghiệm của mục 2 trên T3 thật và ghi kết quả vào `research/spike.md`, áp fallback ở thử nghiệm thất bại; sửa `thinking_level` → `thought_level` ở `references/t3.md:55` (dòng Migration giữ input cũ, thêm biến thể `thought_level`); bump `software` từ 0.12.1 lên 0.12.2 ở ba `plugin.json`; viết spec và ticket 02–04 sau khi có kết quả spike.

**Blocked by:** None

**Status:** ready-for-agent

**Door:** two-way

- [x] Chín thử nghiệm đều có mục riêng trong `research/spike.md` với bằng chứng (thread, thời điểm, output) và PASS/FAIL, kèm bảng tóm tắt
  Verify: đọc `research/spike.md`
- [x] `references/t3.md:55` ghi `thought_level`; dòng 63 có cả hai biến thể
  Verify: `grep -n "thought_level\|thinking_level" plugins/software/skills/factory/references/t3.md`
- [x] Ba `plugin.json` của `software` ở 0.12.2
  Verify: `grep version plugins/software/.*-plugin/plugin.json`
- [x] `spec.md` mục **Spike đã đổi gì** và ticket 02–04 mang kết quả spike
  Verify: đọc file
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
