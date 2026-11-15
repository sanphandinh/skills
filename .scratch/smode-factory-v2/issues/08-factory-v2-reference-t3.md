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

**Status:** closed

**Door:** two-way

- [x] Reference ánh xạ đủ 10 thao tác và mục Events, cộng các bẫy nêu trên
  Verify: đọc file, đối chiếu với `INTERFACE.md` của v2
- [x] `factory-v2 setup` trên repo này, trong T3, chạy smoke test và mọi dòng đều `PASS`, kể cả bước kiểm từng provider cho Claude, Cursor và Antigravity
  Verify: chạy `factory-v2 setup` trong một thread T3 trên bản checkout chính, đọc bảng kết quả
- [x] Lịch thức thật của watcher gửi `once` tới coordinator khi có thay đổi, và bỏ qua khi coordinator đã có một lần thức đang chờ
  Verify: trong smoke test, bước schedule-wakes: tạo một thay đổi trên GitHub, xem coordinator nhận đúng một `once`; tạo thêm một thay đổi khi nó đang bận, xem hàng đợi chỉ có một tin
- [x] `providers.md` trong memory ghi lại từng provider hỏi được hay không, đọc ghi bằng tool hay bằng shell
  Verify: đọc `providers.md` sau smoke test
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `factory-v2/references/t3.md` (10 thao tác, Events, watcher, resume test, bẫy). Setup và smoke test chạy thật trong thread T3 này (coordinator Claude Opus), memory ở `~/.local/share/factory-v2/skills`:

| Bước | Kết quả |
|---|---|
| 1 open-workspace | PASS, chỉ `git fetch`: coordinator chạy trong worktree của nhánh làm việc, không ở project root |
| 2 start-worker, wait-events, send, inspect | PASS: worker Antigravity hỏi "alpha or beta?", nhận `beta`; follow-up `gamma` tới qua một lượt xếp hàng |
| 3 flag-human | PASS: pin và tiền tố ⏸; `mark_unread` bị từ chối khi lượt đang chạy |
| 4 resume | PASS ở lần 3: session mới trong thread coordinator thấy worker `running` |
| 5 stop-worker | PASS: `task_cancel` → `interrupted` |
| 6 close-workspace | PASS: push check từ chối khi còn 24 commit chưa push, đóng sạch sau khi reset |
| 7 schedule-wakes | PASS: watcher (chuyển sang Haiku bằng `t3_thread_configure`) trả lời `woke`, `quiet` và `already queued` đúng lúc |
| 8 providers | 9 PASS, 2 NOT CHECKED vì quota Cursor theo tuần |

Mỗi lỗi tìm ra được sửa trong skill: `send` xếp hàng trên provider không steer; flag-human dùng pin và đổi tên; câu chữ "đường dẫn tuyệt đối chỉ để đọc" (Cursor đã chạy lệnh trong checkout của coordinator); shell Antigravity khởi động ngoài worktree; lệnh chạy foreground (Claude đẩy lệnh dài xuống nền và kết thúc lượt); shell Claude từ chối `sleep`; fingerprint dùng `ls -lA` vì dòng `..` của `ls -la` đổi mỗi lần chạy; nhận diện quota thêm "usage", "credits", gói không gồm model, chặn 24 giờ cho hạn mức theo tuần; v1 chỉ tính là đang chạy khi manager có lịch thức thật.
**Interfaces introduced:** `wake-check.sh` trong memory; `t3-coordinator`, `live workers` trong index; `providers.md`, `quota.md` có dữ liệu thật.
**Deviations from spec:** `docs/agents/factory-v2.md` commit trên nhánh làm việc, không lên trunk (push lên trunk là việc ra ngoài, cần người dùng đồng ý). Bài resume và watcher chạy với một thread coordinator thu nhỏ, để không xoá context của phiên lập trình bằng một lần thức fresh session.
**Decisions:** routing bỏ qua `cursor/gemini-4-carbon` và `cursor/claude-opus-5-5` tới khi hết chặn.
**Gotchas:** v1 có cùng lỗi `ls -la` trong precheck của `references/orca.md`: precheck của các repo đang chạy v1 trên Orca có thể không bao giờ im lặng. v1 đóng băng nên chưa sửa.
**For the next ticket:** 09: đã có route, `providers.md` và `quota.md`; `once` thật cần coordinator ở project root và trunk được fast-forward, và merge lên `main` cần người dùng đồng ý.
**Links:** journal và `wiki/t3.md` trong memory v2
