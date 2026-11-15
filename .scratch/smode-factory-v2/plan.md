# Kế hoạch: `smode` và factory v2

**Đã chuyển thành [spec.md](spec.md) và [issues/](issues/) (10 ticket). Hai file đó thay thế plan này.** Plan giữ lại làm lịch sử của các quyết định.

## 1. Mục tiêu

- **`smode`**: một skill tổng, người dùng gọi. Nó đọc yêu cầu, chọn một playbook ngắn cho đúng tình huống, rồi gọi các skill sẵn có trong `core` và `software` theo từng bước. Cấu trúc học theo `poteto-mode` của pstack (cursor/plugins, MIT).
- **Factory v2**: kế thừa factory v1 (ADR-0002) nhưng dựng trên `smode`:
  - mỗi bước của worker là một playbook của `smode`, không còn role agent;
  - model được chọn lúc giao việc, theo role và theo quota;
  - lõi không phụ thuộc nền tảng nào.
- **T3 Code chỉ là một reference**, cùng cấp với OMP và Orca. Playbook, skill và lõi của factory v2 không nhắc tới T3. Mọi chi tiết riêng của T3 nằm trong `smode/harness/t3.md` và `factory-v2/references/t3.md`.
- **OMP vẫn được hỗ trợ đầy đủ** làm harness, với role mapping sẵn có (`templates/roles.omp-config.yml`) và các rule trong `software-omp`.
- **Factory v1 giữ nguyên**, kể cả `software-claude`, `software-omp` và `references/orca.md`. v1 vẫn cần các agent đó.

Hai lớp, theo cách repo đang dùng:

- **Harness:** agent đang chạy session, ví dụ Claude Code, Codex, OMP, hay một session bên trong T3. `smode` ánh xạ hành động sang tool của harness trong `smode/harness/<tên>.md`.
- **Agent manager:** thứ tạo workspace, chạy worker, đánh thức coordinator. Hiện có Orca, và thêm T3. Factory ánh xạ 10 thao tác của `INTERFACE.md` trong `references/<tên>.md`.

## 2. Những gì đã chốt trong thảo luận

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Agent definition | v2 không dùng role agent. Bên giao việc chọn model. | Factory đã giao việc theo từng bước. Agent chỉ còn là lớp đổi model, lại phụ thuộc nền tảng và lỗi thời khi đổi provider. |
| Kiến thức của agent | Chuyển thành playbook của `smode`: `plan-ticket` từ `planner`, `verify` từ `verifier`, phần tự kiểm của `implementer` vào playbook `ticket`, quy tắc từng trục review vào `code-review`. | Không tạo skill mới, giữ nguyên tắc "Few and precise". |
| Skill gọi nhau trên nhiều provider | `smode` quy tên skill ra đường dẫn và đọc `SKILL.md`, như pstack làm với `../<name>/SKILL.md`. Việc kích hoạt theo ngữ cảnh nằm ở bảng trigger của `smode`. | T3 không thống nhất việc nạp skill. Mỗi provider có chỗ đọc riêng. |
| Model theo role | Mỗi máy có một file cấu hình role → model theo harness, do playbook `setup` của `smode` ghi (học `setup-pstack`). Trên OMP dùng lại role mapping của `.omp/config.yml`. Trong reference T3, mỗi role là danh sách `provider/model` theo thứ tự. | Đúng ba lớp skill → role → model của repo. Không ghi model cụ thể vào skill. |
| Manager của v2 | Lõi trung lập qua `INTERFACE.md`. Ra mắt chỉ với reference T3. Orca cho v2 là một spec sau. Trong thời gian đó, v1 vẫn chạy trên Orca. | Thêm manager chỉ tốn một file reference cộng smoke test, theo ADR-0002. |
| Quota | Khái niệm chung trong lõi: route bỏ qua ứng viên hết quota. Worker thất bại vì quota thì route đó bị chặn đến lúc reset, và bước được chạy lại trên ứng viên kế tiếp. Ghi vào `quota.md` trong memory. Cách đọc quota và giờ reset của từng manager nằm trong reference. | Provider nào cũng có giới hạn. T3 có theo dõi quota nhưng chưa đưa cho agent (`OrchestratorMcpService.ts:409`). |
| Riêng reference T3 | Mỗi bước là một `delegate_task` mới (`isolation:"worktree"`). Thức dậy bằng thread watcher dùng `schedule_task` (`fresh_session`, role scout), thread này chạy fingerprint rồi gửi `once` cho coordinator. Worker xong, worker hỏi và `watch_pull_request` thì tự đánh thức coordinator. | Hướng dẫn T3 chèn vào session yêu cầu mỗi re-check là một `delegate_task` mới. Scheduler của T3 không có precheck (`contracts/src/scheduledTask.ts`). |

