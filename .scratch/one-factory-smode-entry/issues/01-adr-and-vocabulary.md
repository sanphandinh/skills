# 01: ADR-0005 và từ vựng

**What to build:** một ADR ghi ba quyết định của spec `one-factory-smode-entry`: một factory trong plugin `software` (không còn v1, không còn Orca), không còn platform agent (`software-claude`, `software-omp`, `ROLES.md`), và `smode` tự kích hoạt làm entry point, các skill khác của `software` chỉ chạy khi được gọi tên. ADR nói rõ nó thay thế phần nào của ADR-0002, ADR-0003 và ADR-0004, và liệt kê các phương án đã cân nhắc: giữ v1 frozen, giữ agent làm fallback, hay chỉ thêm một directive vào `AGENTS.md` thay vì đổi kích hoạt. `GLOSSARY.md` cập nhật **Mode skill** (entry point, tự kích hoạt) và **Playbook** (entry playbook và step playbook).

**Blocked by:** None (can start immediately). Cần branch `feat/project-config-roles` (ADR-0004) đã merge vào `main`.

**Status:** needs-triage

**Door:** two-way

- [ ] `docs/adr/0005-*.md` có đủ ba quyết định, mục Considered options và mục Consequences, và nêu rõ các phần bị thay thế của ADR-0002, ADR-0003, ADR-0004
  Verify: đọc file; `grep -n "0002\|0003\|0004" docs/adr/0005-*.md`
- [ ] `GLOSSARY.md` định nghĩa entry playbook và step playbook dưới **Playbook**, và **Mode skill** nói nó tự kích hoạt
  Verify: `grep -n -A3 "^\*\*Playbook\*\*\|^\*\*Mode skill\*\*" GLOSSARY.md`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
