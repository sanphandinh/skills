# 05: smode là entry point

**What to build:** một yêu cầu kỹ thuật bình thường, không có `/smode`, tự vào smode. smode chọn playbook theo tín hiệu và nói ngay đã chọn gì:

- `smode` bỏ `disable-model-invocation`, `agents/openai.yaml` của nó cho phép gọi ngầm, và description nói phạm vi (mọi yêu cầu kỹ thuật phần mềm trong repo) cùng việc route tới một playbook.
- Mọi skill khác của `software`, kể cả `implement`, `implement-spec` và `factory`, có `disable-model-invocation: true` và `allow_implicit_invocation: false`. Skill của `core` giữ nguyên. Cách smode tìm skill theo tên đã đọc thẳng file, nên vẫn chạy được các skill này.
- `smode/SKILL.md` thay danh sách playbook bằng bảng **Entry playbooks** (tín hiệu, playbook, luật phân xử theo thứ tự) và bảng **Step playbooks** (`plan-ticket`, `verify`, `review`: chỉ chạy khi playbook khác hay work order gọi; `review` vẫn có dòng entry cho "review PR #N").
- Câu đầu của reply: `Playbook: <name> (<tín hiệu>)`. Khi work order đã nêu playbook thì bỏ qua route.
- Playbook mới `quick`: câu hỏi trả lời được sau vài lượt đọc, hoặc sửa đổi không đổi hành vi nhìn thấy được và không đụng test. Không todo list, không fresh worker. Nâng lên playbook đầy đủ khi vượt giới hạn, và nói ra. `bug-fix`, `feature` và `refactor` giữ luật verify và review bằng fresh worker của mình.
- Validator: (a) mọi file trong `playbooks/` xuất hiện trong đúng một trong hai bảng, và mọi playbook trong bảng có file; (b) trong `software`, chỉ `smode` được model tự gọi.

**Blocked by:** 02 (skill `factory` phải ở trong `software` trước)

**Status:** closed

**Door:** two-way

- [x] `smode/SKILL.md` không có `disable-model-invocation`; `smode/agents/openai.yaml` cho phép gọi ngầm
  Verify: `grep -n "disable-model-invocation" plugins/software/skills/smode/SKILL.md` trống; `cat plugins/software/skills/smode/agents/openai.yaml`
- [x] Mọi skill khác của `software` là user-invoked trên Claude Code và Codex
  Verify: `for d in plugins/software/skills/*/; do n=$(basename $d); [ $n = smode ] || grep -L "disable-model-invocation: true" $d/SKILL.md; done` trống; tương tự với `allow_implicit_invocation: false` trong `agents/openai.yaml`
- [x] `SKILL.md` có bảng Entry playbooks với luật phân xử, bảng Step playbooks, dòng `Playbook: <name> (<tín hiệu>)`, và luật bỏ qua route khi work order nêu playbook
  Verify: đọc `plugins/software/skills/smode/SKILL.md`
- [x] `playbooks/quick.md` có giới hạn, luật nâng cấp và phần Reply
  Verify: đọc file
- [x] Validator báo lỗi với một playbook mồ côi, một dòng bảng không có file, và một skill `software` khác `smode` cho model tự gọi
  Verify: ba cặp test mới (xanh và đỏ) trong `cli/repo.test.mjs`
- [x] `npm run index`, `npm run validate` và `npm test` pass
  Verify: chạy ba lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** `smode` tự kích hoạt (frontmatter và Codex policy); mọi skill khác của `software` là user-invoked; `SKILL.md` có luật phân xử, bảng Entry playbooks (17 dòng), bảng Step playbooks, dòng `Playbook: <name> (<tín hiệu>)` và luật bỏ route khi work order nêu playbook; playbook `quick` mới; validator kiểm entry point của plugin và mọi playbook có dòng trong mục Playbooks.
**Interfaces introduced:** `playbooks/quick.md`; hai luật validator.
**Deviations from spec:** `plan-ticket` và `verify` cũng có dòng trong bảng entry (người dùng hỏi thẳng đúng bước đó), nên luật validator là "mọi playbook có ít nhất một dòng" thay vì "đúng một bảng".
**Decisions:** các file playbook giữ nguyên chỗ để đường dẫn trong work order không đổi.
**Gotchas:** chỉ đổi kích hoạt thì chưa đủ (ticket 07).
**For the next ticket:** 06: mô tả smode trong tài liệu.