## 3. Thiết kế `smode`

### 3.1 Vị trí và cấu trúc

```
plugins/software/skills/smode/
  SKILL.md               ~150 dòng
  playbooks/<tên>.md     mỗi file 10–30 dòng
  harness/<harness>.md   claude-code, codex, omp, t3
  skills-index.md        tên skill → đường dẫn trong repo (sinh tự động, validator kiểm)
  agents/openai.yaml     allow_implicit_invocation: false
```

`disable-model-invocation: true`. Người dùng gọi `smode <yêu cầu>`.

### 3.2 Các phần của `SKILL.md`

1. **Mở đầu nhiệm vụ.** Nói lại mục tiêu của người dùng và thay đổi nhỏ nhất dự kiến. Nếu bằng chứng loại trừ yêu cầu thì dừng lại và chỉ ra.
2. **Bảng trigger.** Gặp tình huống nào thì dùng skill nào:
   - kế hoạch chưa rõ: `grilling`;
   - thuật ngữ: `domain-modeling`;
   - thiết kế module: `codebase-design`;
   - viết code: `tdd`;
   - bug: `diagnosing-bugs`;
   - body PR: `pr`;
   - viết skill hoặc `AGENTS.md`: `writing-for-agents`;
   - cần dữ kiện: `research`;
   - bước chỉ người làm được: `wizard`;
   - câu hỏi kiểm được bằng thử nghiệm: `prototype` thay vì hỏi người.
3. **Chạy một skill theo tên.** Dùng cách gọi gốc nếu harness đã nạp skill đó. Không thì đọc `SKILL.md` của nó, theo thứ tự:
   1. bản checkout của repo;
   2. `installPath` của plugin trong file plugin đã cài của harness;
   3. bản sao marketplace.

   `skills-index.md` cho biết skill thuộc plugin nào. Vị trí cụ thể của từng harness nằm trong `harness/` (S1). Cách này chạy được cả với skill chỉ người dùng gọi như `implement`, `to-tickets`, vì đọc file thì không bị tool Skill từ chối.
4. **Autonomy.** Việc đảo ngược được thì tự làm. Luôn dừng trước force-push nhánh chung, deploy, xoá dữ liệu, nhắn khách hàng.
5. **Giao việc.**
   - Mỗi việc mới là một worker mới, nhận đủ brief, các chỉ thị sau đó, và báo cáo cùng nhánh của worker trước.
   - Model lấy theo role từ file cấu hình. Reviewer và verifier phải khác họ model với người viết code.
   - Brief trỏ tới đường dẫn tuyệt đối của `smode/SKILL.md` và tên playbook. Không cần agent definition: harness doc nói cách sinh worker trên từng nơi.
6. **Viết trả lời.** Ngôn ngữ theo `docs/agents/response-language.md`. Mỗi khẳng định kèm bằng chứng hoặc nhãn "đo được", "suy ra", "đoán".
7. **Mục lục playbook.** Tình huống nào mở file nào. Khi chạy, chép nguyên các bước vào todo list. Bước bỏ qua vẫn giữ trong list kèm `skip: <lý do>`.

### 3.3 Danh sách playbook ban đầu

| Playbook | Khi nào | Các skill nó gọi |
|---|---|---|
| `investigation` | câu hỏi chỉ đọc | `research`, `codebase-design` (từ vựng) |
| `bug-fix` | lỗi cần tái hiện và sửa | `diagnosing-bugs`, `tdd`, `verify`, `review`, `pr` |
| `feature` | hành vi mới | `grilling` (khi chưa rõ), `prototype`, `plan-ticket`, `tdd`, `verify`, `review`, `pr` |
| `refactor` | đổi cấu trúc, giữ hành vi | `codebase-design`, `improve-codebase-architecture`, `tdd`, `review` |
| `prototype` | quyết định bằng code nháp | `prototype` |
| `spec` | từ ý tưởng tới spec và ticket | `grill-with-docs`, `to-spec`, `to-tickets` (`wayfinder` khi quá lớn) |
| `plan-ticket` | lập kế hoạch một ticket trước khi viết code | nội dung lấy từ agent `planner` |
| `ticket` | làm một ticket | `plan-ticket`, `tdd`, tự kiểm (từ agent `implementer`), `verify`, `review`, `pr` |
| `spec-run` | làm cả một spec | `implement-spec` |
| `verify` | chứng minh thay đổi chạy trên sản phẩm thật | nội dung lấy từ agent `verifier`, `docs/agents/verify.md` |
| `review` | review độc lập | `code-review` |
| `triage` | issue mới | `triage` |
| `pickup` | nhận lại việc dở | `handoff` |
| `retro` | rút kinh nghiệm cuối phiên | `retro` |
| `setup` | chuẩn bị project và máy | `setup-software-context`, `setup-verification`, file cấu hình role |
| `factory` | chạy nhà máy | chuyển sang skill factory v2 |

### 3.4 Role và file cấu hình

- `ROLES.md` thêm role cho `smode`: `scout`, `worker`, `thinker`, `reviewer`, `coordinator`. Mỗi role mô tả đặc tính cần có, không ghi tên model. Thêm quy tắc "reviewer khác họ model với worker".
- Playbook `setup` ghi file cấu hình **theo máy**:
  - Claude Code: `~/.claude/rules/smode-roles.md`, được nạp vào mọi session.
  - OMP: role mapping trong config **của user** (đã có `templates/roles.omp-config.yml`). Role mới của `smode` được thêm vào template đó, không tạo file riêng. Phải ở config của user, vì OMP chỉ duyệt model truyền theo lần gọi khi model đó là giá trị của một role do user cấu hình (S6). Worker sinh từ agent đóng gói `task`, `scout` hoặc `reviewer`.
  - Codex: vị trí tương đương cần kiểm (spike S1).
  - T3: route nằm trong file của harness đang chạy coordinator, mỗi role một danh sách `providerInstanceId/model effort` theo thứ tự. Cách viết route mô tả trong `harness/t3.md`.
- Mỗi lần chạy setup thì ghi đè cả file, để chạy lại an toàn.

### 3.5 Harness docs

Mỗi file là một bảng ánh xạ từ hành động trung lập sang tool của nơi đó, theo kiểu `docs/harness/claude-code.md` của pstack. Các hành động:

- sinh worker;
- worker chỉ đọc;
- worktree riêng;
- chọn model và effort;
- hỏi người;
- lên lịch;
- theo dõi PR;
- tính năng không có thì ghi `Skipped in <harness>: …` rồi làm tiếp.

Chỉ file trong `harness/` được nhắc tên tool. Các playbook vẫn giữ quy tắc "Never name an agent's tools".

## 4. Thiết kế factory v2

### 4.1 Vị trí

Skill mới **`factory-v2`** trong plugin `factory`, nằm cạnh `factory`. v1 không bị sửa một dòng nào.

### 4.2 Kế thừa gì từ v1, đổi gì

| Phần | v1 | v2 |
|---|---|---|
| `PLAYBOOK.md`: ticket chain, merge guard, stop the line, humans, limits | có | **giữ nguyên nội dung**, chép sang và chỉnh |
| `MEMORY.md`: journal, wiki, results | có | giữ, thêm `quota.md` và `providers.md` |
| `INTERFACE.md`: 10 thao tác | có | giữ. wait-events trên T3 là "event đến dưới dạng turn mới". Thêm quy tắc một coordinator cố định. |
| `WORK-ORDERS.md` | dòng delegation gọi role agent | phần chung giữ. Phần riêng cho từng role đổi thành "đọc `<abs>/smode/SKILL.md`, chạy playbook `plan-ticket`, `ticket`, `verify` hoặc `review`". Kết quả JSON giữ nguyên. |
| Chọn model | `--model @smol`, rồi role agent | **Routing (lõi):** coordinator chọn model theo role, chỉ trong các ứng viên đã qua kiểm tra (`providers.md`), đang dùng được theo manager và còn quota. Start-worker nhận thêm tham số model. |
| Manager | `references/orca.md` | Chỉ `references/t3.md` lúc ra mắt |
| Thức dậy | Orca automation có precheck | schedule-wakes theo reference. Với T3 là watcher (mục 2). |
| Cấu hình project | `docs/agents/factory.md` | **`docs/agents/factory-v2.md`**, cùng khuôn, cộng `Manager: <reference>` và trỏ tới file route |
| Harness của coordinator và worker | OMP (`Agent: omp`) | Các provider trong T3 ở spec này. OMP làm worker hoặc coordinator của v2 để sau. |
| Memory | `~/.local/share/factory/<repo>` | `~/.local/share/factory-v2/<repo>`. Có thể nhập wiki từ v1 khi setup. |
| Verdict statuses | `factory/verify`, `factory/review` | **giữ nguyên tên**, để `merge-policy.md` và branch protection không đổi |
| Setup smoke test | 7 bước trên Orca | 7 bước trên T3, cộng **kiểm tra từng provider** (đọc skill qua đường dẫn, hỏi coordinator, push `HEAD:<branch>`, ghi kết quả, có bị hỏi duyệt không) |

Một repo chỉ chạy một coordinator: setup của v2 từ chối khi automation của v1 đang bật trên cùng repo, và ngược lại.

### 4.3 Nội dung riêng của `references/t3.md` (không đưa vào lõi)

- Worktree của worker tạo từ commit HEAD của checkout coordinator. Phải fetch và fast-forward trunk trước mỗi lần giao việc.
- Nhánh tạm `t3/<uuid>` bị T3 đổi tên ở nền. Worker push bằng `HEAD:factory/<n>-<slug>`. Nên đặt prefix tĩnh.
- Task thuộc về thread cha. Coordinator là một thread cố định, id ghi trong memory index.
- Yêu cầu duyệt quyền không được chuyển cho coordinator. Worker chạy `full-access` hoặc `auto`. fx không có Full access. Antigravity vẫn có thể hỏi duyệt.
- T3 không có tool xoá worktree. Dùng `git worktree remove` sau push check, archive thread, và bật chính sách tự dọn worktree.
- Mỗi lần coordinator thức xong, điện thoại nhận một thông báo "finished". Cần thử snooze.
- Theo spike S3 và S4:
  - Brief luôn ghi đường dẫn tuyệt đối tới skill và file kết quả. Khi tool file của provider từ chối đường dẫn ngoài workspace (Antigravity), đọc và ghi bằng shell.
  - Không dùng `interactionMode: "plan"` cho bước chỉ đọc. Nó chặn không nhất quán, và trên Cursor còn chặn luôn việc ghi file kết quả JSON.
  - Có provider không có tool hỏi trong child (Cursor). `providers.md` ghi provider nào hỏi được. Provider không hỏi được thì đi đường lùi sẵn có: báo `failed` kèm `questions`, coordinator hold ticket.
  - Antigravity có thể ghi ra ngoài worktree. Smoke test kiểm `pwd` và `git status` của worker.
  - Lỗi quota chỉ đọc được qua câu báo lỗi (S5).

