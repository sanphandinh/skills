# 01: Kết quả của worker ghi route đã chạy

**What to build:** mỗi file kết quả trong `results/` của memory factory v2 ghi provider và model mà bước đó chạy trên, để người đọc kiểm được `verify` và `review` chạy trên họ model khác với bước build. Lần nghiệm thu 2026-11-16 chỉ ghi model trong `journal.md`; các file `results/*.json` không có.

- Work order của factory v2 có thêm trường `route` trong phần "Every result has", giá trị do coordinator điền sẵn từ ứng viên **Routing** đã chọn (`<providerInstanceId>/<model>`).
- `MEMORY.md` của factory v2 nói `results/` có trường đó và dùng để làm gì.

**Blocked by:** none

**Status:** ready-for-agent

**Door:** two-way

- [ ] Phần chung của work order yêu cầu `route` trong mọi kết quả, với giá trị coordinator điền
  Verify: `grep -n '`route`' plugins/factory/skills/factory-v2/WORK-ORDERS.md`
- [ ] Mục `results/` trong `MEMORY.md` của factory v2 nhắc trường `route`
  Verify: `grep -n 'route' plugins/factory/skills/factory-v2/MEMORY.md`
- [ ] Factory v1 (`plugins/factory/skills/factory/`) không đổi
  Verify: `git diff --stat origin/main -- plugins/factory/skills/factory/` rỗng
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments
