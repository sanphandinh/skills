# 07: Tài liệu và release

**What to build:**

- `AGENTS.md`, `PLATFORMS.md`, `README.md`, `templates/` nói về bốn harness.
- Cách cài cho từng harness: Claude Code bằng plugin; Cursor và Antigravity bằng plugin (đánh dấu chưa kiểm chứng nếu chưa cài thử); OpenCode bằng `npx skills … -a opencode`.
- `software` và `core` lên minor version. Release notes có lệnh gỡ plugin OMP và Codex.

**Blocked by:** 03, 04, 05, 06

**Status:** ready-for-agent

**Door:** two-way

- [ ] `git grep -n -i -E "omp|oh my pi|codex" -- AGENTS.md PLATFORMS.md README.md templates` chỉ còn release notes
  Verify: chạy lệnh
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
