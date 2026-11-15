# 08: `factory-v2/references/t3.md`

**What to build:** factory v2 chạy được trên T3. Reference ánh xạ 10 thao tác sang tool T3, mô tả watcher, và liệt kê bẫy. Setup trên T3 chạy được smoke test đầy đủ.

- **open-workspace và start-worker**: một `delegate_task` mới cho mỗi bước, trong worktree riêng, kèm `target` lấy từ route. Trước mỗi lần giao việc thì fetch và fast-forward trunk.
- **wait-events**: event đến dưới dạng turn mới, từ việc worker xong, worker hỏi, hoặc theo dõi PR.
- **send, inspect, stop-worker**: `t3_thread_send`, `task_status` và `t3_thread_read`, `task_cancel`.
- **flag-human**: đánh dấu unread, đổi tên thread, cộng brief trên tracker.
- **close-workspace**: push check, `git worktree remove`, archive thread.
- **resume**: coordinator là một thread cố định, id ghi trong memory index.
- **schedule-wakes**: thread watcher dùng `schedule_task`, chế độ fresh session, chạy role scout. Watcher chạy fingerprint, kiểm `t3_queue`, rồi gửi một lệnh `once`. Ít nhất mỗi giờ thức một lần.
- **Quota**: đọc câu lỗi trong child thread để phân loại và lấy giờ reset.
- **Bẫy**: nhánh tạm bị đổi tên (push bằng `HEAD:<branch>`); duyệt quyền không được chuyển cho coordinator (chạy full access); không dùng plan mode; Antigravity có thể ghi ra ngoài worktree; mỗi lần coordinator thức xong lại có thông báo "finished".

**Blocked by:** 06, 07

**Status:** ready-for-agent

**Door:** two-way

- [ ] Reference ánh xạ đủ 10 thao tác và mục Events, cộng các bẫy nêu trên
  Verify: đọc file, đối chiếu với `INTERFACE.md` của v2
- [ ] `factory-v2 setup` trên repo này, trong T3, chạy smoke test và mọi dòng đều `PASS`, kể cả bước kiểm từng provider cho Claude, Cursor và Antigravity
  Verify: chạy `factory-v2 setup` trong một thread T3 trên bản checkout chính, đọc bảng kết quả
- [ ] Lịch thức thật của watcher gửi `once` tới coordinator khi có thay đổi, và bỏ qua khi coordinator đã có một lần thức đang chờ
  Verify: trong smoke test, bước schedule-wakes: tạo một thay đổi trên GitHub, xem coordinator nhận đúng một `once`; tạo thêm một thay đổi khi nó đang bận, xem hàng đợi chỉ có một tin
- [ ] `providers.md` trong memory ghi lại từng provider hỏi được hay không, đọc ghi bằng tool hay bằng shell
  Verify: đọc `providers.md` sau smoke test
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
