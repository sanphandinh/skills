Status: ready-for-agent

# Factory: mỗi ticket một coordinator

Nguồn: lần chạy factory thật trên `gia-pha-studio` (2026-11-26/27), `brief.md` (đã được người dùng duyệt) và `plan.md` (bản 12, verdict `approve` sau 11 vòng review độc lập; các review nằm trong `reviews/`). Spec này là bản rút gọn để build: **thiết kế chi tiết là `plan.md`**, mục 1, và mỗi ticket trỏ tới mục của nó. Chỗ nào spike (ticket 01) cho kết quả khác với `plan.md`, mục **Spike đã đổi gì** dưới đây thắng.

## Problem Statement

Thiết kế hiện tại có một coordinator dùng mãi cho cả repository. Chạy thật cho thấy bốn vấn đề:

1. Context của coordinator phình dần qua mỗi wake.
2. Wake rỗng mỗi giờ: `wake-check.sh` đánh thức khi fingerprint cũ hơn một giờ; đo được 8 wake Opus liên tiếp trong lúc board chỉ chờ một hold.
3. Mỗi bước một worktree (`isolation: "worktree"`): 4–8 worktree và 4–8 lần `pnpm install` cho một ticket; kết quả chuyển giữa các bước qua remote.
4. Lịch sử một ticket bị rải qua nhiều wake, khó đọc lại.

Ngoài ra `factory:hold` là label riêng của factory trên GitHub/GitLab, trong khi Jira và local đã hold bằng triage role `ready-for-human`.

## Solution

Watcher (lịch T3, model rẻ, mỗi lần một session mới) → dispatcher (mỗi lần chạy một thread mới, không giữ trạng thái, route `scout`) → mỗi ticket đã claim một coordinator (thread riêng trong worktree riêng, route `coordinator`, sống từ Plan tới Close) → các worker plan/build/verify‖review dùng chung worktree đó. Trạng thái chung nằm trên tracker, GitHub và memory folder; `scripts/resources.mjs` giữ claim, tài nguyên (slot, scarce resource, `merge`), due và lock; `scripts/comments.mjs` lọc comment của người.

Quyết định đã chốt (không mở lại): merge queue luôn cập nhật nhánh theo trunk và giữ `merge` khi verify và review chạy lại, có đường tắt khi nhánh đã chứa trunk; `INTERFACE.md` trung lập với manager, chi tiết T3 chỉ ở `references/t3.md`; bỏ dòng `Coordinator:`; setting mới `Max tickets` (mặc định bằng `Max workers`); comment yêu cầu sửa code của owner/collaborator không tính vào `Fix rounds`; không thêm label nào (claim nằm trong memory và một comment `## Factory claim`), `factory:hold` được thay bằng `ready-for-human`, giữ `priority:p*`.

## Spike đã đổi gì

Kết quả đầy đủ, kèm bằng chứng: `research/spike.md`.

1. **Setup script phải là `async: false`.** T3 chỉ giữ turn đầu của thread tới khi setup xong khi script setup của project có `async: false`; script tạo không có cờ đó chạy song song với worker đầu tiên. Không cần fallback "mỗi bước một worktree". `setup` kiểm cờ này và smoke test đo nó.
2. **Comment của chính tài khoản T3 không đánh thức watch PR.** Watch đánh thức khi CI đỏ hoặc xanh, khi có conflict và khi merge, nhưng không khi owner (cùng tài khoản với T3 và `gh`) comment hay review. Fallback của plan được áp dụng: fingerprint board đã có `updatedAt` của PR, nên comment mới làm dispatcher chạy; dispatcher đánh thức coordinator khi `comments.mjs fetch` thấy comment tin được chưa ack.
3. **Cleanup worktree của T3 0.1.12 khác plan.** Không còn "after the thread settles / after merging". Các luật mới: merged, inactive N ngày, settled N ngày, unchanged, keep-when. Luật "unchanged" và "inactive" có thể xoá worktree của một coordinator còn sống (đang plan, đang hold lâu). `setup` hướng dẫn đặt cleanup riêng cho project: inactive tắt, unchanged tắt, settled tắt (một coordinator cũ bị thay thế có thể settle trong khi coordinator hồi sinh vẫn dùng cùng worktree), merged bật. Revive hoặc đánh thức một coordinator mà worktree đã mất thì launch coordinator mới trên một worktree mới từ nhánh của ticket. Quét worktree của dispatcher vẫn là lưới cuối.
4. **Revive:** thread mới trên `existing_worktree` không đọc hay dừng được task của thread cũ (`task_not_found`), nhưng đọc được và dừng được worker cũ qua thread con của nó (interrupt có `stop`). Metadata của thread hồi sinh có `branch: null`: đọc nhánh bằng git. Dừng worker cũ sinh một turn mới trong thread coordinator cũ, nên bước kiểm claim ở đầu mỗi turn là bắt buộc.
5. **Snooze:** tin nhắn tới một thread đang snooze vẫn mở turn mới, nhưng gỡ luôn snooze. Coordinator tự snooze lại cuối mỗi turn, trừ khi đang flag cho người.
6. **Candidates trên Cursor:** tên option effort khác theo model (`effort` cho Claude và Grok 4.6, `reasoning_effort` cho Grok 4.7 và Gemini). Reference đọc tên option từ danh sách option của model.

## Tickets

| # | Ticket | Chờ |
|---|---|---|
| 01 | Spike và sửa lỗi nhỏ | — |
| 02 | Script và memory | 01 |
| 03 | Phần lõi: interface, dispatcher, coordinator, work orders, SKILL | 01, 02 |
| 04 | Setup, reference T3, tracker, triage, repo | 03 |

## Kiểm chứng

Sau mỗi ticket: `npm run validate` và `npm test`. Mỗi ticket qua một review độc lập (Antigravity, `gemini-4-neon`, `thought_level: high`) tới khi verdict `approve` không còn finding high hay medium. Cuối cùng chạy đầu cuối theo `plan.md` mục 4 trên repo thử `sanphandinh/factory-ticket-sandbox`; bằng chứng ghi vào `research/`.

## Out of Scope

- Sửa `docs/agents/verify.md` và khai báo `Reset keeps:` của `gia-pha-studio` (làm sau ticket 04, chỉ khi người dùng đồng ý).
- Manager khác T3.
