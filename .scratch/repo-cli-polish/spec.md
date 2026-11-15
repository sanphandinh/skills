# Repo CLI polish

**Status:** ready-for-agent

**Priority:** p2

## Vấn đề

Hai chỗ nhỏ của công cụ trong repo làm người mới đọc sai:

- `npm run list` in tiêu đề plugin (`software-claude (claude):`) lặp lại trước mỗi agent, thay vì một lần cho mỗi plugin như phần skill.
- Mục "Work on this repo" trong `README.md` không có `npm run index`, trong khi `npm run validate` báo lỗi "skills index is stale; run `npm run index`" mỗi khi thêm hoặc đổi tên một skill.

## Giải pháp

- `repo list` in mỗi plugin đúng một tiêu đề, rồi các skill và agent của plugin đó bên dưới. Một test của CLI giữ hành vi này.
- `README.md` liệt kê `npm run index` trong các lệnh làm việc trên repo, kèm một câu khi nào cần chạy.

## Ngoài phạm vi

- Thứ tự plugin, định dạng dòng `skill`/`agent`, và các lệnh khác của CLI không đổi.
- Không đổi `PLATFORMS.md` hay `AGENTS.md`.
