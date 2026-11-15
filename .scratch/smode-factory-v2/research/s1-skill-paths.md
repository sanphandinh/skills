# S1: `smode` tìm skill ở plugin khác bằng cách nào

Ngày: 2026-11-15. Cách làm: đọc thư mục cài đặt trên máy của người dùng, không cài thêm gì.

## Câu hỏi

Từ `software/skills/smode/SKILL.md`, có lần ra được `SKILL.md` của một skill nằm ở plugin khác (ví dụ `core/skills/grilling`) không, trên từng harness?

## Quan sát

**OMP** (đo được):
- Mỗi plugin được cài vào một thư mục riêng, tên có kèm version:
  - `~/.omp/plugins/cache/plugins/sanphan-skills___software___0.8.1/skills/`
  - `~/.omp/plugins/cache/plugins/sanphan-skills___core___0.4.0/skills/`
  - `~/.omp/plugins/cache/plugins/sanphan-skills___factory___0.2.1/skills/`
- `~/.omp/plugins/installed_plugins.json` ghi `installPath` và `version` của từng plugin `<plugin>@sanphan-skills`.
- `~/.omp/plugins/cache/marketplaces/sanphan-skills/` là bản sao đầy đủ của repo, có `plugins/core`, `plugins/software`, …

**Claude Code** (một phần đo được, một phần suy ra):
- Máy này chưa cài marketplace `sanphan-skills` cho Claude Code. Chỉ có `claude-plugins-official`.
- `~/.claude/plugins/marketplaces/claude-plugins-official/` là bản sao đầy đủ của repo marketplace (có `.claude-plugin/` và `plugins/`), đo được.
- Bản cài của từng plugin nằm dưới `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, kèm `installed_plugins.json`. Đây là suy ra từ cách Claude Code thường làm, vì máy này không có thư mục đó. Cần kiểm lại sau khi cài `sanphan-skills`.

**Codex**: máy này không có thư mục plugin của Codex. Chưa kiểm được.

**Bản checkout của repo** (đo được): từ `plugins/software/skills/smode/`, đi lên ba cấp ra `plugins/`, nên `plugins/core/skills/grilling/SKILL.md` tìm thấy trực tiếp.

## Kết luận

- Đường dẫn tương đối kiểu pstack (`../<name>/SKILL.md`) **chỉ đúng trong cùng một plugin**. Ở bản cài, plugin `core` không nằm cạnh `software`: thư mục của nó có tên và version khác.
- Cách quy tên ra đường dẫn chạy được:
  1. **Skills index**: `smode/skills-index.md` ghi mỗi skill thuộc plugin nào (`grilling: core`), do `cli/repo.mjs` sinh và validator kiểm.
  2. **Thứ tự tìm** cho một tên skill:
     1. harness đã nạp skill thì gọi theo cách gốc;
     2. bản checkout của repo: `<plugins>/<plugin>/skills/<name>/SKILL.md`, khi đi lên ba cấp từ `smode` gặp thư mục `plugins/` có `core/`;
     3. file plugin đã cài của harness: `installPath` của `<plugin>@sanphan-skills`, cộng `skills/<name>/SKILL.md`;
     4. bản sao marketplace của harness: `plugins/<plugin>/skills/<name>/SKILL.md`.
  3. Đường dẫn của từng harness (bước 3 và 4) ghi trong `smode/harness/<tên>.md`, không ghi trong `SKILL.md`.
- **Worker trên T3 chạy provider khác** (Cursor, Antigravity) không có bản cài của mình. Coordinator quy tên ra đường dẫn tuyệt đối bằng harness của nó, rồi đưa đường dẫn đó vào brief.
- **Rủi ro lệch version:** bản sao marketplace có thể mới hơn plugin đã cài. Ví dụ trên OMP, marketplace cập nhật 2026-11-15 nhưng `software` vẫn là bản 0.8.1 cài ngày 2026-11-06. Bước 3 (bản đã cài) phải đứng trước bước 4 (bản sao marketplace).
- **Quyết định "`smode` nằm trong plugin `software`" vẫn giữ được.**

## Còn mở

- Kiểm bố cục cài đặt của Claude Code sau khi cài `sanphan-skills`.
- Kiểm bố cục cài đặt của Codex khi bật Codex.