## 5. Spike (chạy trước khi chốt spec)

| # | Câu hỏi | Ảnh hưởng tới |
|---|---|---|
| S1 | Mỗi harness (Claude, Codex, omp) đặt file plugin đã cài ở đâu? Từ `smode/SKILL.md` có lần ra được `SKILL.md` của skill nằm ở **plugin khác** (`core`) không? | **Xong**, xem `research/s1-skill-paths.md`. Đường dẫn tương đối chỉ đúng trong cùng plugin. Dùng `skills-index.md` (skill → plugin) với thứ tự tìm: cách gọi gốc, bản checkout, `installPath` của plugin đã cài, bản sao marketplace. `smode` vẫn nằm trong `software`. |
| S2 | Thread watcher của T3 có `t3_thread_send` được vào thread coordinator, và kiểm được hàng đợi bằng `t3_queue` không? | **Xong** (`research/s2-s5-s6.md`). Được: gửi vào thread rảnh thì mở lượt chạy, gửi khi bận thì vào hàng đợi, và `t3_queue list` thấy tin đang chờ. Lịch thật sẽ thử trong smoke test. |
| S3 | Worker trên Cursor và Antigravity có đọc được `SKILL.md` ngoài workspace và ghi được vào thư mục memory không? | **Xong** (`research/s3-s4-providers.md`). Cả hai đọc và ghi được. Antigravity phải dùng shell, vì tool file bị chặn ngoài workspace. Không provider nào nạp sẵn skill của repo. Cursor trong child **không hỏi coordinator được**, Antigravity thì được. |
| S4 | `interactionMode: "plan"` có chặn sửa file trên Claude, Cursor và Antigravity không? | **Xong.** Không nhất quán: Cursor chặn (trừ `.md`), Antigravity không chặn, Claude chưa rõ. **Không dùng plan mode.** Chỉ đọc giữ là ràng buộc bằng lời. |
| S5 | Task mở qua `delegate_task` báo lỗi quota thế nào (có `resetAt` không)? | **Xong.** Bên trong T3 có `class: usage_limit` và `resetAt`, nhưng qua MCP agent chỉ thấy câu báo lỗi. Coordinator đọc chữ để phân loại và lấy giờ reset. Không có giờ thì chặn 1 giờ. |
| S6 | Trên OMP, có sinh được worker chung với model theo role (`@<role>`) mà không cần agent definition không? Có làm được qua `task` dựng sẵn không? | **Xong.** Được, qua agent đóng gói `task`, `scout` hoặc `reviewer`. `model` theo lần gọi phải là `provider/model` chính xác (không nhận `@role`), và phải là giá trị của một role trong **config của user**. `smode` không cần agent của `software-omp`. |

## 6. Thứ tự ticket dự kiến

