# 01: `repo list` in một tiêu đề cho mỗi plugin

**What to build:** `npm run list` in tiêu đề `<plugin> (<platform>):` đúng một lần cho mỗi plugin. Các agent nằm dưới tiêu đề của plugin mình, như các skill. Hiện tại mỗi agent kéo theo một tiêu đề riêng, nên `software-claude (claude):` xuất hiện năm lần.

**Blocked by:** none

**Status:** ready-for-agent

**Door:** two-way

- [ ] Mỗi tiêu đề plugin xuất hiện đúng một lần trong output của `repo list`
  Verify: `node cli/repo.mjs list | grep -c '^software-claude (claude):'` in ra `1`, và `node cli/repo.mjs list | grep -c '^software-omp (omp):'` in ra `1`
- [ ] Dưới mỗi tiêu đề vẫn có đủ skill và agent như trước, cùng định dạng dòng `  skill  <name>` và `  agent  <name>`
  Verify: so `node cli/repo.mjs list | grep -E '^  (skill|agent) ' | sort` trước và sau thay đổi: giống nhau
- [ ] Một test trong `cli/repo.test.mjs` hỏng với code cũ và pass với code mới
  Verify: `npm test`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments
