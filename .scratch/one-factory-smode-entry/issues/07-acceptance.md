# 07: Acceptance

**What to build:** bằng chứng trên harness thật rằng cả ba quyết định chạy được sau khi merge và cài lại plugin:

- Một phiên Claude Code mới trong repo này nhận ba yêu cầu thường, không có `/smode`: một câu hỏi về code, một lỗi nhỏ, và "review PR #<n>". Mỗi yêu cầu vào smode, câu đầu nêu đúng playbook (`quick` hoặc `investigation`, `bug-fix`, `review`), và không skill nào khác của `software` tự kích hoạt trước.
- Trên T3, `factory setup override` (hoặc `setup`) chuyển settings của repo này, rồi `factory once` hoàn tất một lần thức: journal có một dòng mới, và memory vẫn là `~/.local/share/factory-v2/skills`.
- Một worker của factory nhận work order nêu playbook và không tự route sang playbook khác.
- Gỡ `factory`, `software-claude` và `software-omp` khỏi project này theo release notes.
- Hỏi người dùng có xoá `~/.claude/rules/smode-roles.md` không; chỉ xoá khi họ đồng ý.

**Blocked by:** 06

**Status:** ready-for-human

**Door:** two-way

- [ ] Ba yêu cầu trong phiên Claude Code mới đều bắt đầu bằng `Playbook: <name> (<tín hiệu>)` với đúng playbook
  Verify: chép câu đầu của ba reply vào handoff của ticket
- [ ] `factory once` trên T3 hoàn tất và journal có dòng mới với thời gian đọc từ đồng hồ
  Verify: `tail -1 ~/.local/share/factory-v2/skills/journal.md`
- [ ] File kết quả của worker có `step` và `route` đúng với work order
  Verify: `cat ~/.local/share/factory-v2/skills/results/<file mới nhất>.json`
- [ ] Project này không còn plugin `factory`, `software-claude`, `software-omp`
  Verify: `claude plugin list`; `omp plugin list`
- [ ] `~/.claude/rules/smode-roles.md` đã xoá, hoặc handoff ghi rằng người dùng chọn giữ
  Verify: `ls ~/.claude/rules/`

## Comments

### Tiến độ 2026-11-18

- **Routing của smode (một phần pass).** Ba phiên `claude -p --model sonnet --plugin-dir <worktree>/plugins`, chỉ cho đọc. Lần đầu, chỉ với description tự kích hoạt: cả ba **không** vào smode (q1 trả lời thẳng, q2 tự đọc code, q3 gọi `code-review` có sẵn của Claude Code). Sau khi thêm luật `### Entry point` vào `AGENTS.md` (và `setup-software-context`) cùng description "Use first…": cả ba gọi `software:smode`. q1: `Playbook: quick (a question a few reads answer)`; q2: `Playbook: bug-fix (a reported symptom in npm run list)`; q3 mở `playbooks/review.md` nhưng câu đầu không có dòng `Playbook:`. Không tách được thay đổi nào trong hai thay đổi là nguyên nhân.
- **smode vẫn model-invoked (người dùng chọn giữ).** Thử `disable-model-invocation: true`: phiên mới không vào smode, và khi được bảo chạy smode thì Claude Code từ chối gọi skill, luật Entry point thành vô hiệu. Đã hoàn tác.
- **Argument của smode.** `/software:smode investigation npm run list in sai số skill` mở `investigation.md` với câu đầu `Playbook: investigation (named in the arguments)`, dù tự route thì yêu cầu này vào `bug-fix`.
- **`factory once` trên T3:** chưa chạy được: worker bắt đầu từ checkout của coordinator ở gốc project, nên cần branch này merge vào `main` trước.
- **Gỡ plugin cũ:** Claude Code không cài plugin `sanphan-skills` nào. OMP còn `software-omp` 0.5.0, `factory` 0.2.1, `software` 0.8.1, `core` 0.4.0 ở user scope: chờ người dùng đồng ý gỡ và nâng cấp sau khi release.
- **`~/.claude/rules/smode-roles.md`:** còn (cùng hai bản `.bak`): chờ người dùng đồng ý xoá.
