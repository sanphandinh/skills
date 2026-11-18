# 03: Bỏ platform agent và `ROLES.md`

**What to build:** marketplace chỉ còn plugin shared (`core`, `software`), và mọi bước chọn model theo role trong `docs/agents/roles.md` của project:

- Xoá hẳn `plugins/software-claude` và `plugins/software-omp` (agent lẫn hai rule TDD), cùng entry của chúng trong `catalog.yaml` và các marketplace.
- `code-review`: mỗi trục (Standards, Spec) chạy trên một worker của role `reviewer` theo `docs/agents/roles.md`. Không có file đó thì dùng sub-agent general-purpose. Không có sub-agent thì tự chạy hai trục, giữ hai báo cáo riêng. Không nhắc agent theo tên. Ghi thay đổi này vào `rewrites` của `UPSTREAM.md` để `upstream pull` không làm mất nó.
- Xoá `ROLES.md`. Validator lấy năm role từ script roles của `smode`, bỏ phần kiểm agent Claude và OMP cùng danh sách role có sẵn của OMP, và giữ luật "plugin shared không có `agents/`". Khái niệm `platform` trong catalog vẫn còn.
- Template: `roles.omp-config.yml` chỉ còn phần grant của smode; xoá `roles.claude-settings.json`. `harness/omp.md` bỏ đoạn **Platform agents**, và câu cuối về rule OMP.

**Blocked by:** 02 (cùng sửa `catalog.yaml` và các marketplace)

**Status:** needs-triage

**Door:** two-way

- [ ] `plugins/software-claude`, `plugins/software-omp`, `ROLES.md` và `templates/roles.claude-settings.json` không còn
  Verify: `ls plugins`; `test ! -e ROLES.md && echo gone`
- [ ] Không còn chữ `software-claude`, `software-omp`, `review-standards`, `review-spec` hay `ROLES.md` ngoài `docs/adr/`, `.scratch/` và release notes
  Verify: `git grep -n "software-claude\|software-omp\|review-standards\|review-spec\|ROLES\.md" -- ':!docs/adr' ':!.scratch'`
- [ ] `code-review` giao mỗi trục cho một worker role `reviewer`, có hai fallback, và `UPSTREAM.md` có rewrite tương ứng
  Verify: đọc mục chọn sub-agent của `code-review/SKILL.md`; `grep -n -A4 "code-review" UPSTREAM.md`
- [ ] Validator báo lỗi khi một plugin shared có `agents/`, và không còn đọc `ROLES.md`
  Verify: test mới trong `cli/repo.test.mjs` (xanh và đỏ); `grep -n "ROLES.md\|OMP_BUILTIN_ROLES" cli/lib.mjs` trống
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
