# 03: Role và T3 chuyển sang factory

**What to build:** factory là nơi duy nhất đọc và viết `docs/agents/roles.md`.

- `roles-template.md`, `scripts/roles.mjs` và `roles.test.mjs` chuyển từ `smode/` sang `factory/`.
- Các bước role của playbook `setup` của smode (bảng role, viết `roles.md`, chứng minh bằng một worker) chuyển vào `factory/SETUP.md`.
- `smode/harness/t3.md` gộp vào `factory/references/t3.md`.
- Mọi đường dẫn tới `roles.mjs` đổi theo, và luật validator "roles template phải pass `roles check`" áp cho factory.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] `smode/` không còn `roles`, `harness/t3.md`
  Verify: `ls plugins/software/skills/smode plugins/software/skills/smode/scripts plugins/software/skills/smode/harness`
- [x] `factory setup` viết `roles.md`; playbook `setup` của smode không hỏi role
  Verify: đọc `factory/SETUP.md`, `smode/playbooks/setup.md`
- [x] `npm test` chạy test của `roles.mjs` ở vị trí mới
  Verify: `npm test`

## Handoff

**Delivered:** `factory/roles-template.md`, `factory/scripts/roles.mjs` và test (chuyển bằng `git mv`); `factory/SETUP.md` mục 2 viết `roles.md` (kiểm, chuyển từ chỗ cũ, đề xuất route, xoá file cũ khi người dùng đồng ý), `setup override` đổi được role; `factory/references/t3.md` có thêm **Candidates**, **Migration** (kể cả `~/.claude/rules/smode-roles.md`), **Work orders for other providers**, **Quota words**; `smode/harness/t3.md` đã xoá; playbook `setup` của smode chỉ còn tài liệu agent. Validator kiểm mọi `roles-template.md` của skill shared.
**Deviations from spec:** không.
**Gotchas:** `smode/SKILL.md` và `harness/claude-code.md` vẫn nhắc role: ticket 04, 05.
**For the next ticket:** 04.
