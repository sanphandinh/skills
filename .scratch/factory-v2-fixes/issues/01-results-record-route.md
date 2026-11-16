# 01: Kết quả của worker ghi route đã chạy

**What to build:** mỗi file kết quả trong `results/` của memory factory v2 ghi provider và model mà bước đó chạy trên, để người đọc kiểm được `verify` và `review` chạy trên họ model khác với bước build. Lần nghiệm thu 2026-11-16 chỉ ghi model trong `journal.md`; các file `results/*.json` không có.

- Work order của factory v2 có thêm trường `route` trong phần "Every result has", giá trị do coordinator điền sẵn từ ứng viên **Routing** đã chọn (`<providerInstanceId>/<model>`).
- `MEMORY.md` của factory v2 nói `results/` có trường đó và dùng để làm gì.

**Blocked by:** none

**Status:** closed

**Door:** two-way

- [x] Phần chung của work order yêu cầu `route` trong mọi kết quả, với giá trị coordinator điền
  Verify: `grep -n '`route`' plugins/factory/skills/factory-v2/WORK-ORDERS.md`
- [x] Mục `results/` trong `MEMORY.md` của factory v2 nhắc trường `route`
  Verify: `grep -n 'route' plugins/factory/skills/factory-v2/MEMORY.md`
- [x] Factory v1 (`plugins/factory/skills/factory/`) không đổi
  Verify: `git diff --stat origin/main -- plugins/factory/skills/factory/` rỗng
- [x] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments

## Factory plan

2026-11-16, factory-v2 planner `01 planner` (route `claudeAgent/claude-fable-5-2`). Door: `two-way`. Files to change: `plugins/factory/skills/factory-v2/WORK-ORDERS.md`, `plugins/factory/skills/factory-v2/MEMORY.md`, `plugins/factory/skills/factory-v2/PLAYBOOK.md`, `plugins/factory/.claude-plugin/plugin.json`, `plugins/factory/.codex-plugin/plugin.json`, `.omp-plugin/marketplace.json`. Files not to touch: `plugins/factory/skills/factory/**`, `plugins/factory/skills/factory-v2/references/t3.md`, `plugins/factory/skills/factory-v2/SETUP.md`, `plugins/factory/skills/factory-v2/INTERFACE.md`, `plugins/factory/skills/factory-v2/SKILL.md`, `plugins/factory/skills/factory-v2/agents/openai.yaml`, `plugins/software/skills/smode/**`, `cli/**`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `catalog.yaml`, `AGENTS.md`, `README.md`, `PLATFORMS.md`, `GLOSSARY.md`, `docs/adr/**`, `docs/agents/**`, `package-lock.json`, `.scratch/**`.

### Plan: factory-v2-fixes/01 — Kết quả của worker ghi route đã chạy

Reply language: `match-user`, không có tin nhắn trực tiếp của người dùng → dùng ngôn ngữ của ticket: **tiếng Việt**. Văn bản thêm vào các file skill giữ tiếng Anh như chính các file đó.

Mục tiêu: mọi file `results/*.json` của factory v2 ghi provider và model mà bước đó chạy, để người đọc kiểm được `verify` và `review` chạy trên họ model khác bước build. Base: `origin/main` tại `a95091c`. Ticket đứng riêng, không spec, không ticket chặn, không handoff phải đọc.

#### Decisions

