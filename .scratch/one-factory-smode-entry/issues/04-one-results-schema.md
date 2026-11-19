# 04: Một nguồn cho schema kết quả và handoff

**What to build:** coordinator và worker đọc cùng một schema kết quả, và validator chặn mọi chỗ lệch:

- `smode/RESULTS.md` giữ object kết quả của `plan`, `build`, `verify`, `review`: phần chung (`step`, `ticket`, `route`, `ok`, `summary`, `questions`, `lessons`) và phần riêng mỗi bước, key snake_case, kèm giá trị cho phép (`door`, `verdict`, `severity`, `kind`, `status`).
- Phần Reply của `plan-ticket`, `ticket`, `verify`, `review` trỏ tới `RESULTS.md` thay vì tự liệt kê key.
- `WORK-ORDERS.md` của factory chỉ giữ phần riêng của factory (branch, push, không đụng GitHub, đường dẫn kết quả, `<route>`, bài học từ memory). Nó bỏ phần chép luật verdict của verify và ràng buộc review vì playbook đã có, và trỏ tới template handoff trong doc tracker thay vì chép lại.
- Validator: mọi key mà `PLAYBOOK.md` của factory đọc từ kết quả (viết dạng `` `<key>` `` cạnh chữ "result") có trong `RESULTS.md`.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] `RESULTS.md` có đủ bốn bước và phần chung, mọi key snake_case
  Verify: đọc file; `grep -n "[a-z][A-Z]" plugins/software/skills/smode/RESULTS.md` không ra key camelCase nào
- [x] Bốn playbook và `WORK-ORDERS.md` không còn tự liệt kê key kết quả mà trỏ tới `RESULTS.md`
  Verify: `grep -n "RESULTS.md" plugins/software/skills/smode/playbooks/*.md plugins/software/skills/factory/WORK-ORDERS.md`
- [x] `WORK-ORDERS.md` không còn template handoff và luật verdict chép lại
  Verify: `grep -n "Interfaces introduced\|PASS+NOTES\|unverified" plugins/software/skills/factory/WORK-ORDERS.md` trống
- [x] Validator báo lỗi khi `PLAYBOOK.md` đọc một key không có trong `RESULTS.md`
  Verify: test mới trong `cli/repo.test.mjs` (xanh và đỏ)
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `smode/RESULTS.md` định nghĩa phần chung và object `plan`, `build`, `verify`, `review`; bốn playbook trỏ tới đó; `WORK-ORDERS.md` chỉ giữ phần riêng của factory (thêm chỗ cho bài học từ memory, bỏ luật verdict, ràng buộc review và template handoff chép lại); `PLAYBOOK.md` đọc key theo dạng "the result's `<key>`"; validator báo lỗi với key không có trong `RESULTS.md`.
**Interfaces introduced:** `RESULTS.md`; luật validator về key kết quả.
**Deviations from spec:** không.
**Decisions:** worker review tự gom các ràng buộc bắt buộc theo playbook `review` bước 2, thay vì coordinator điền vào work order.
**Gotchas:** luật chỉ bắt dạng "result's `<key>`"; viết key theo dạng khác thì validator không thấy.
**For the next ticket:** 05: smode `SKILL.md` đã nhắc `RESULTS.md`.
