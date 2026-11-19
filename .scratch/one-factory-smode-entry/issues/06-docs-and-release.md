# 06: Tài liệu và release

**What to build:** mọi tài liệu mà agent và người đọc dựa vào đều mô tả đúng kiến trúc mới, và các project đã cài biết phải gỡ gì:

- `AGENTS.md`: nguyên tắc "Three layers" thành hai layer (skill và playbook gọi role, project ánh xạ role sang model); mục Layout và Current contents đúng với repo. Bỏ năm skill không tồn tại (`frontend-web-project-setup`, `portless-web-project-setup`, `github-repo-setup`, `shadcn`, `portless-worktree-dev`), bỏ `software-claude`, `software-omp` và plugin `factory`, và ghi smode là entry point.
- `PLATFORMS.md`: bỏ cột Agents, bỏ phần "How skills, agents, and roles fit", phần Orca và "Running the factory" của v1. Mục chạy factory mô tả bản duy nhất trên T3.
- `README.md` và `templates/AGENTS.md`: cài `core` và `software`; factory chạy trên T3.
- Plugin `software` lên minor version. Release notes trong `README.md` có lệnh gỡ `factory`, `software-claude`, `software-omp` ở project scope cho Claude Code, Codex và OMP, và cách chạy `factory setup` để chuyển settings.

**Blocked by:** 03, 04, 05

**Status:** closed

**Door:** two-way

- [x] Mọi tên skill được backtick trong `AGENTS.md` mục Current contents đều có trong `plugins/*/skills/`
  Verify: so danh sách tên trong mục đó với `ls plugins/*/skills`
- [x] `AGENTS.md`, `PLATFORMS.md`, `README.md` và `templates/` không còn nhắc `software-claude`, `software-omp`, `ROLES.md`, Orca hay `factory-v2`, trừ trong release notes
  Verify: `git grep -n -i "software-claude\|software-omp\|ROLES\.md\|orca\|factory-v2" -- AGENTS.md PLATFORMS.md README.md templates`
- [x] Version của `software` trong `plugin.json` (Claude và Codex) lớn hơn version trên `main`
  Verify: `git diff main -- plugins/software/.claude-plugin/plugin.json plugins/software/.codex-plugin/plugin.json`
- [x] Release notes có lệnh gỡ cho từng harness và bước chuyển settings
  Verify: đọc release notes trong `README.md`
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `AGENTS.md` (hai layer, một entry point, layout, cách viết skill, Current contents chỉ còn skill có thật: đã bỏ năm skill không tồn tại và `audit-product-opportunity`), `PLATFORMS.md`, `README.md` có release notes và lệnh gỡ đã kiểm bằng `--help`, `templates/AGENTS.md`; `software` 0.11.0 trên Claude, Codex và catalog OMP.
**Interfaces introduced:** release notes software 0.11.0.
**Deviations from spec:** cập nhật thêm mô tả plugin `software` trong các manifest và marketplace.
**Decisions:** Claude dùng `claude plugin update`, OMP dùng `omp plugin upgrade` (theo `--help`).
**Gotchas:** `core` không đổi version.
**For the next ticket:** 07: chạy acceptance trên harness thật.