1. **Data shape.** Kết quả chung có thêm `route`: một chuỗi `<provider>/<model>`, ví dụ `"claudeAgent/claude-fable-5-2"`. Không kèm options (`effort=…`). Lý do: đây đúng là khoá mà `providers.md`, `quota.md` (`MEMORY.md:11-12`) và dòng journal đang dùng, nên người đọc nối được bốn nơi bằng một chuỗi.
2. **Cách viết `<provider>/<model>`, không viết `<providerInstanceId>/<model>` trong file skill.** `providerInstanceId` là tên trường của T3; `WORK-ORDERS.md` và `MEMORY.md` là file skill dùng chung, phải trung lập với agent manager (ADR-0003, `AGENTS.md` mục "Writing a shared skill" điểm 3). Trên T3 giá trị điền vào vẫn là `<providerInstanceId>/<model>` như ticket yêu cầu, vì route file viết ứng viên như vậy (`smode/harness/t3.md`, mục Routes).
3. **Coordinator điền, worker chép.** Work order mang sẵn giá trị qua placeholder `<route>`; worker chép nguyên văn, không tự khai model của mình. Lý do: model tự nhận diện không đáng tin, còn coordinator là bên chọn ứng viên ở **Routing** và start-worker "chạy đúng model được giao hoặc fail" (`INTERFACE.md:35`).
4. **Định nghĩa `<route>` ở đoạn mở đầu `WORK-ORDERS.md`**, theo đúng mẫu đoạn đó đang định nghĩa `<smode>`. Cùng câu đó nói worker khởi động lại trên ứng viên khác (**Quota**) được điền `<route>` lại, vì `PLAYBOOK.md:76` nói "with the same work order" và nếu chép nguyên thì `route` sẽ sai.
5. **Tên trường giữ là `route`** như ticket chốt. `GLOSSARY.md` định nghĩa **Route** là danh sách ứng viên của một role; trường này giữ một ứng viên. Câu chữ thêm vào luôn nói "candidate" hoặc "the provider and model", không đổi nghĩa thuật ngữ. Không sửa `GLOSSARY.md`.
6. **Sửa một câu ở `PLAYBOOK.md:69`** (ngoài hai file ticket nêu tên, nằm trong cùng skill). Câu hiện tại bảo ghi ứng viên "in the worker's result path name", trong khi mẫu đường dẫn (`WORK-ORDERS.md:16`) và `MEMORY.md:10` ("named by ticket, role and round") không có chỗ cho model; thực tế các file kết quả tên `01-planner-1.json`. Sau ticket này nơi ghi là trường `route`; để nguyên câu cũ thì skill nói hai điều khác nhau về đúng hành vi ticket sửa. Chỉ đổi câu đó. Quy tắc 4 của Routing ("from that build's result", dòng 67) đã đúng và nay có trường để đọc: không đổi.
7. **Không thêm bước coordinator đối chiếu `route` khi nhận `done`** (`PLAYBOOK.md:131`). Giá trị do chính coordinator điền; dòng journal là bản đối chứng. Ticket không yêu cầu.
8. **Không backfill kết quả cũ.** Thư mục memory nằm ngoài repo và coordinator là người ghi duy nhất (`MEMORY.md:3`). Các file của lần nghiệm thu 2026-11-16 giữ nguyên; model của chúng nằm trong `journal.md`.
9. **Bump version plugin `factory` 0.4.0 → 0.4.1**, ở ba nơi phải khớp nhau: `plugins/factory/.claude-plugin/plugin.json`, `plugins/factory/.codex-plugin/plugin.json`, mục `factory` trong `.omp-plugin/marketplace.json`. Lý do:
   - Không có quy ước viết thành văn (`AGENTS.md`, `PLATFORMS.md` không nói khi nào bump). Validator chỉ buộc ba nơi khớp nhau và ghi rõ OMP so version này để quyết định nâng cấp (`cli/lib.mjs:280-301`). Claude Code lưu plugin đã cài theo version (`cache/sanphan-skills/<plugin>/<version>`, `smode/harness/claude-code.md`) — suy ra: không bump thì bản đã cài không nhận thay đổi.
   - Thay đổi này thêm một trường bắt buộc vào hợp đồng kết quả của worker, nên cần tới được bản đã cài.
   - Tiền lệ: `955a9ec` bump patch 0.2.0 → 0.2.1 cho một sửa chữ hai dòng trong skill. Ngược lại `132d2f5` (2026-11-16, sửa một dòng `factory-v2/MEMORY.md`) không bump; 0.4.1 mang luôn thay đổi đó tới bản đã cài.
   - Mức patch vì trường mới là bổ sung: coordinator chỉ kiểm `role` và `ticket`, kết quả cũ vẫn đọc được.
10. **Không đổi manifest nào khác.** `.claude-plugin/marketplace.json` và `.agents/plugins/marketplace.json` không mang version. Mô tả plugin, `catalog.yaml`, `AGENTS.md` (Current contents), `README.md`, `PLATFORMS.md` mô tả ở mức không nhắc tới trường của kết quả. Không thêm skill nên `skills-index.md` không đổi, không cần `npm run index`.
11. **Không thêm luật validator hay test tự động cho nội dung văn xuôi.** Validator kiểm cấu trúc, không kiểm câu chữ từng skill (`AGENTS.md`: "Few and precise").

#### Change map

Files to change:

| File | Thay đổi |
|---|---|
| `plugins/factory/skills/factory-v2/WORK-ORDERS.md` | Dòng 3: thêm một câu định nghĩa `<route>` ngay sau "…with the model **Routing** picked." Dòng 18 ("Every result has"): thêm `route` ngay sau `ticket (the number)`. |
| `plugins/factory/skills/factory-v2/MEMORY.md` | Dòng 10 (mục `results/`): nói kết quả có `route` và dùng để làm gì. |
| `plugins/factory/skills/factory-v2/PLAYBOOK.md` | Dòng 69: thay câu đầu của đoạn (xem Interfaces). Không đổi gì khác. |
| `plugins/factory/.claude-plugin/plugin.json` | `"version": "0.4.0"` → `"0.4.1"`. |
| `plugins/factory/.codex-plugin/plugin.json` | `"version": "0.4.0"` → `"0.4.1"`. |
| `.omp-plugin/marketplace.json` | Mục `factory` (dòng 28): `"version": "0.4.0"` → `"0.4.1"`. Chỉ mục `factory`. |

