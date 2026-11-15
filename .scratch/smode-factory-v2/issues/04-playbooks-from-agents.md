# 04: Playbook mang nội dung của các agent

**What to build:** kiến thức trong các agent `planner`, `implementer`, `verifier`, `review-spec` và `review-standards` được chuyển sang `smode`, để worker nào cũng dùng được mà không cần agent definition.

- **`plan-ticket`**: khuôn kế hoạch Decisions, Change map, Interfaces, Tests, Verify (có kiểm môi trường tới được không), Door, Questions, Split. Kết thúc bằng JSON theo cùng các key như work order của factory.
- **`ticket`**: gọi `plan-ticket`, xây test-first với `tdd`, rồi tự kiểm. Phần tự kiểm gồm:
  - chạy đủ bộ test;
  - so lỗi typecheck với base;
  - so file thay đổi với plan;
  - mỗi tiêu chí một test;
  - ghi handoff mâu thuẫn và deviations.

  Sau đó chạy `verify` và `review`, rồi `pr`.
- **`verify`**: pass, fail, unverified; test xanh không phải là verdict; mỗi lúc chỉ một lệnh trên tài nguyên khan hiếm; không sửa file.
- **`review`**: chạy `code-review`. Quy tắc từng trục từ hai review agent (trích dòng spec, bỏ qua thứ linter đã bắt, dưới 400 từ, chỉ đọc) được đưa vào brief của hai trục trong **`code-review`**, để v1 cũng được hưởng.
- **Chỉ đọc** là quy tắc ghi trong playbook, không dựa vào mode nào.

Các agent của v1 giữ nguyên.

**Blocked by:** 02

**Status:** closed

**Door:** two-way

- [x] Có bốn playbook, và mỗi quy tắc trong thân của agent tương ứng đều có mặt trong playbook đó
  Verify: đặt từng thân agent trong `plugins/software-claude/agents/` cạnh playbook tương ứng, đánh dấu từng quy tắc
- [x] Brief của hai trục trong `code-review` mang quy tắc của `review-spec` và `review-standards`. Đường lùi "không có agent" vẫn còn.
  Verify: đọc mục "Spawn both sub-agents" của `code-review`
- [x] `plugins/software-claude/` và `plugins/software-omp/` không đổi
  Verify: `git diff --stat main -- plugins/software-claude plugins/software-omp` trống
- [x] Chạy `smode` với một ticket nhỏ thì đi theo `ticket`: có kế hoạch theo khuôn trước khi viết code, có báo cáo tự kiểm, và có kết quả review với hai trục tách riêng
  Verify: chạy `smode` với một ticket nhỏ trên repo sandbox, đọc kế hoạch, báo cáo và review
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** playbook `plan-ticket`, `ticket`, `verify`, `review` trong `smode`, mỗi playbook mang đủ quy tắc của agent tương ứng (đã đối chiếu từng dòng; thêm dòng "always stop before irreversible" còn thiếu ở `verify`). Brief hai trục của `code-review` có thêm "một trục", "không sửa file", "bỏ qua thứ formatter/linter/type checker đã bắt". `software-claude` và `software-omp` không đổi. Chạy thật trên sandbox `slugify` bằng Claude Code (Sonnet), ba lần:
- lần 1: không chạy `plan-ticket`, dừng trước verify và review (một phần do câu yêu cầu mơ hồ);
- lần 2: đủ luồng, verify và review trong worker mới, body PR có Merge Danger; nhưng báo "plan shown above" mà không có kế hoạch nào → sửa playbook: kế hoạch ghi lên ticket dưới `## Comments`;
- lần 3: kế hoạch đủ 8 mục nằm trên ticket trước code, `tdd` qua Skill tool, 6/6 test; worker con bị từ chối shell (giới hạn quyền của `claude -p` trong môi trường thử) và coordinator báo đúng là không có verdict.
Chạy riêng `review` (bypass quyền trên sandbox): hai báo cáo Spec và Standards tách riêng, có bảng severity/kind, kiểm ràng buộc, verdict `pass`, bắt được ghi chú tab/xuống dòng bị xoá.
**Interfaces introduced:** khoá JSON kết quả giữ như work order của v1 (`plan`, `door`, `files_to_change`, `files_not_to_touch`, `questions`; `head_sha`, `pr_title`, `pr_body`, `handoff`, `deviations`; `verdict`, `criteria`, `evidence`, `findings`).
**Deviations from spec:** không.
**Decisions:** bước 7 của `ticket` cho worker của factory dừng trước verify/review/PR; `harness/claude-code.md` dùng `general-purpose` cho worker chỉ đọc mà cần chạy lệnh, vì `Explore` có thể bị từ chối shell.
**Gotchas:** model hay "tự làm cho nhanh" thay vì chạy skill được nhắc tên; quy tắc Deviations làm việc đó lộ ra nhưng không ngăn được. Lời báo cáo có thể sai ("đã làm") nếu bước không để lại artifact; ưu tiên bước có artifact kiểm được.
**For the next ticket:** 03: `feature` và `bug-fix` gọi `plan-ticket`, `verify`, `review` bằng mẫu "the `x` playbook". 07: work order của v2 dùng bước 7 của `ticket` và khoá JSON ở trên.
**Links:** commit `12fb466` và hai commit sửa sau đó
