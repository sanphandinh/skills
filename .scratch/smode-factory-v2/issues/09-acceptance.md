# 09: Nghiệm thu `smode` và factory v2

**What to build:** bằng chứng rằng hai phần chạy được trên máy thật.

- **`smode` chạy tay**:
  - một `bug-fix` và một `ticket` trên Claude Code;
  - cùng hai việc đó trên OMP.

  Ở đây cài marketplace `sanphan-skills` cho Claude Code để kiểm thứ tự tìm skill trên bản cài thật.
- **Factory v2 trên T3**:
  - `once` với một ticket thật trên repo này, đi hết plan, build, check, land;
  - `run` ngắn với một spec nhỏ, qua ít nhất ba lần thức, trong đó có ít nhất một lần do watcher đánh thức.

**Blocked by:** 03, 08

**Status:** closed

**Door:** two-way

- [x] Trên Claude Code có cài marketplace, `smode` tìm được skill ở plugin khác qua `installPath`, và ghi lại đường dẫn thật vào `harness/claude-code.md`
  Verify: cài `core@sanphan-skills` và `software@sanphan-skills` cho Claude Code, chạy `smode` với một `bug-fix`, đọc các lần đọc file skill
- [x] `bug-fix` và `ticket` chạy xong trên Claude Code và trên OMP, mỗi lần có todo list chép nguyên các bước
  Verify: đọc transcript của bốn lần chạy
- [x] Factory v2 `once` đưa một ticket thật tới merge. PR có `factory/verify` và `factory/review` `success` trên đúng head đã merge.
  Verify: `gh pr view <n> --json mergeCommit,statusCheckRollup`
- [x] Bước `verify` và `review` chạy trên họ model khác với bước `ticket`
  Verify: đọc `results/` trong memory của v2: model của từng bước
- [x] Factory v2 `run` qua ít nhất ba lần thức, có một lần do watcher. Journal có một dòng cho mỗi lần thức.
  Verify: đọc `journal.md` trong memory của v2
- [x] Các bài học trong quá trình nghiệm thu được ghi vào wiki của v2, và mỗi chỗ sai được sửa trong skill tương ứng
  Verify: đọc `wiki/` và `git log` của nhánh nghiệm thu

## Comments

### Tiến độ 2026-11-15

- **Đạt:** `bug-fix` và `ticket` trên Claude Code (sandbox, ticket 03 và 04) và trên OMP (sandbox): todo list, kế hoạch trên ticket, `verify` và `review` trong worker mới, body PR có Merge Danger. Trên OMP, reviewer khác họ model gặp lỗi quota `USAGE_PRICING_REQUIRED` và chuyển sang `cursor/composer-2.5`. Sửa `bug-fix`: sửa trên nhánh mới, không lên trunk.
- **Đạt một phần:** Claude Code với marketplace cài thật. Marketplace thêm từ thư mục local chạy plugin thẳng từ thư mục nguồn, nên `smode` đi bước 2 (checkout) và đọc `research` từ `plugins/core`, đúng thứ tự. Bố cục `installed_plugins.json` và cache đã xác nhận, ghi vào `harness/claude-code.md`. Bước 3 (`installPath`) chỉ chạy thật với marketplace từ GitHub, tức là sau khi nhánh này được push. Marketplace, plugin và cache thử đã gỡ.
- **Chờ người dùng đồng ý:** factory v2 `once` với một ticket thật tới merge và `run` qua ba lần thức. Hai việc này cần `smode` và `factory-v2` nằm trên `main` (worktree của worker tạo từ trunk), nghĩa là phải push nhánh, mở PR và merge lên `main` trước.

### Nghiệm thu 2026-11-16

Sau khi PR #13 merge lên `main`:

- **Claude Code cài từ marketplace GitHub:** `core`, `software`, `software-claude` cài ở project scope trong sandbox. Lần chạy `smode` `investigation` đầu tiên đọc `core/0.9.0/skills/research/SKILL.md`, một thư mục không tồn tại, vì nó lấy version của `software` ghép vào; sau đó phải tìm mới ra `core/0.5.0`. Đã sửa ở #16 (bước 3 lấy `installPath` từ bản ghi cài đặt, mỗi plugin có version riêng). Bản sửa chỉ tới máy đã cài khi version tăng, nên có #17 (`software` 0.9.1). Lần chạy lại đọc thẳng `core/0.5.0`. Marketplace và plugin thử đã gỡ.
- **Factory v2 `once`:** một thread coordinator mới ở project root (Claude Opus, full-access) xây spec `repo-cli-polish`. Ticket 02 lên PR #14, ticket 01 lên PR #15. Cả hai đi đủ plan (Fable), build (Sonnet), verify và review (Antigravity Gemini 4 Hydrogen, khác họ), merge squash với `--match-head-commit`. `factory/verify` và `factory/review` đều `success` trên `2ed41cf` và `d4c3cc4`. Không có vòng rework, không có câu hỏi.
- **Factory v2 `run`:** watcher chạy 15 phút một lần trên Haiku. Lần thức 00:14Z do watcher gửi (trunk đổi), coordinator xây standalone ticket `factory-v2-fixes/01` tới PR #18. Có năm lần thức trong `run`, mỗi lần một dòng trong journal. Sau đó người dùng bảo dừng: coordinator xoá lịch watcher và ghi `Status: stopped`.
- **Lỗi tìm ra khi chạy, đã sửa trong skill:**
  - #18: kết quả của worker ghi `route` (do chính factory xây);
  - #19: close-workspace lấy worktree từ thread của worker, không khớp theo commit. Lần dọn theo commit đã xoá một worktree của người và worktree của watcher; cả hai sạch nên đã dựng lại;
  - #20: giờ trong journal đọc từ đồng hồ. Coordinator từng ước giờ, ghi 01:10Z cho lần thức lúc 00:09Z;
  - wiki v2 có thêm `tracker.md` (`Closes #NN` trên tracker local), `build.md`, và các mục mới trong `t3.md`.

## Handoff

**Delivered:** `smode` chạy được trên Claude Code (checkout, marketplace local và GitHub) và trên OMP; factory v2 trên T3 đưa ba ticket thật tới merge qua `once` và `run`, có watcher, quota và routing khác họ model cho verify và review.
**Interfaces introduced:** trường `route` trong mọi kết quả của worker; quy tắc close-workspace theo `worktreePath` của thread worker; giờ trong memory đọc từ `date -u`.
**Deviations from spec:** spec nhỏ cho `run` được thay bằng một standalone ticket, vì spec `repo-cli-polish` đã xong trong các lần `once`.
**Decisions:** coordinator chạy Claude Opus theo `docs/agents/factory-v2.md`; watcher chạy route `scout`.
**Gotchas:** plugin đã cài chỉ nhận bản sửa khi version tăng. Repo có remote `upstream`, nên `gh` cần `--repo sanphandinh/skills`. Thread watcher và worktree `t3-852b8422` của nó còn lại sau khi dừng; lần `run` sau tạo watcher mới. Lỗi `ls -la` trong precheck của v1 (`references/orca.md`) vẫn chưa sửa.
**For the next ticket:** 10: tài liệu khớp với những gì đã chạy.
**Links:** #13, #14, #15, #16, #17, #18, #19, #20; journal và wiki trong `~/.local/share/factory-v2/skills`
