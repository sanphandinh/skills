# 07: Lõi của `factory-v2`

**What to build:** skill `factory-v2` trong plugin `factory`. Nó là bản chép của v1 rồi sửa, nằm cạnh v1. Lõi không nhắc tới manager hay harness cụ thể nào.

- **Giữ từ v1**: ticket chain, merge guard, stop the line, humans và hold, limits, events, bố cục memory, 10 thao tác (start-worker nhận thêm model), JSON kết quả, tên verdict status.
- **Work order**: phần của từng role bảo worker chạy playbook `plan-ticket`, `ticket`, `verify` hoặc `review` của `smode` theo đường dẫn tuyệt đối. Không còn dòng delegation.
- **Routing**: chọn model theo route của role, lọc theo `providers.md`, theo báo cáo của manager, và theo `quota.md`.
- **Quota**: thất bại vì giới hạn dùng thì chặn route tới giờ reset hoặc 1 giờ, chạy lại bước một lần trên ứng viên kế tiếp, không tính là thất bại. Khi mọi ứng viên bị chặn thì chờ và ghi journal.
- **Provider không hỏi được**: worker báo `failed` kèm `questions`, coordinator hold ticket.
- **Cấu hình và memory riêng**: `docs/agents/factory-v2.md`, `~/.local/share/factory-v2/<repo>`. Setup có thể nhập wiki của v1.
- **Một coordinator cho mỗi repo**: setup từ chối khi lịch thức của bản kia đang bật.
- **Smoke test** thêm bước kiểm từng provider: đọc skill theo đường dẫn, ghi kết quả ra ngoài repo, push dry run bằng `HEAD:<branch>`, hỏi được hay không, `pwd` và `git status` nằm trong worktree.

**Blocked by:** 04, 05

**Status:** closed

**Door:** two-way

- [x] `plugins/factory/skills/factory-v2/` có đủ `SKILL.md`, `PLAYBOOK.md`, `WORK-ORDERS.md`, `INTERFACE.md`, `MEMORY.md`, `SETUP.md`. `plugins/factory/skills/factory/` không đổi.
  Verify: `git diff --stat main -- plugins/factory/skills/factory` trống; liệt kê thư mục v2
- [x] Mỗi mục được giữ từ v1 có cùng nghĩa trong v2. Những chỗ khác chỉ là những thay đổi nêu trên.
  Verify: `diff -r plugins/factory/skills/factory plugins/factory/skills/factory-v2`, đọc từng khác biệt
- [x] `MEMORY.md` mô tả `quota.md` và `providers.md`. `PLAYBOOK.md` có mục Routing và mục Quota.
  Verify: đọc hai file
- [x] Lõi v2 không nhắc tới T3, Orca hay tên tool của harness nào
  Verify: `npm run validate`; `grep -n -i "t3\|orca" plugins/factory/skills/factory-v2/*.md` chỉ ra những dòng trỏ tới `references/`
- [x] Mẫu `docs/agents/factory-v2.md` trong `SETUP.md` có `Manager:`, các route theo role, và đường dẫn memory riêng
  Verify: đọc `SETUP.md`
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** skill `factory-v2` (user-invoked, plugin `factory`): `SKILL.md`, `PLAYBOOK.md` (thêm **Routing**: chọn ứng viên đầu tiên của route đã qua kiểm provider, đang dùng được, không bị chặn quota, reviewer khác họ model với bản build; thêm **Quota**: lỗi giới hạn dùng thì chặn tới giờ reset hoặc 1 giờ, chạy lại một lần trên ứng viên kế tiếp, không tính là thất bại; worker không hỏi được thì `failed` kèm `questions` là câu hỏi), `WORK-ORDERS.md` (mỗi role chạy một playbook của `smode` theo đường dẫn tuyệt đối, kèm đường dẫn skill đã quy, dùng shell khi tool file từ chối, `ticket` dừng ở bước 7), `INTERFACE.md` (start-worker nhận model và không tự đổi; inspect báo provider dùng được và câu lỗi), `MEMORY.md` (`providers.md`, `quota.md`, `Factory: v2`), `SETUP.md` (`docs/agents/factory-v2.md` với `Factory: v2`, `Manager:`, `Coordinator:`, `Memory: ~/.local/share/factory-v2/<repo>`, `Routes:`; từ chối khi v1 đang chạy; kiểm `smode` và route; nhập wiki v1; bước 8 kiểm từng provider). `smode` có playbook `factory` chuyển sang `factory-v2`, mục lục không còn dòng "Not written yet". v1 không đổi; lõi v2 không có chữ T3, Orca hay omp; skills index được sinh lại sau khi validator báo cũ. 17/17 test, validate sạch.
**Interfaces introduced:** `docs/agents/factory-v2.md`; dòng `providers.md` và `quota.md`; start-worker nhận model.
**Deviations from spec:** không.
**Decisions:** tên worker giữ theo bước của v1 (`planner`, `implementer`, `verifier`, `reviewer`) để tracker và journal đọc như v1; role của `smode` gắn theo bước.
**Gotchas:** `references/` của v2 còn trống tới ticket 08; `run` cần prompt thức dậy do reference cung cấp.
**For the next ticket:** 08: reference phải cho prompt thức dậy chạy `factory-v2` ở mode `once` trên harness của coordinator, cách inspect báo provider dùng được (`orchestrator_capabilities`), và cách đọc câu lỗi (activity của child thread).
**Links:** commit của ticket này
