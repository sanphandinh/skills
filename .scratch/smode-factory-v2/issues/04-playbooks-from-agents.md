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

**Status:** ready-for-agent

**Door:** two-way

- [ ] Có bốn playbook, và mỗi quy tắc trong thân của agent tương ứng đều có mặt trong playbook đó
  Verify: đặt từng thân agent trong `plugins/software-claude/agents/` cạnh playbook tương ứng, đánh dấu từng quy tắc
- [ ] Brief của hai trục trong `code-review` mang quy tắc của `review-spec` và `review-standards`. Đường lùi "không có agent" vẫn còn.
  Verify: đọc mục "Spawn both sub-agents" của `code-review`
- [ ] `plugins/software-claude/` và `plugins/software-omp/` không đổi
  Verify: `git diff --stat main -- plugins/software-claude plugins/software-omp` trống
- [ ] Chạy `smode` với một ticket nhỏ thì đi theo `ticket`: có kế hoạch theo khuôn trước khi viết code, có báo cáo tự kiểm, và có kết quả review với hai trục tách riêng
  Verify: chạy `smode` với một ticket nhỏ trên repo sandbox, đọc kế hoạch, báo cáo và review
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
