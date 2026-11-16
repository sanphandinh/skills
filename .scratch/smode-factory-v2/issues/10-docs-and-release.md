# 10: Tài liệu và phát hành

**What to build:** người dùng mới đọc repo biết `smode` và factory v2 là gì, cài thế nào, chạy trên đâu. Plugin được nâng version để các máy nhận bản mới.

- `README.md`: giới thiệu `smode` là điểm vào chính, factory v2 cạnh v1.
- `PLATFORMS.md`: bảng harness (Claude Code, Codex, OMP, T3) và bảng manager (Orca cho v1, T3 cho v2). Mục "Running the factory" có thêm v2 trên T3.
- Phần "Current contents" trong `AGENTS.md`: `smode` trong `software`, `factory-v2` trong `factory`.
- Mô tả trong `catalog.yaml` và ba marketplace.
- Credit pstack (cursor/plugins, MIT, Lauren Tan) trong `UPSTREAM.md`, mục Other sources.
- Nâng version plugin `software` và `factory` trên mọi manifest.

**Blocked by:** 03, 09

**Status:** closed

**Door:** two-way

- [x] `README.md`, `PLATFORMS.md` và `AGENTS.md` nói đúng những gì đã chạy được trong ticket 09
  Verify: đọc ba file, đối chiếu với kết quả nghiệm thu
- [x] `UPSTREAM.md` credit pstack, kèm link và giấy phép MIT
  Verify: `grep -n pstack UPSTREAM.md`
- [x] Mọi manifest của `software` và `factory` cùng một version mới, và catalog OMP khớp
  Verify: `npm test` (đã có test kiểm version của manifest)
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** README, PLATFORMS và AGENTS mô tả `smode` và factory v2 đúng như lần nghiệm thu đã chạy (thread coordinator ở project root, full-access, watcher route `scout`, memory ở `~/.local/share/factory-v2/<repo>`). pstack được credit trong `UPSTREAM.md`. Version hiện tại: `software` 0.9.1, `factory` 0.4.3 trên mọi manifest và catalog OMP.
**Interfaces introduced:** none
**Deviations from spec:** version tăng thêm sau phát hành (0.9.1, 0.4.1 tới 0.4.3) vì các bản sửa từ nghiệm thu.
**Decisions:** none
**Gotchas:** mỗi bản sửa skill cần tăng version, nếu không máy đã cài không nhận.
**For the next ticket:** none
**Links:** #13, #17, #19, #20
