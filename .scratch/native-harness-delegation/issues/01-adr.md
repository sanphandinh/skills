# 01: ADR-0006 và glossary

**What to build:** ADR-0006 ghi ba quyết định: bốn harness native (bỏ OMP, Codex), smode không delegate, delegation chỉ ở factory. Nó thay phần chọn model của smode trong ADR-0003 và ADR-0004, và phần OMP, Codex của ADR-0005. `GLOSSARY.md` bỏ hoặc sửa các mục nói smode chọn model theo role.

**Blocked by:** không

**Status:** closed

**Door:** two-way

- [x] `docs/adr/0006-*.md` có quyết định, phương án đã cân nhắc, hệ quả
  Verify: đọc file
- [x] `GLOSSARY.md` không còn nói smode chọn model theo role
  Verify: `grep -n -i "role" GLOSSARY.md`

## Handoff

**Delivered:** `docs/adr/0006-four-native-harnesses-smode-works-alone.md` với số đo của bốn harness; `GLOSSARY.md` (Harness: bốn harness; Role: chỉ factory delegate theo role; Route: coordinator của factory chọn).
**Deviations from spec:** không.
**For the next ticket:** 02 xoá OMP và Codex.
