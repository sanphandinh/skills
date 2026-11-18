# 06: Manifest Cursor và Antigravity

**What to build:**

- `.cursor-plugin/plugin.json` cho `core` và `software`, cùng `.cursor-plugin/marketplace.json` ở gốc repo.
- `.antigravity-plugin/plugin.json` cho mỗi plugin.
- Validator: mỗi plugin shared có `.claude-plugin`, `.cursor-plugin`, `.antigravity-plugin`, và các version khớp nhau.

**Blocked by:** 02

**Status:** ready-for-agent

**Door:** two-way

- [ ] Manifest theo đúng schema trong docs của Cursor và Antigravity
  Verify: so với docs; `agy plugin validate` nếu có CLI
- [ ] Validator báo lỗi khi thiếu manifest hoặc version lệch
  Verify: test mới
