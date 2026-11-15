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

**Status:** ready-for-agent

**Door:** two-way

- [ ] `plugins/factory/skills/factory-v2/` có đủ `SKILL.md`, `PLAYBOOK.md`, `WORK-ORDERS.md`, `INTERFACE.md`, `MEMORY.md`, `SETUP.md`. `plugins/factory/skills/factory/` không đổi.
  Verify: `git diff --stat main -- plugins/factory/skills/factory` trống; liệt kê thư mục v2
- [ ] Mỗi mục được giữ từ v1 có cùng nghĩa trong v2. Những chỗ khác chỉ là những thay đổi nêu trên.
  Verify: `diff -r plugins/factory/skills/factory plugins/factory/skills/factory-v2`, đọc từng khác biệt
- [ ] `MEMORY.md` mô tả `quota.md` và `providers.md`. `PLAYBOOK.md` có mục Routing và mục Quota.
  Verify: đọc hai file
- [ ] Lõi v2 không nhắc tới T3, Orca hay tên tool của harness nào
  Verify: `npm run validate`; `grep -n -i "t3\|orca" plugins/factory/skills/factory-v2/*.md` chỉ ra những dòng trỏ tới `references/`
- [ ] Mẫu `docs/agents/factory-v2.md` trong `SETUP.md` có `Manager:`, các route theo role, và đường dẫn memory riêng
  Verify: đọc `SETUP.md`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
