# S3 và S4: worker trên Cursor, Antigravity và Claude qua T3

Ngày: 2026-11-15. Cách làm: `delegate_task` với `isolation: "worktree"` từ thread lập kế hoạch. Model rẻ nhất mỗi provider: Cursor `composer-2.5`, Antigravity `gemini-3.8-flash`, Claude `claude-haiku-5-5` (effort low). Mọi kết quả dưới đây là đo được, lấy từ báo cáo của worker.

## S3: worker đọc skill, ghi kết quả, hỏi coordinator, push

| Kiểm tra | Cursor | Antigravity |
|---|---|---|
| Đọc `SKILL.md` ngoài workspace (bản cài trên OMP) | được, bằng tool đọc file | **tool `view_file` bị hook chặn** ("outside the allowed workspace directories"). Đọc bằng shell (`head`) thì được. |
| Ghi JSON vào `~/.local/share/...` | được | **`write_to_file` bị chặn** cùng lý do. Ghi bằng shell thì được. |
| Skill của repo này có sẵn không (`grilling`, `tdd`) | không. Có 42 skill khác, từ `~/.claude/skills`, `~/.agents/skills` và skill đi kèm Cursor. | không, danh sách rỗng |
| Hỏi coordinator rồi chờ trả lời | **không có tool hỏi người dùng** trong child do T3 giao | được (`ask_question`). Thread cha nhận thông báo, trả lời bằng `t3_pending_request respond`. |
| `git push --dry-run origin HEAD:refs/heads/factory/…` | được | được |
| Có lời xin quyền nào không | không | không |

## S4: `interactionMode: "plan"` có chặn ghi file không

| Provider | Kết quả |
|---|---|
| Cursor | **Chặn.** "Plan mode can only edit markdown files and canvas files." Vẫn ghi được `.md`. |
| Claude | Model tự tuân theo plan mode nên không thử ghi. Chưa biết harness có tự chặn không. |
| Antigravity | **Không chặn.** File được ghi ra, và còn ghi vào `~/.t3/userdata/attachments/` thay vì worktree (đã xoá). |

## Kết luận cho plan

1. **Không dựa vào plan mode để chặn ghi.** Ba provider cho ba kết quả khác nhau. Ở plan mode, Cursor còn chặn luôn việc ghi file kết quả JSON. Chế độ chỉ đọc giữ là ràng buộc bằng lời. Verdict gắn với `head_sha`.
2. **Đọc skill và ghi kết quả:** brief luôn ghi đường dẫn tuyệt đối. `harness/t3.md` nói rõ: khi tool file của provider từ chối đường dẫn ngoài workspace, đọc và ghi bằng shell. Cách này chạy được trên cả hai provider.
3. **Hỏi coordinator không có trên mọi provider.** Cursor trong child không có tool hỏi. Lõi của factory v2 đã có sẵn đường lùi: worker báo `failed`, ghi câu hỏi vào `questions` của kết quả, coordinator hold ticket và hỏi người. `providers.md` ghi provider nào hỏi được. Smoke test kiểm việc này cho từng provider.
4. **Antigravity có thể ghi ra ngoài worktree.** Bước smoke test cho từng provider phải kiểm thư mục làm việc (`pwd`) và `git status` của worker sau mỗi bước.
5. **Push được và không có lời xin quyền** trên cả hai provider khi chạy `full-access`.

## Dọn dẹp

- Thư mục `~/.local/share/factory-v2-spike/` đã xoá.
- File `spike-s4.txt` trong thư mục attachments đã xoá.
- Thread `spike S2: fake coordinator` đã archive.
- Không nhánh nào được push thật (chỉ chạy `--dry-run`).
