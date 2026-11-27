# 03: Phần lõi

**What to build:** `plan.md` mục 3, Ticket C (bước 4–8), cùng các điểm của mục **Spike đã đổi gì** trong `spec.md`:

- `INTERFACE.md`: các thao tác launch-coordinator, launch-dispatcher, start-worker (workspace dùng chung), send, inspect, watch-pr/unwatch-pr/link-pr, settle/archive, list-workspaces, close-workspace, revive, schedule-wakes, flag-human, stop-worker; "sự kiện là một turn"; thay luật "one coordinator per repository".
- `COORDINATOR.md` (từ `PLAYBOOK.md`): đầu mỗi turn, Ticket chain, cổng reset, tài nguyên và park, collision, sự kiện PR, Land (đường tắt và cập nhật theo trunk khi giữ `merge`), comment, Routing, Quota, Merge guard, Humans, hai nhánh Close.
- `DISPATCHER.md`: các bước của `plan.md` mục 3 bước 6, thêm bước đánh thức coordinator khi có comment tin được chưa ack (`spec.md`, Spike đã đổi gì, mục 2) và revive trên worktree mới khi worktree cũ đã mất (mục 3–4); coordinator tự snooze lại cuối mỗi turn (`research/spike.md`, thử nghiệm 7); worker push bằng `git push origin HEAD:<branch>` vì nhánh của PR có sẵn không có upstream (thử nghiệm 1). Xoá `PLAYBOOK.md`.
- `WORK-ORDERS.md`: workspace dùng chung, checker đứng trên nhánh ở đúng head, verify ghi evidence ra memory, review bỏ qua file untracked do verify tạo, biến thể build gỡ conflict.
- `SKILL.md`: mô tả mới, mode `setup | setup override | run | once | pause | resume | stop`, trỏ tới `DISPATCHER.md` và `COORDINATOR.md`.

**Blocked by:** 01, 02

**Status:** ready-for-agent

**Door:** two-way

- [ ] Mỗi bước của dispatcher và của coordinator trong `plan.md` mục 1.3–1.13 có một chỗ duy nhất trong `DISPATCHER.md` hoặc `COORDINATOR.md`; giao thức tài nguyên chỉ nằm ở script và `MEMORY.md`
  Verify: đối chiếu từng gạch đầu dòng của plan với file; review độc lập
- [ ] `PLAYBOOK.md` không còn; không file nào của skill trỏ tới nó
  Verify: `grep -rn "PLAYBOOK" plugins/software/skills/factory`
- [ ] `INTERFACE.md` không nhắc tới T3
  Verify: `grep -n "T3\|t3" plugins/software/skills/factory/INTERFACE.md`
- [ ] Mỗi turn của coordinator và mỗi lần chạy dispatcher kết thúc bằng một tiêu chí hoàn thành kiểm được
  Verify: đọc file
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
