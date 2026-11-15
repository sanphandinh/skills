# 02: README có `npm run index`

**What to build:** mục "Work on this repo" trong `README.md` liệt kê `npm run index` cùng các lệnh khác, và một câu nói khi nào chạy nó: sau khi thêm, xoá hoặc đổi tên một skill, khi `npm run validate` báo skills index đã cũ.

**Blocked by:** none

**Status:** ready-for-agent

**Door:** two-way

- [ ] `README.md` có lệnh `npm run index` trong khối lệnh của mục "Work on this repo"
  Verify: `grep -n 'npm run index' README.md`
- [ ] README nói khi nào cần chạy lệnh đó, khớp với câu lỗi của validator
  Verify: đọc mục "Work on this repo", đối chiếu với câu "skills index is stale; run `npm run index`" trong `cli/lib.mjs`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments
