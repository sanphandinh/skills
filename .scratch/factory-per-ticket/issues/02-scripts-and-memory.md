# 02: Script và memory

**What to build:** `plan.md` mục 3, Ticket B, với thiết kế ở mục 1.3–1.6, 1.9, 1.10. Hai script chỉ dùng built-in của Node, viết test trước, test nằm cạnh script và chạy bằng `npm test`:

- `scripts/resources.mjs`: hồ sơ `state/tickets/<n>.json` (claim, thread, worktree, nhánh, PR, task sống, `reworkRounds`, `conflictRounds`, `files_to_change`, `planCleared`, `state` cùng `parkedOn`/`waitingOn`, due, id comment đã ack), `state/status.json` (`running`/`paused`), lock `dispatcher` do người launch giữ có hạn giữ, tài nguyên `slot`/scarce/`merge` theo thứ tự toàn phần với FIFO chặn đầu hàng và gia hạn, `reclaim <ticket>` chỉ khi được gọi, `due` với năm nguồn, `check-plan` atomic, đánh thức (`running` hoặc `notifiedAt`), chặn/gỡ chặn quota trong `quota.md` giữ nguyên định dạng dòng mà `roles.mjs` đọc. Mọi lần ghi qua lock `mkdir`, lock bỏ lại bị phá theo pid và mtime.
- `scripts/comments.mjs`: `fetch --issue <n> [--pr <n>]` (chỉ đọc) và `ack <ids>`, bốn nguồn của `gh api`, id có namespace `issue:`/`review:`/`inline:`, mốc `since` là `claimedAt`, lọc tác giả theo quyền (`admin`/`maintain`/`write`, mọi phản hồi khác 200 là không tin được), bỏ comment `## Factory …` và comment của skill `triage`. `ack` ghi qua hàm cập nhật có lock của `resources.mjs`.
- `MEMORY.md`: layout mới, bảng ai ghi file nào, `.gitignore`, chỉ dispatcher commit, watermark của lessons.

**Blocked by:** 01

**Status:** ready-for-agent

**Door:** two-way

- [ ] Test của `resources.mjs` có đủ mười một trường hợp của `plan.md` mục 4 (claim chồng nhau; FIFO 2 slot và nguồn due 5 không báo khi chỉ còn 1 slot; xin sai thứ tự; gia hạn và hạn quá chỉ sinh due; nhả mà chưa đánh thức; quota song song; `check-plan` hai ticket cùng lúc và ticket park vẫn được tính; hai ticket cùng hết chờ chỉ một đi tiếp; `check-plan` không trùng với PR của chính ticket; due bị xoá khi `held`/`waiting`/`parked`; `reclaim` nhả hết)
  Verify: `node --test plugins/software/skills/factory/scripts/resources.test.mjs`; đọc tên các test
- [ ] Test của `comments.mjs` có năm trường hợp của `plan.md` mục 4 (quyền `read` trên repo public và 404 của bot; comment của factory và của `triage`; id trùng giữa các endpoint, ticket và PR khác số; comment cũ hơn `since`; `fetch` không ack), chạy trên fixture JSON, không gọi mạng
  Verify: `node --test plugins/software/skills/factory/scripts/comments.test.mjs`
- [ ] `quota.md` do `resources.mjs` ghi vẫn được `roles.mjs show` đọc đúng
  Verify: test chung trong `resources.test.mjs`
- [ ] `MEMORY.md` có bảng người ghi, `.gitignore` (`resources/`, `state/`, `evidence/`, `*.lock`, `*.tmp`, `wake-fingerprint`), dispatcher là người commit duy nhất
  Verify: đọc file
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh
