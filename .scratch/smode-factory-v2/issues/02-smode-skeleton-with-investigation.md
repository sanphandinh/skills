# 02: Khung `smode` chạy đầu cuối với playbook `investigation`

**What to build:** người dùng gọi `smode` kèm một câu hỏi chỉ đọc, trên Claude Code hoặc OMP. `smode` nói lại mục tiêu, chọn playbook `investigation`, chép các bước vào todo list, gọi `research` (skill ở plugin `core`) bằng cách tìm theo tên, rồi trả lời theo đúng quy tắc trả lời.

Ticket này dựng đủ khung để chạy được một lần đầu cuối:

- `SKILL.md`, với đủ các phần của spec. Mục lục playbook ghi cả 16 playbook; playbook nào chưa có file thì ghi "chưa có".
- `playbooks/investigation.md`.
- `harness/claude-code.md` và `harness/omp.md`, gồm đường dẫn plugin đã cài và bản sao marketplace của từng harness, cùng cách sinh worker. Trên OMP, worker sinh từ agent đóng gói kèm model theo role ở config của user.
- Skills index do `cli/repo.mjs` sinh.
- Metadata Codex tắt implicit invocation.

Validator thêm ba kiểm tra:
- index trùng với bản sinh lại;
- mọi skill mà playbook nhắc tới đều tồn tại;
- tên tool T3 không xuất hiện ngoài `harness/` và `references/`.

**Blocked by:** 01

**Status:** ready-for-agent

**Door:** two-way

- [ ] `smode` là skill do người dùng gọi trong plugin `software`, `SKILL.md` dưới 200 dòng, Codex metadata có `allow_implicit_invocation: false`
  Verify: `wc -l` trên `SKILL.md`; đọc frontmatter và `agents/openai.yaml`
- [ ] Skills index liệt kê mọi skill trong `core`, `software` và `factory`, mỗi skill kèm plugin của nó, và được sinh bằng một lệnh của `cli/repo.mjs`
  Verify: chạy lệnh sinh index, rồi `git diff --exit-code` trên file index
- [ ] Validator báo lỗi khi index cũ, khi playbook nhắc một skill không tồn tại, và khi một tên tool T3 (ví dụ `delegate_task`) xuất hiện trong playbook
  Verify: `npm test` có ba test mới dùng repo fixture, mỗi test kiểm đúng câu lỗi
- [ ] Trên Claude Code, ở một bản checkout của repo, `smode` trả lời một câu hỏi chỉ đọc qua `investigation`. Câu trả lời mở đầu bằng mục tiêu, và cho thấy `research` đã được đọc từ `plugins/core`.
  Verify: chạy `smode how does the factory v1 decide a ticket's next step?` trong Claude Code, đọc todo list và câu trả lời
- [ ] Trên OMP, với plugin cài ở cấp user, cùng câu hỏi tìm được `research` qua `installPath` trong `~/.omp/plugins/installed_plugins.json`
  Verify: chạy cùng lệnh trong OMP (`/skill:smode …`), đọc câu trả lời và đường dẫn skill được đọc
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo
