# 06: Manifest Cursor và Antigravity

**What to build:**

- `.cursor-plugin/plugin.json` cho `core` và `software`, cùng `.cursor-plugin/marketplace.json` ở gốc repo.
- `.antigravity-plugin/plugin.json` cho mỗi plugin.
- Validator: mỗi plugin shared có `.claude-plugin`, `.cursor-plugin`, `.antigravity-plugin`, và các version khớp nhau.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] Manifest theo đúng schema trong docs của Cursor và Antigravity
  Verify: so với docs; `agy plugin validate` nếu có CLI
- [x] Validator báo lỗi khi thiếu manifest hoặc version lệch
  Verify: test mới

## Handoff

**Delivered:** `.cursor-plugin/plugin.json` và `.antigravity-plugin/plugin.json` cho `core` và `software`, `.cursor-plugin/marketplace.json` ở gốc repo. Validator: plugin shared có manifest thì phải có đủ ba manifest cùng version, và hai marketplace liệt kê đúng các plugin shared.
**Deviations from spec:** không chạy được `agy plugin validate` (máy không có `agy`). Manifest Antigravity được đối chiếu bằng tay với schema chính thức (`https://antigravity.google/schemas/v1/plugin.json`: `additionalProperties: false`, chỉ bắt buộc `name`).
**Gotchas:** chưa biết `agy plugin install <github url>` có đọc được repo nhiều plugin không; tài liệu chỉ nói về cài từ URL và từ đường dẫn. `PLATFORMS.md` hướng dẫn cài từ đường dẫn của bản clone.
**For the next ticket:** 07.
