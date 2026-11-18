# 02: Một factory trong plugin `software`

**What to build:** người dùng gọi skill `factory` (`setup`, `setup override`, `run`, `once`) và nhận đúng hành vi của `factory-v2` hôm nay, nhưng chỉ còn một factory:

- Skill `factory` nằm trong plugin `software`, nội dung lấy từ `factory-v2`. Plugin `factory`, factory v1 và `references/orca.md` bị xoá. `catalog.yaml` và ba marketplace không còn plugin `factory`.
- Bỏ mọi dòng chỉ tồn tại vì có hai version: `Factory: v2` trong settings và index, "one repository runs one version", bước kiểm lịch thức của v1 trong setup, câu "Version 2 changes…" trong interface, bước 4 của playbook `factory` của smode.
- Settings là `docs/agents/factory.md`. Setup chuyển đổi trước khi làm gì khác: `factory-v2.md` đổi tên và giữ `Memory:`; một `factory.md` của v1 (có `Agent:`, không có `Coordinator:`) được báo ra, và chỉ ghi đè khi người dùng đồng ý.
- Memory mặc định `~/.local/share/factory/<repo>`. Với một thư mục v1 đã có, setup thêm `providers.md` và `quota.md` và giữ journal, wiki, results.
- Tên worker theo bước (`plan`, `build`, `verify`, `review`), dùng cho tên worker, tên file kết quả, khoá trong work order và trường `step` (thay `role`) của kết quả. Bảng bước sang role trong **Routing**.
- Wake prompt và watcher trong `references/t3.md` dùng skill `factory` ở mode `once`.
- Bảng ticket chain nói "what the tracker and the pull request show", không nói "GitHub".
- Repo này: xoá `docs/agents/factory.md` của v1, đổi tên `docs/agents/factory-v2.md`, sửa `merge-policy.md` nếu nó nhắc tên file cũ.

**Blocked by:** 01

**Status:** needs-triage

**Door:** two-way

- [ ] `plugins/software/skills/factory/` có `SKILL.md`, `PLAYBOOK.md`, `WORK-ORDERS.md`, `INTERFACE.md`, `MEMORY.md`, `SETUP.md`, `references/t3.md`; `plugins/factory/` không còn
  Verify: `ls -R plugins/software/skills/factory`; `test ! -e plugins/factory && echo gone`
- [ ] Không còn chữ `factory-v2`, `version 1`, `v1`, `Orca` hay `orca` trong repo, trừ `docs/adr/`, `.scratch/` và release notes
  Verify: `git grep -n -i "factory-v2\|version 1\|\bv1\b\|orca" -- ':!docs/adr' ':!.scratch'`
- [ ] Không marketplace nào và `catalog.yaml` cũng không liệt kê plugin `factory`
  Verify: `grep -n '"factory"\|^  factory:' .claude-plugin/marketplace.json .agents/plugins/marketplace.json .omp-plugin/marketplace.json catalog.yaml` trống
- [ ] `SETUP.md` mô tả hai đường chuyển đổi (settings v2, settings v1) và việc nâng cấp thư mục memory v1 tại chỗ
  Verify: đọc mục chuyển đổi của `SETUP.md`
- [ ] Worker, file kết quả và trường `step` dùng `plan`, `build`, `verify`, `review`; **Routing** ánh xạ chúng sang `thinker`, `worker`, `reviewer`
  Verify: `grep -n "planner\|implementer\|verifier" plugins/software/skills/factory/*.md plugins/software/skills/factory/references/*.md` trống; đọc **Routing**
- [ ] Repo này có `docs/agents/factory.md` với `Manager: t3`, `Memory: ~/.local/share/factory-v2/skills`, không có dòng `Factory:`; không còn `docs/agents/factory-v2.md`
  Verify: `cat docs/agents/factory.md`; `test ! -e docs/agents/factory-v2.md && echo gone`
- [ ] Skills index đã sinh lại, `npm run validate` và `npm test` pass
  Verify: `npm run index && git diff --stat`; chạy `npm run validate` và `npm test`
