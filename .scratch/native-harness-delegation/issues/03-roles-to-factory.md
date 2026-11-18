# 03: Role và T3 chuyển sang factory

**What to build:** factory là nơi duy nhất đọc và viết `docs/agents/roles.md`.

- `roles-template.md`, `scripts/roles.mjs` và `roles.test.mjs` chuyển từ `smode/` sang `factory/`.
- Các bước role của playbook `setup` của smode (bảng role, viết `roles.md`, chứng minh bằng một worker) chuyển vào `factory/SETUP.md`.
- `smode/harness/t3.md` gộp vào `factory/references/t3.md`.
- Mọi đường dẫn tới `roles.mjs` đổi theo, và luật validator "roles template phải pass `roles check`" áp cho factory.

**Blocked by:** 02

**Status:** ready-for-agent

**Door:** two-way

- [ ] `smode/` không còn `roles`, `harness/t3.md`
  Verify: `ls plugins/software/skills/smode plugins/software/skills/smode/scripts plugins/software/skills/smode/harness`
- [ ] `factory setup` viết `roles.md`; playbook `setup` của smode không hỏi role
  Verify: đọc `factory/SETUP.md`, `smode/playbooks/setup.md`
- [ ] `npm test` chạy test của `roles.mjs` ở vị trí mới
  Verify: `npm test`
