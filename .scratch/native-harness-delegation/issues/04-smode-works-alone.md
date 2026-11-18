# 04: smode làm việc một mình

**What to build:**

- `smode/SKILL.md` thay **Delegation** bằng **Working alone**.
- Các playbook bỏ tên role và "fresh worker"; `verify` và `review` chạy như bước riêng trong cùng phiên.
- `code-review` chạy mỗi trục trên sub-agent mặc định của harness, model của phiên.
- Validator: `smode/` không nhắc `roles.md`, `roles.mjs`, và không dùng tên role.

**Blocked by:** 03

**Status:** ready-for-agent

**Door:** two-way

- [ ] `grep -rn -E "roles\.md|roles\.mjs|\`(scout|thinker|reviewer|coordinator)\`|fresh worker" plugins/software/skills/smode plugins/software/skills/code-review` trống
  Verify: chạy lệnh
- [ ] Validator báo lỗi khi `smode/` nhắc `roles.md` hoặc tên role
  Verify: test mới trong `cli/repo.test.mjs` (xanh và đỏ)
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
