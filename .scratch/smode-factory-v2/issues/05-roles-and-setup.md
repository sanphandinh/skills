# 05: Role theo đặc tính và playbook `setup`

**What to build:** người dùng chạy `smode setup` một lần trên mỗi máy, và từ đó mọi worker `smode` sinh ra đều chạy trên model đúng với role của nó.

- **`ROLES.md`** có thêm các role `scout`, `worker`, `thinker`, `reviewer`, `coordinator`.
  - Mỗi role ghi đặc tính cần có, cùng giá trị cho từng nền tảng trong frontmatter.
  - Có quy tắc `reviewer` khác họ model với `worker`.
- **Playbook `setup`**:
  - gọi `setup-software-context` và `setup-verification` khi project còn thiếu;
  - hỏi người dùng chọn model cho từng role, chỉ trong số model mà harness báo là có;
  - ghi cấu hình. Trên Claude Code là một file rules luôn được nạp. Trên OMP là config cấp user, qua `templates/roles.omp-config.yml` có thêm role mới.
  - Mỗi lần chạy ghi đè toàn bộ file.
- **Validator** kiểm frontmatter của `ROLES.md`.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] Frontmatter của `ROLES.md` có năm role mới, mỗi role có giá trị cho mọi nền tảng. Validator báo lỗi khi thiếu.
  Verify: `npm test` có test dùng repo fixture với một role thiếu giá trị
- [x] `templates/roles.omp-config.yml` có các role mới
  Verify: đọc template
- [x] Trên Claude Code, `smode setup` ghi file rules role, và một session mới thấy các dòng role trong context
  Verify: chạy `smode setup`, mở một session mới, hỏi model role `thinker` là gì
- [x] Trên OMP, `smode setup` cập nhật config cấp user, và một worker sinh với `model` lấy từ role được OMP duyệt
  Verify: chạy `smode setup` trong OMP, rồi nhờ `smode` sinh một worker `scout`, đọc model mà worker báo
- [x] Chạy `setup` lần thứ hai không làm nhân đôi dòng nào
  Verify: chạy hai lần, so file cấu hình
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `ROLES.md` có role `coordinator` (OMP `@default`, Claude `sonnet`, Codex `medium`) và đoạn mô tả role của `smode`, quy tắc reviewer khác họ model, khái niệm route. Validator báo role thiếu `purpose`, `omp`, `claude` hoặc `codex` (test mới, 17/17). `templates/roles.omp-config.yml` có hai khối: role của `smode` (config user) và role của factory v1 (config project). Playbook `setup` (đề xuất theo đặc tính, role đã có giá trị thì giữ, hỏi cả setting cần cho per-call model, ghi đè có sao lưu, sao lưu không bao giờ đè bản có sẵn, chứng minh bằng một worker `scout`). Chạy thật:
- Claude Code: ghi `~/.claude/rules/smode-roles.md` (thư mục chưa có từ trước); worker `scout` với `model: haiku` báo Haiku; một session mới không công cụ trích đúng `thinker: fable high`; chạy lần hai không nhân đôi, để lại `smode-roles.md.bak`.
- OMP: thêm `scout`, `worker`, `thinker`, `coordinator` vào `modelRoles` của `~/.omp/agent/config.yml`, giữ `reviewer: cursor/gemini-4-hydrogen:high` của factory v1, thêm `task.perCallModel: on`; một session `omp -p` mới sinh `scout` với `model: anthropic/claude-haiku-5-5:medium` và nó báo Haiku. Bản `config.yml.bak` của người dùng nguyên vẹn; sao lưu mới là `config.yml.bak-20261115232035` và `…232137`.
**Interfaces introduced:** `~/.claude/rules/smode-roles.md` (một dòng mỗi role `<role>: <model> <effort>`); role `scout`, `worker`, `thinker`, `reviewer`, `coordinator` trong `modelRoles` của config user OMP; `task.perCallModel: on`.
**Deviations from spec:** spec không nhắc `task.perCallModel`; chạy thật cho thấy nó mặc định `off` và chặn per-call model, nên harness doc và setup thêm bước này.
**Decisions:** role trùng tên với factory v1 (`reviewer`) được giữ giá trị cũ thay vì ghi đè.
**Gotchas:** `omp -p` không có `< /dev/null` sẽ chờ stdin mãi. Session OMP đọc setting lúc khởi động: thay đổi chỉ có hiệu lực ở session mới. Trên Claude Code, reviewer không thể khác họ model với worker.
**For the next ticket:** 06: `harness/t3.md` phải tồn tại; OMP chạy trong môi trường T3 đã tìm nó và báo thiếu. Route của T3 nằm trong file role của harness chạy coordinator.
**Links:** commit `a5dc0c8` và các commit sửa setup sau đó
