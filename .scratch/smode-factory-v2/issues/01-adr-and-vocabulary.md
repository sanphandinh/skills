# 01: ADR-0003 và từ vựng cho `smode` và factory v2

**What to build:** người đọc repo hiểu được kiến trúc mới trước khi có dòng skill nào. Có ba phần:

- **ADR-0003** ghi lại các quyết định:
  - một mode skill `smode` với các playbook;
  - model được chọn lúc giao việc theo role, không qua agent definition;
  - skill được tìm theo tên qua skills index, theo thứ tự trong spec;
  - T3 chỉ là một reference;
  - factory v2 nằm cạnh v1, v1 đóng băng;
  - chế độ chỉ đọc là quy tắc bằng lời, không phải mode.
- **`GLOSSARY.md`** có thêm Harness, Mode skill, Playbook, Role, Route. Mỗi thuật ngữ có dòng _Avoid_.
- **`AGENTS.md`** cho phép nhắc tên tool trong `smode/harness/` và trong reference của factory. Quy tắc "Never name an agent's tools" vẫn giữ cho skill và playbook.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Door:** two-way

- [ ] `docs/adr/0003-*.md` ghi đủ sáu quyết định trên, mỗi quyết định kèm lý do, và dẫn tới kết quả spike
  Verify: đọc ADR, đối chiếu với mục Implementation Decisions của spec
- [ ] `GLOSSARY.md` định nghĩa Harness, Mode skill, Playbook, Role, Route, mỗi thuật ngữ có _Avoid_. Harness được phân biệt rõ với Agent manager.
  Verify: `grep -n "^\*\*Harness\*\*\|^\*\*Mode skill\*\*\|^\*\*Playbook\*\*\|^\*\*Role\*\*\|^\*\*Route\*\*" GLOSSARY.md` ra năm dòng
- [ ] Mục "Writing a shared skill" trong `AGENTS.md` nói rằng tên tool chỉ được nhắc trong `harness/` của mode skill và trong `references/` của factory
  Verify: đọc `AGENTS.md`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
