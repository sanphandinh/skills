# 07: Tài liệu và release

**What to build:**

- `AGENTS.md`, `PLATFORMS.md`, `README.md`, `templates/` nói về bốn harness.
- Cách cài cho từng harness: Claude Code bằng plugin; Cursor và Antigravity bằng plugin (đánh dấu chưa kiểm chứng nếu chưa cài thử); OpenCode bằng `npx skills … -a opencode`.
- `software` và `core` lên minor version. Release notes có lệnh gỡ plugin OMP và Codex.

**Blocked by:** 03, 04, 05, 06

**Status:** closed

**Door:** two-way

- [x] `git grep -n -i -E "omp|oh my pi|codex" -- AGENTS.md PLATFORMS.md README.md templates` chỉ còn release notes
  Verify: chạy lệnh
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh

## Handoff

**Delivered:** `PLATFORMS.md` viết lại cho bốn harness (bảng, layout, cách cài từng harness, factory là phần duy nhất delegate); `AGENTS.md` (nguyên tắc "One session works, the factory delegates", layout, luật 2 và 6, Current contents); `README.md` có release notes software 0.12.0, core 0.6.0; `templates/AGENTS.md`; `UPSTREAM.md`; `docs/agents/verify.md` bỏ dòng OMP. `software` 0.12.0 và `core` 0.6.0 trên ba manifest. Sửa mô tả `core` (bỏ "product opportunity audits", skill không tồn tại).
**Deviations from spec:** không.
**Gotchas:** lệnh cài Cursor và Antigravity trong `PLATFORMS.md` lấy từ tài liệu chính hãng và ghi rõ "not yet installed by hand".
**For the next ticket:** 08.
