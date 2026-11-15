# 10: Tài liệu và phát hành

**What to build:** người dùng mới đọc repo biết `smode` và factory v2 là gì, cài thế nào, chạy trên đâu. Plugin được nâng version để các máy nhận bản mới.

- `README.md`: giới thiệu `smode` là điểm vào chính, factory v2 cạnh v1.
- `PLATFORMS.md`: bảng harness (Claude Code, Codex, OMP, T3) và bảng manager (Orca cho v1, T3 cho v2). Mục "Running the factory" có thêm v2 trên T3.
- Phần "Current contents" trong `AGENTS.md`: `smode` trong `software`, `factory-v2` trong `factory`.
- Mô tả trong `catalog.yaml` và ba marketplace.
- Credit pstack (cursor/plugins, MIT, Lauren Tan) trong `UPSTREAM.md`, mục Other sources.
- Nâng version plugin `software` và `factory` trên mọi manifest.

**Blocked by:** 03, 09

**Status:** ready-for-agent

**Door:** two-way

- [ ] `README.md`, `PLATFORMS.md` và `AGENTS.md` nói đúng những gì đã chạy được trong ticket 09
  Verify: đọc ba file, đối chiếu với kết quả nghiệm thu
- [ ] `UPSTREAM.md` credit pstack, kèm link và giấy phép MIT
  Verify: `grep -n pstack UPSTREAM.md`
- [ ] Mọi manifest của `software` và `factory` cùng một version mới, và catalog OMP khớp
  Verify: `npm test` (đã có test kiểm version của manifest)
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