Files not to touch:

| File | Lý do |
|---|---|
| `plugins/factory/skills/factory/**` | Factory v1 đóng băng (ADR-0003); tiêu chí 3 của ticket. |
| `plugins/factory/skills/factory-v2/references/t3.md` | start-worker đã truyền ứng viên làm `target`; không đổi ánh xạ công cụ. |
| `plugins/factory/skills/factory-v2/SETUP.md`, `INTERFACE.md`, `SKILL.md`, `agents/openai.yaml` | Kết quả smoke test và provider check có hình dạng riêng (khoá `model`); interface mười thao tác không đổi. |
| `plugins/software/skills/smode/**` | Playbook lấy hình dạng kết quả từ work order; `skills-index.md` là file sinh ra. |
| `cli/**` | Không thêm luật; `cli/repo.test.mjs:100-101` có `"0.4.0"` là dữ liệu fixture, không phải manifest thật. |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `catalog.yaml` | Không mang version; mô tả không đổi. |
| `AGENTS.md`, `README.md`, `PLATFORMS.md`, `GLOSSARY.md`, `docs/adr/**`, `docs/agents/**` | Không mô tả tới mức trường của kết quả; thuật ngữ Route đã có. |
| `package-lock.json` | Đường dẫn được bảo vệ mặc định (`docs/agents/merge-policy.md`): một thay đổi lockfile buộc pull request chờ người. |
| `.scratch/**` | Coordinator ghi plan, handoff và đóng ticket trên trunk, không trong pull request (`docs/agents/issue-tracker.md`). |
| `~/.local/share/factory-v2/skills/**` | Memory ngoài repo, chỉ coordinator ghi; không backfill (quyết định 8). |

Ticket anh em: không có (thư mục `factory-v2-fixes` chỉ có ticket 01).

#### Interfaces

**Kết quả của worker (mọi role), trường mới:**

```
route: string   // "<provider>/<model>", ví dụ "claudeAgent/claude-fable-5-2"; không kèm options
```

**Placeholder mới trong work order:** `<route>`, coordinator thay bằng ứng viên **Routing** đã chọn cho worker đó.

**Văn bản chính xác (tiếng Anh), implementer chép nguyên:**

`WORK-ORDERS.md` dòng 3, chèn sau "…with the model **Routing** picked.":

```
`<route>` is that candidate, written `<provider>/<model>` as its line in `providers.md` spells it, without its options; a worker restarted on another candidate (**Quota**) gets `<route>` filled again.
```

`WORK-ORDERS.md` dòng 18, chèn sau "`ticket` (the number), ":

```
`route` (`<route>`: the provider and model the coordinator started this step on; copy it exactly, never your own guess),
```

`MEMORY.md` dòng 10, thay cả dòng:

```
- `results/`: every worker's result, named by ticket, role and round. Each step result carries `route`, the `<provider>/<model>` its worker was started on, spelled as in `providers.md`. Routing reads the build's `route` to keep the `verifier` and the `reviewer` on another model family, and a reader compares the three results to check that it held; the family is the model's, not the provider's.
```

`PLAYBOOK.md` dòng 69, thay câu đầu "Pass it to start-worker and record it in the worker's result path name and the journal line." bằng:

```
Pass it to start-worker, fill it into the work order as `<route>` so the result carries it (WORK-ORDERS.md), and record it in the journal line.
```

**Plugin `factory`:** version `0.4.1`.

#### Tests

Không có test tự động mới (quyết định 11). Kiểm "đỏ trước" là các lệnh dưới đây: chạy trước khi sửa để thấy trạng thái đỏ, chạy lại sau khi sửa.

| Tiêu chí | Kiểm viết trước | Trước khi sửa (đo tại `a95091c`) | Sau khi sửa |
|---|---|---|---|
| 1. Work order yêu cầu `route` | ``grep -n '`route`' plugins/factory/skills/factory-v2/WORK-ORDERS.md`` | không khớp, exit 1 | khớp đúng dòng "Every result has" |
| 1, nhánh coordinator điền | `grep -n '<route>' plugins/factory/skills/factory-v2/WORK-ORDERS.md` | không khớp | hai dòng: đoạn mở đầu và "Every result has" |
| 2. `MEMORY.md` nhắc `route` ở mục `results/` | ``grep -n 'results/.*`route`' plugins/factory/skills/factory-v2/MEMORY.md`` | không khớp, exit 1 | khớp dòng `results/` |
| 3. v1 không đổi | `git diff --stat origin/main -- plugins/factory/skills/factory/` | rỗng | rỗng |
| 4. validate và test | `npm run validate`, `npm test` | baseline theo bài học lần chạy trước: `29 skills, 10 agents, 0 issue(s)`, 20 pass (chưa đo lại ở bước này) | cùng kết quả |
| Phụ: câu cũ ở Routing đã hết | `grep -n 'result path name' plugins/factory/skills/factory-v2/PLAYBOOK.md` | khớp dòng 69 | không khớp |
| Phụ: version khớp | `grep -n '"version"' plugins/factory/.claude-plugin/plugin.json plugins/factory/.codex-plugin/plugin.json` và `grep -n -A3 '"name": "factory"' .omp-plugin/marketplace.json` | `0.4.0` ở cả ba | `0.4.1` ở cả ba; lệch nhau thì `npm run validate` báo lỗi |

