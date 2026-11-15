# 06: Harness doc cho T3 và Codex

**What to build:** `smode` chạy được bên trong T3 và trên Codex, và trên T3 giao được việc cho provider khác theo route.

**`harness/t3.md`** ánh xạ:
- sinh worker thành `delegate_task`, kèm `target` lấy từ route và `isolation: "worktree"`;
- hỏi người thành `t3_pending_request`;
- lên lịch thành `schedule_task`;
- theo dõi PR thành `watch_pull_request`.

Nó cũng ghi:
- cách viết route trong cấu hình;
- quy tắc dùng đường dẫn tuyệt đối và đọc, ghi bằng shell khi tool file của provider từ chối đường dẫn ngoài workspace;
- provider nào không có tool hỏi trong child.

**`harness/codex.md`** ánh xạ các hành động sang tool của Codex. Đường dẫn plugin của Codex ghi là "cần kiểm" nếu máy chưa có Codex.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] `harness/t3.md` có đủ các hành động trong spec, cộng mục route, mục đường dẫn và shell, và mục provider không hỏi được
  Verify: đọc file, đối chiếu với mục "Harness doc" và "Harness T3" của spec
- [x] Trong một thread T3 chạy Claude, `smode` giao một bước `investigation` cho worker trên Cursor và một bước cho worker trên Antigravity theo route. Cả hai đọc được skill theo đường dẫn tuyệt đối.
  Verify: chạy `smode` trong T3 với route có Cursor và Antigravity, đọc kết quả của hai child thread
- [x] `harness/codex.md` có cùng các hành động, mỗi hành động ánh xạ sang tool của Codex hoặc ghi "skip"
  Verify: đọc file
- [x] Tên tool T3 không xuất hiện ngoài `harness/` và `references/`
  Verify: `npm run validate`
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `harness/t3.md` (bảng hành động sang tool T3, route, work order cho provider khác, worktree và nhánh, quota) và `harness/codex.md` (các dòng chưa kiểm được ghi **Unchecked**, vì Codex đang tắt trên máy). Chạy thật trong thread T3 này (Claude làm `smode`): ghi 5 dòng `route …` vào `~/.claude/rules/smode-roles.md` (sao lưu `smode-roles.md.bak-20261115232314`), rồi giao `investigation` theo route `scout` cho Antigravity (`gemini-3.8-flash`, ứng viên 2) và Cursor (`composer-2.5`, ứng viên 3). Cả hai đọc `SKILL.md` và playbook theo đường dẫn tuyệt đối, trả lời đúng (`npm run index`; câu lỗi `skills index is stale; run \`npm run index\``), có todo list, nhãn bằng chứng, `git status` sạch; Cursor còn dựng repo tạm để đo câu lỗi.
**Interfaces introduced:** dòng `route <role>: <providerInstanceId>/<model> <option>=<value>, …` trong file role của harness chạy coordinator.
**Deviations from spec:** không.
**Decisions:** route `reviewer` chỉ gồm họ Gemini và Grok, khác họ Claude của `worker`.
**Gotchas:** shell của Antigravity khởi động ở thư mục attachments của T3, ngoài worktree; đã thêm quy tắc "chạy mọi lệnh từ checkout" vào `harness/t3.md`, work order của v2 và reference.
**For the next ticket:** 08: route đã có sẵn trong file role; bước kiểm provider của setup đọc chúng.
**Links:** hai child thread `smode investigation (cursor)` và `smode investigation (antigravity)`
