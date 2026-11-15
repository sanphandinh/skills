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

**Status:** closed

**Door:** two-way

- [x] `smode` là skill do người dùng gọi trong plugin `software`, `SKILL.md` dưới 200 dòng, Codex metadata có `allow_implicit_invocation: false`
  Verify: `wc -l` trên `SKILL.md`; đọc frontmatter và `agents/openai.yaml`
- [x] Skills index liệt kê mọi skill trong `core`, `software` và `factory`, mỗi skill kèm plugin của nó, và được sinh bằng một lệnh của `cli/repo.mjs`
  Verify: chạy lệnh sinh index, rồi `git diff --exit-code` trên file index
- [x] Validator báo lỗi khi index cũ, khi playbook nhắc một skill không tồn tại, và khi một tên tool T3 (ví dụ `delegate_task`) xuất hiện trong playbook
  Verify: `npm test` có ba test mới dùng repo fixture, mỗi test kiểm đúng câu lỗi
- [x] Trên Claude Code, ở một bản checkout của repo, `smode` trả lời một câu hỏi chỉ đọc qua `investigation`. Câu trả lời mở đầu bằng mục tiêu, và cho thấy `research` đã được đọc từ `plugins/core`.
  Verify: chạy `smode how does the factory v1 decide a ticket's next step?` trong Claude Code, đọc todo list và câu trả lời
- [x] Trên OMP, với plugin cài ở cấp user, cùng câu hỏi tìm được `research` qua `installPath` trong `~/.omp/plugins/installed_plugins.json`
  Verify: chạy cùng lệnh trong OMP (`/skill:smode …`), đọc câu trả lời và đường dẫn skill được đọc
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Handoff

**Delivered:** skill `smode` (user-invoked, `software`) với `SKILL.md` 119 dòng, playbook `investigation`, `harness/claude-code.md`, `harness/omp.md`, `skills-index.md`, Codex metadata tắt implicit invocation. `npm run index` sinh index; validator báo index cũ, skill hay playbook không tồn tại mà mode skill nhắc tới, và tên tool T3 ngoài `harness/` và `references/` (ba test mới, 16/16 pass; bỏ phần miễn trừ thì test fail). Chạy thật, câu hỏi về `yaml` v2 và `parseFrontmatter`:
- Claude Code (`claude -p --plugin-dir plugins/software`, Sonnet): lần 1 và 2 lộ lỗi (không todo list, không chạy `research`); sửa `SKILL.md` (ba việc mở đầu bắt buộc, bước có tên skill phải mở skill đó, mục Deviations) và playbook. Lần 3 đọc `plugins/core/skills/research/SKILL.md` từ bản checkout (bước 2), có danh sách bước và Deviations. Chi phí khoảng 0,16–0,21 USD mỗi lần.
- OMP (`omp -p`, Sonnet, `smode` chép ra bố cục giống plugin đã cài, ngoài repo): đọc `~/.omp/plugins/cache/plugins/sanphan-skills___core___0.4.0/skills/research/SKILL.md` (bước 3, `installPath`), chạy `research` qua `scout`, có danh sách bước và Deviations.
**Interfaces introduced:** lệnh `npm run index`; file `skills-index.md` trong một skill đánh dấu nó là mode skill; cách viết "the `<name>` skill", "the `<name>` playbook" và `playbooks/<name>.md` được validator kiểm trong mode skill.
**Deviations from spec:** model trên cả hai harness đôi khi chọn không chạy agent nền của `research` cho một câu hỏi nhỏ; quy tắc Deviations bắt nó ghi lại. Chấp nhận, vì đó là phán đoán có báo cáo.
**Decisions:** playbook chưa viết được ghi chữ thường "Not written yet" trong mục lục, không dùng mẫu mà validator kiểm. Role được mô tả ngay trong `SKILL.md`, vì `ROLES.md` không đi theo plugin khi cài.
**Gotchas:** worktree hay bản checkout chưa `npm ci` thì worker không chạy được code của repo; `-p` của Claude Code không có `TodoWrite` hiển thị, nên danh sách bước nằm trong câu trả lời. Trên Claude Code, plugin nạp bằng `--plugin-dir` có tiền tố `software:` (`/software:smode`).
**For the next ticket:** 03 và 04: dùng đúng mẫu "the `x` skill" và "the `x` playbook" để validator kiểm; khi thêm playbook thì đổi dòng "Not written yet" trong mục lục thành link `playbooks/<name>.md`. 05: `SKILL.md` nói Setup playbook ghi cấu hình role, harness doc đã ghi vị trí file. 06: thêm `harness/t3.md` và `harness/codex.md`; `SKILL.md` đã trỏ tới cả hai.
**Links:** commit `d7d345c` và hai commit sửa sau đó trên nhánh `refactor/migrate-skills-t3-factory`
