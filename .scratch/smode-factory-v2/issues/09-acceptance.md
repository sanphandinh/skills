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