Bẫy: lệnh Verify của tiêu chí 2 trong ticket (`grep -n 'route' …/MEMORY.md`) **đã pass trước khi sửa**, vì dòng `quota.md` (`MEMORY.md:12`) có chữ "route candidate". Verifier phải thấy khớp trên dòng `results/`; dùng lệnh đã siết ở bảng trên.

Nhánh lỗi: nếu `npm run validate` báo tên công cụ hay cú pháp gọi skill ở dòng mới, sửa câu chữ, không nới luật validator.

#### Verify

Theo `docs/agents/verify.md`, đường mặc định, chạy từ thư mục gốc của checkout:

1. Launch: `npm install` (worktree mới của T3 không có `node_modules/`). Sau đó `git status --short` phải sạch; không commit thay đổi nào của `package-lock.json`.
2. Doctor: năm lệnh trong mục Doctor.
3. Journey 1: `npm run validate` → exit 0, dòng cuối `29 skills, 10 agents, 0 issue(s)`.
4. Journey 2: `npm test` → exit 0, `ℹ fail 0`.
5. Journey 3: `npm run list` và hai lệnh `grep` của nó.
6. Các lệnh ở bảng Tests cho tiêu chí 1–3 và hai kiểm phụ.
7. `git diff --stat origin/main` chỉ liệt kê sáu file trong Change map.

Journey 4 (upstream) không cần: không đụng `UPSTREAM.md` hay `cli/`.

Môi trường hôm nay (đo ở bước này): Node `v26.13.0` (cần ≥ 20), npm `11.20.0`, `npm ping` tới registry trả PONG, `package-lock.json` có sẵn, `node_modules/` chưa có. Không cần fixture, tài khoản, thiết bị hay dịch vụ nào. Bằng chứng thêm, không bắt buộc: file kết quả của chính ticket này trong memory (`results/fv2fix-01-*.json`) đã mang `route` vì coordinator đang điền sẵn.

#### Door

`two-way`. Chỉ đổi văn xuôi của skill và một version patch; hoàn tác bằng một commit. Không có di trú dữ liệu: trường mới là bổ sung, kết quả cũ vẫn hợp lệ, không ai đọc `route` theo cách làm hỏng khi thiếu nó. Khớp với `Door: two-way` của ticket.

#### Questions

Không có.

#### Split

none

## Handoff

**Delivered:** Mọi kết quả của worker factory v2 có trường `route` (`<provider>/<model>`); work order định nghĩa `<route>` do coordinator điền (điền lại khi worker khởi động lại trên ứng viên khác), `MEMORY.md` mục `results/` nói trường đó dùng để kiểm họ model của verifier và reviewer. Cả bốn tiêu chí đạt: hai grep khớp, v1 không đổi, validate và test pass.
**Interfaces introduced:** trường kết quả `route` (chuỗi, không kèm options); placeholder `<route>` trong work order.
**Deviations from spec:** không có (ticket đứng riêng; không lệch plan).
**Decisions:** `route` chép nguyên từ coordinator, worker không tự khai; câu ở PLAYBOOK Routing về "result path name" đổi thành trường `route`; plugin `factory` bump 0.4.1; không backfill kết quả cũ, không thêm luật validator.
**Gotchas:** coordinator không đối chiếu `route` khi nhận `done` (journal là bản đối chứng). Kết quả cũ của lần nghiệm thu 2026-11-16 không có `route`.
**For the next ticket:** không có ticket nào bị chặn bởi ticket này.
**Links:** pull request https://github.com/sanphandinh/skills/pull/18, merge commit `a1d4b9351c1884c384ef434dbad06f837db83aae`, verify PASS https://github.com/sanphandinh/skills/pull/18#issuecomment-6903878140, review pass with one note (blast radius `docs` changed to `low` in the PR body) https://github.com/sanphandinh/skills/pull/18#issuecomment-6903887432 (both on `c7f6d17`)
