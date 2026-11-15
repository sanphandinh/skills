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

**Status:** ready-for-agent

**Door:** two-way

- [ ] Trên Claude Code có cài marketplace, `smode` tìm được skill ở plugin khác qua `installPath`, và ghi lại đường dẫn thật vào `harness/claude-code.md`
  Verify: cài `core@sanphan-skills` và `software@sanphan-skills` cho Claude Code, chạy `smode` với một `bug-fix`, đọc các lần đọc file skill
- [ ] `bug-fix` và `ticket` chạy xong trên Claude Code và trên OMP, mỗi lần có todo list chép nguyên các bước
  Verify: đọc transcript của bốn lần chạy
- [ ] Factory v2 `once` đưa một ticket thật tới merge. PR có `factory/verify` và `factory/review` `success` trên đúng head đã merge.
  Verify: `gh pr view <n> --json mergeCommit,statusCheckRollup`
- [ ] Bước `verify` và `review` chạy trên họ model khác với bước `ticket`
  Verify: đọc `results/` trong memory của v2: model của từng bước
- [ ] Factory v2 `run` qua ít nhất ba lần thức, có một lần do watcher. Journal có một dòng cho mỗi lần thức.
  Verify: đọc `journal.md` trong memory của v2
- [ ] Các bài học trong quá trình nghiệm thu được ghi vào wiki của v2, và mỗi chỗ sai được sửa trong skill tương ứng
  Verify: đọc `wiki/` và `git log` của nhánh nghiệm thu

## Comments

### Tiến độ 2026-11-15

- **Đạt:** `bug-fix` và `ticket` trên Claude Code (sandbox, ticket 03 và 04) và trên OMP (sandbox): todo list, kế hoạch trên ticket, `verify` và `review` trong worker mới, body PR có Merge Danger. Trên OMP, reviewer khác họ model gặp lỗi quota `USAGE_PRICING_REQUIRED` và chuyển sang `cursor/composer-2.5`. Sửa `bug-fix`: sửa trên nhánh mới, không lên trunk.
- **Đạt một phần:** Claude Code với marketplace cài thật. Marketplace thêm từ thư mục local chạy plugin thẳng từ thư mục nguồn, nên `smode` đi bước 2 (checkout) và đọc `research` từ `plugins/core`, đúng thứ tự. Bố cục `installed_plugins.json` và cache đã xác nhận, ghi vào `harness/claude-code.md`. Bước 3 (`installPath`) chỉ chạy thật với marketplace từ GitHub, tức là sau khi nhánh này được push. Marketplace, plugin và cache thử đã gỡ.
- **Chờ người dùng đồng ý:** factory v2 `once` với một ticket thật tới merge và `run` qua ba lần thức. Hai việc này cần `smode` và `factory-v2` nằm trên `main` (worktree của worker tạo từ trunk), nghĩa là phải push nhánh, mở PR và merge lên `main` trước.
