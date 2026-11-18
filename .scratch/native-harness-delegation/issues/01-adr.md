# 01: ADR-0006 và glossary

**What to build:** ADR-0006 ghi ba quyết định: bốn harness native (bỏ OMP, Codex), smode không delegate, delegation chỉ ở factory. Nó thay phần chọn model của smode trong ADR-0003 và ADR-0004, và phần OMP, Codex của ADR-0005. `GLOSSARY.md` bỏ hoặc sửa các mục nói smode chọn model theo role.

**Blocked by:** không

**Status:** ready-for-agent

**Door:** two-way

- [ ] `docs/adr/0006-*.md` có quyết định, phương án đã cân nhắc, hệ quả
  Verify: đọc file
- [ ] `GLOSSARY.md` không còn nói smode chọn model theo role
  Verify: `grep -n -i "role" GLOSSARY.md`
