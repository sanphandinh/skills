# 02: Bỏ OMP và Codex

**What to build:** repo không còn file nào của OMP và Codex.

- Xoá `harness/omp.md`, `harness/codex.md`, `.omp-plugin/` và `.codex-plugin/` của mỗi plugin, `.omp-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, mọi `agents/openai.yaml`, `templates/roles.omp-config.yml`.
- `catalog.yaml` bỏ `platform: omp`.
- Validator bỏ luật về Codex policy và version OMP. Luật entry point chỉ còn `disable-model-invocation`.

**Blocked by:** 01

**Status:** closed

**Door:** two-way

- [x] `git ls-files | grep -i -E "omp|codex|openai.yaml"` chỉ còn release notes và `.scratch`
  Verify: chạy lệnh
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh

## Handoff

**Delivered:** đã xoá `harness/omp.md`, `harness/codex.md`, `.omp-plugin/`, `.codex-plugin/`, cả hai catalog, 28 file `agents/openai.yaml`, `templates/roles.omp-config.yml`. `catalog.yaml` chỉ còn `shared` và `claude`. Validator bỏ luật Codex policy và version OMP; thêm luật báo `agents/openai.yaml`; `upstream add`/`pull` bỏ `agents/openai.yaml` khỏi bản upstream. Đường dẫn config harness mà validator chặn đổi thành `~/.claude`, `~/.cursor`, `~/.gemini`, `~/.config/opencode`.
**Deviations from spec:** thêm luật validator và bộ lọc upstream cho `agents/openai.yaml`, để lần `upstream pull` sau không mang file Codex trở lại.
**Gotchas:** `smode/SKILL.md`, `PLATFORMS.md`, `README.md` vẫn nhắc OMP và Codex: ticket 05 và 07 sửa.
**For the next ticket:** 03.