1. **ADR-0003**: `smode` và factory v2, cách quy tên skill ra đường dẫn, model chọn lúc giao việc. Sửa nguyên tắc trong `AGENTS.md` cho phép `harness/` nhắc tên tool.
2. ~~**Spike S1–S6**~~ **Xong** trong giai đoạn lập kế hoạch. Kết quả nằm trong `research/`: `s1-skill-paths.md`, `s2-s5-s6.md`, `s3-s4-providers.md`. Ticket này bỏ khỏi spec.
3. **Khung `smode`**: `SKILL.md`, `harness/claude-code.md`, `harness/omp.md`, `skills-index.md`. Lệnh `cli/repo.mjs` sinh index, validator kiểm mọi skill playbook nhắc tới đều tồn tại và index không cũ. Bị chặn bởi: 1.
4. **Playbook đợt 1**: `investigation`, `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `spec-run`, `triage`, `pickup`, `retro`. Bị chặn bởi: 3.
5. **Playbook mang nội dung agent**: `plan-ticket`, `ticket`, `verify`, `review`. Gộp quy tắc từng trục review vào `code-review` (có lợi cho cả v1). Bị chặn bởi: 3.
6. **Role và setup**: role mới trong `ROLES.md`, playbook `setup` ghi file cấu hình cho Claude Code và cập nhật `templates/roles.omp-config.yml` cho OMP, validator cho frontmatter của `ROLES.md`. Bị chặn bởi: 3.
7. **`harness/t3.md`, `harness/codex.md`**. Bị chặn bởi: 3.
8. **Lõi `factory-v2`**: chép v1, đổi work order sang playbook, thêm routing và quota, `docs/agents/factory-v2.md`, memory riêng, smoke test có bước kiểm từng provider. Không nhắc tới manager cụ thể nào. Bị chặn bởi: 5, 6.
9. **`factory-v2/references/t3.md`**: 10 thao tác, watcher, bẫy ở mục 4.3. Bị chặn bởi: 7, 8.
10. **Nghiệm thu**:
    - `smode` chạy tay một `bug-fix` và một `ticket`, trên Claude Code và trên OMP;
    - setup và smoke test v2 trên repo này, sau đó `once` với một ticket thật, rồi `run` ngắn với một spec nhỏ, trên T3.

    Bị chặn bởi: 9.
11. **Tài liệu và phát hành**: `README.md`, `PLATFORMS.md` (bảng harness và bảng manager), phần "Current contents" của `AGENTS.md`, `catalog.yaml`, ba marketplace, credit pstack trong `UPSTREAM.md` (Other sources, MIT), nâng version plugin `software` và `factory`. Bị chặn bởi: 4, 10.

## 7. Ngoài phạm vi

- Xoá agent trong `software-claude` và `software-omp`, hoặc gỡ factory v1. Để một spec sau, khi v2 đã thay được v1.
- Skill principle, `swarm`, `arena`, `interrogate` của pstack.
- Plugin riêng cho Cursor và Antigravity.
- PR gửi upstream cho t3code để đưa quota vào `orchestrator_capabilities`.
- `factory-v2/references/orca.md`, và OMP làm worker hoặc coordinator của v2. Để một spec sau. v1 vẫn phục vụ Orca với OMP.
- Đổi hay xoá rule của `software-omp`. Các rule giữ nguyên và vẫn chạy khi harness là OMP.

## 8. Rủi ro

- **Quy tên skill ra đường dẫn qua nhiều plugin** là điểm dễ vỡ nhất (S1). Nếu không làm được thì `smode` phải nằm cùng plugin với mọi skill nó gọi.
- **Hai bản factory song song** làm tài liệu nhân đôi. Giữ v1 đóng băng, không sửa, cho tới khi gỡ.
- **`smode` lớn dần như `poteto-mode`.** Giữ `SKILL.md` dưới 200 dòng. Chi tiết nằm trong playbook.
- **Trên T3 không có chặn cứng chế độ chỉ đọc** (S4 xác nhận). Chỉ có ràng buộc bằng lời. Verdict vẫn gắn đúng `head_sha`.
- **Chi tiết T3 lọt vào lõi.** Validator kiểm rằng `PLAYBOOK.md`, `WORK-ORDERS.md` và các playbook của `smode` không nhắc tên tool T3 nào. Tên tool chỉ xuất hiện trong `harness/` và `references/`.

## 9. Cần bạn quyết khi review

1. **Đã chốt:** `smode` nằm trong plugin `software`. S1 chỉ còn trả lời cách quy tên ra đường dẫn, không đổi vị trí.
2. **Đã chốt:** tên `factory-v2`, `docs/agents/factory-v2.md` và thư mục memory riêng.
3. **Đã chốt:** danh sách playbook đợt 1 như mục 3.3.
5. **Đã chốt:** OMP trong factory v2 (worker và coordinator chạy OMP) xử lý sau. Ở spec này OMP chỉ cần chạy được `smode`.
4. ~~Ra mắt với T3 và Orca, hay chỉ T3?~~ **Đã chốt: chỉ T3 trước.** Orca cho v2 để một spec sau.
