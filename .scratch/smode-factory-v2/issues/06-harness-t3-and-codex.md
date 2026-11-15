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

**Status:** ready-for-agent

**Door:** two-way

- [ ] `harness/t3.md` có đủ các hành động trong spec, cộng mục route, mục đường dẫn và shell, và mục provider không hỏi được
  Verify: đọc file, đối chiếu với mục "Harness doc" và "Harness T3" của spec
- [ ] Trong một thread T3 chạy Claude, `smode` giao một bước `investigation` cho worker trên Cursor và một bước cho worker trên Antigravity theo route. Cả hai đọc được skill theo đường dẫn tuyệt đối.
  Verify: chạy `smode` trong T3 với route có Cursor và Antigravity, đọc kết quả của hai child thread
- [ ] `harness/codex.md` có cùng các hành động, mỗi hành động ánh xạ sang tool của Codex hoặc ghi "skip"
  Verify: đọc file
- [ ] Tên tool T3 không xuất hiện ngoài `harness/` và `references/`
  Verify: `npm run validate`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
