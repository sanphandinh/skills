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

**Status:** ready-for-agent

**Door:** two-way

- [ ] Frontmatter của `ROLES.md` có năm role mới, mỗi role có giá trị cho mọi nền tảng. Validator báo lỗi khi thiếu.
  Verify: `npm test` có test dùng repo fixture với một role thiếu giá trị
- [ ] `templates/roles.omp-config.yml` có các role mới
  Verify: đọc template
- [ ] Trên Claude Code, `smode setup` ghi file rules role, và một session mới thấy các dòng role trong context
  Verify: chạy `smode setup`, mở một session mới, hỏi model role `thinker` là gì
- [ ] Trên OMP, `smode setup` cập nhật config cấp user, và một worker sinh với `model` lấy từ role được OMP duyệt
  Verify: chạy `smode setup` trong OMP, rồi nhờ `smode` sinh một worker `scout`, đọc model mà worker báo
- [ ] Chạy `setup` lần thứ hai không làm nhân đôi dòng nào
  Verify: chạy hai lần, so file cấu hình
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
