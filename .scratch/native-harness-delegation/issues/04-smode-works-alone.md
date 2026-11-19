# 04: smode làm việc một mình

**What to build:**

- `smode/SKILL.md` thay **Delegation** bằng **Working alone**.
- Các playbook bỏ tên role và "fresh worker"; `verify` và `review` chạy như bước riêng trong cùng phiên.
- `code-review` chạy mỗi trục trên sub-agent mặc định của harness, model của phiên.
- Validator: `smode/` không nhắc `roles.md`, `roles.mjs`, và không dùng tên role.

**Blocked by:** 03

**Status:** closed

**Door:** two-way

- [x] `grep -rn -E "roles\.md|roles\.mjs|\`(scout|thinker|reviewer|coordinator)\`|fresh worker" plugins/software/skills/smode plugins/software/skills/code-review` trống
  Verify: chạy lệnh
- [x] Validator báo lỗi khi `smode/` nhắc `roles.md` hoặc tên role
  Verify: test mới trong `cli/repo.test.mjs` (xanh và đỏ)
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh

## Handoff

**Delivered:** `smode/SKILL.md` có mục **Working alone** thay cho **Delegation** (không worker, không chọn model; verify và review là bước riêng bắt đầu lại từ ticket và diff; skill có sub-agent dùng sub-agent mặc định của harness trên model của phiên; worker của factory theo work order). Các playbook `bug-fix`, `feature`, `investigation`, `plan-ticket`, `review`, `refactor`, `ticket`, `spec-run`, `verify`, `quick` không còn role hay fresh worker. `code-review` dùng sub-agent mặc định, không truyền model. Validator báo `docs/agents/roles.md`, `roles.mjs`, tên role và "fresh worker" trong mode skill, trừ `harness/`.
**Deviations from spec:** `ticket` bỏ câu "Never review your own change", thay bằng "Never let your self-check stand in for step 8", vì review giờ chạy trong cùng phiên.
**Gotchas:** `harness/claude-code.md` vẫn có **Candidates** và **Migration**: ticket 05.
**For the next ticket:** 05.
