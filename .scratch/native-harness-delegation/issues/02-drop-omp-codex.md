# 02: Bỏ OMP và Codex

**What to build:** repo không còn file nào của OMP và Codex.

- Xoá `harness/omp.md`, `harness/codex.md`, `.omp-plugin/` và `.codex-plugin/` của mỗi plugin, `.omp-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, mọi `agents/openai.yaml`, `templates/roles.omp-config.yml`.
- `catalog.yaml` bỏ `platform: omp`.
- Validator bỏ luật về Codex policy và version OMP. Luật entry point chỉ còn `disable-model-invocation`.

**Blocked by:** 01

**Status:** ready-for-agent

**Door:** two-way

- [ ] `git ls-files | grep -i -E "omp|codex|openai.yaml"` chỉ còn release notes và `.scratch`
  Verify: chạy lệnh
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
