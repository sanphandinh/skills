Status: needs-triage

# Bốn harness native, smode delegate theo harness, role chỉ cho factory

Nguồn: thảo luận ngày 2026-11-18 sau `one-factory-smode-entry`. Người dùng chốt:

- Bốn harness cần hỗ trợ: Claude Code, OpenCode, Antigravity, Cursor. Bỏ OMP. Hướng đi native, được chính hãng hỗ trợ.
- `docs/agents/roles.md` chỉ dành cho factory.
- smode delegate theo cách riêng của từng harness, chọn model và mức reasoning hợp với từng việc.

Spec xây trên branch `refactor/one-factory-smode-entry` (chưa merge).

## Research (đo ngày 2026-11-18)

Ký hiệu: **đo** là đã chạy thật trên máy này hoặc qua T3; **docs** là chỉ đọc tài liệu hoặc source.

| | Claude Code | OpenCode | Antigravity | Cursor |
|---|---|---|---|---|
| Cài đặt chính thức | Plugin marketplace (đang dùng, **đo**) | Plugin là module JS/npm, không chứa skill. Skill vào bằng thư mục hoặc mảng `skills` trong `opencode.json` (path hoặc URL catalog) (**docs**) | Plugin `.antigravity-plugin/plugin.json` gồm `skills/`, `agents/`, `rules/`, `hooks.json`; `agy plugin install <github url | path>` (**docs**) | Plugin `.cursor-plugin/plugin.json` và `.cursor-plugin/marketplace.json`; `cursor-agent plugin marketplace add`, rồi cài bằng tay qua `/plugin` (**docs**, forum) |
| Skill đọc từ | `.claude/skills`, `~/.claude/skills`, plugin | `.opencode/skills`, `.claude/skills`, `.agents/skills` và bản `~` của chúng (**docs**) | `.agents/skills`, `.gemini/skills`, `~/.gemini/config/skills`, skill trong plugin (**đo** qua T3: phiên tìm ở `.agents/skills` và `.gemini/skills`) | `.cursor/skills`, `.agents/skills`, `.claude/skills`, `.codex/skills` và bản `~` (**docs**) |
| `disable-model-invocation` | Tôn trọng (**đo**) | Tôn trọng (**docs**) | Tôn trọng (**docs**) | Tôn trọng (**đo**: `tdd`, `code-review` không có trong danh sách skill) |
| Tool tạo subagent | `Agent`: `subagent_type`, `model` (alias `opus`, `sonnet`, `haiku`, `fable`), `effort` mỗi lần gọi (**đo**) | `task`: `description`, `prompt`, `subagent_type`, `task_id`, `command`; **không có `model`** (**đo** trong binary 1.15.13) | `invoke_subagent`: `TypeName`, `Role`, `Prompt`, `Model` ∈ {`inherit`, `flash_lite`, `flash`, `pro`}, `Workspace` ∈ {`inherit`, `branch`, `share`} (**đo**) | `Task`: `description`, `prompt`, `subagent_type`, `model`, `resume`, `file_attachments` (**đo**) |
| Subagent có sẵn | `general-purpose`, `Explore` | `general`, `explore` (**đo**) | `research` (chỉ đọc, không mạng), `self` (**đo**) | `generalPurpose`, `explore`, `best-of-n-runner`, … (**đo**) |
| Đổi model mỗi lần gọi | Có, trong các model Claude (**đo**) | Không. Chỉ qua file agent `.opencode/agents/<n>.md`, `model: provider/model#variant` (**docs**) | Tool dặn "always use 'inherit' unless the user explicitly requests". Gọi thử `flash` và `pro` qua T3 đều lỗi `PlatformClient is nil` (**đo**). Không chỉnh được thinking level (**docs**) | Chỉ các slug trong `<available_subagent_models>` của phiên (qua T3 chỉ có `composer-2.5-fast`; `grok-4.7` bị từ chối). Tool dặn "Use inherit unless the user explicitly requested another listed model" (**đo**) |
| File agent có `model` | `.claude/agents/<n>.md`: alias hoặc id đầy đủ, `effort` (**docs**) | `.opencode/agents/<n>.md` (**docs**) | `.agents/agents/<n>.md`, `model` là mức `flash`/`pro` (**docs**) | `.cursor/agents/<n>.md` (đọc cả `.claude/agents/`), `model` là id, `readonly`, `is_background` (**docs**) |

Kết luận:

1. **Chỉ Claude Code cho agent tự chọn model theo việc.** Cursor và Antigravity ghi thẳng trong tool là giữ `inherit` trừ khi người dùng yêu cầu. OpenCode không có tham số đó.
2. Ở ba harness kia, model chỉ đổi qua **file agent do người dùng hoặc project định nghĩa**, tức đúng lựa chọn tường minh mà tool đòi hỏi.
3. Thứ delegation mang lại ở mọi harness là **context sạch**: một subagent chỉ đọc cho việc tìm hiểu, và một fresh subagent cho verify và review.
4. `.agents/skills` là thư mục chung mà OpenCode, Antigravity và Cursor cùng đọc.

## Problem Statement

1. smode chọn model qua 5 role và `docs/agents/roles.md`. Cơ chế này chỉ chạy được khi có T3. Trong một phiên đơn, nó tụt về model của phiên (`reviewer` trên Claude Code không có candidate nào chạy được), mà vẫn mang theo `roles.mjs`, các bước setup role, mục **Candidates** và **Migration** của mỗi harness doc, và grant key của OMP.
2. Harness doc chỉ có cho Claude Code, Codex, OMP và T3. OpenCode, Antigravity và Cursor, những harness người dùng cần, chưa có.
3. OMP (và Codex, xem câu hỏi mở) không còn nằm trong hướng đi, nhưng vẫn có manifest, marketplace, template, luật validator và harness doc.
4. Cursor và Antigravity có plugin chính thức chứa được skill. Repo chưa có manifest cho cả hai.

## Solution

- **Bốn harness, mỗi harness một doc native** trong `smode/harness/`: `claude-code.md`, `opencode.md`, `antigravity.md`, `cursor.md`. Mỗi doc gồm cách tìm skill, bảng action, và mục **Delegation**: subagent nào cho việc nào, và model chọn thế nào trên harness đó, chỉ ghi điều đã đo.
- **smode delegate theo loại việc, không theo role.** Ba loại: *tìm hiểu* (subagent chỉ đọc), *thay đổi code* (subagent general), *kiểm độc lập* (fresh subagent cho verify và review). Harness doc ánh xạ từng loại ra tool và model:
  - **Claude Code:** chọn alias và `effort` theo loại việc (tìm hiểu → `haiku`/`Explore`, low; code → `sonnet`, medium; plan, chẩn đoán, kiểm → `opus`, high).
  - **Cursor, Antigravity, OpenCode:** `inherit`. Chỉ đổi model khi project có file agent `smode-<loại việc>` mà người dùng tự định nghĩa.

  Không còn luật "reviewer khác family" trong smode.
- **Role chỉ cho factory.** `roles.md`, `roles-template.md`, `scripts/roles.mjs` và test chuyển sang skill `factory`. `factory setup` viết `roles.md`. Phần T3 của smode (`harness/t3.md`: candidate, work order cho provider khác, quota) gộp vào `factory/references/t3.md`. Playbook `setup` của smode không còn hỏi role.
- **Phân phối:**
  - **Claude Code:** plugin như hiện tại.
  - **Cursor:** thêm `.cursor-plugin/plugin.json` cho `core` và `software`, cùng `.cursor-plugin/marketplace.json`.
  - **Antigravity:** thêm `.antigravity-plugin/plugin.json` cho mỗi plugin.
  - **OpenCode:** cài skill vào `.agents/skills` (`npx skills add … -a opencode`) hoặc trỏ `skills` trong `opencode.json` tới bản clone.
  - Manifest nào chưa cài thử được thì ghi "chưa kiểm chứng" trong `PLATFORMS.md`.
- **Bỏ OMP:**
  - `harness/omp.md`;
  - `.omp-plugin/` của mỗi plugin và catalog;
  - `templates/roles.omp-config.yml`;
  - `platform: omp` trong `catalog.yaml` và luật validator về version OMP.
- **ADR-0006** ghi các quyết định trên. Nó thay phần "smode chọn model theo role" của ADR-0004 và phần OMP của ADR-0005.

## User Stories

1. Là developer dùng Claude Code, tôi muốn smode cho việc tìm hiểu chạy trên model rẻ và việc khó chạy trên model mạnh, mà không phải cấu hình gì.
2. Là developer dùng Cursor, Antigravity hay OpenCode, tôi muốn smode delegate bằng subagent có sẵn của harness, để không làm trái lời dặn của chính tool đó.
3. Là developer muốn tự chọn model trên Cursor hay OpenCode, tôi muốn định nghĩa file agent `smode-<loại việc>` cho project, để smode dùng nó.
4. Là developer chạy factory, tôi muốn `factory setup` viết `roles.md` và factory là nơi duy nhất đọc nó.
5. Là developer, tôi muốn playbook `setup` của smode không còn hỏi role.
6. Là developer dùng Cursor, tôi muốn thêm marketplace của repo này và cài `core`, `software` như plugin chính thức.
7. Là developer dùng Antigravity, tôi muốn cài plugin bằng `agy plugin install`.
8. Là developer dùng OpenCode, tôi muốn một lệnh cài skill vào `.agents/skills`.
9. Là maintainer, tôi muốn không còn file nào của OMP, để validator và tài liệu chỉ nói về bốn harness.

## Implementation Decisions

- Mục **Delegation** của `smode/SKILL.md` chỉ còn: fresh subagent cho mỗi việc mới, ba loại việc, "read-only is a rule", "you own the result", và câu "harness doc says which subagent and model". Bỏ **Model per role** và bảng role.
- Mỗi harness doc mở đầu bằng dòng **Verified** liệt kê điều đã đo và ngày đo. Điều chưa đo thì không ghi vào doc.
- `code-review`: mỗi trục một fresh subagent chỉ đọc. Không nói tới role.
- Các playbook `bug-fix`, `investigation`, `plan-ticket`, `ticket`, `verify`, `review` thay tên role bằng loại việc.
- Validator:
  - danh sách harness doc bắt buộc là bốn file trên;
  - không còn từ `scout`, `thinker`, `reviewer`, `coordinator` như tên role trong `smode/`;
  - version của các manifest `.claude-plugin`, `.cursor-plugin` và `.antigravity-plugin` khớp nhau.
- `factory` giữ nguyên năm role và `roles.md`. `PLAYBOOK.md` trỏ tới `scripts/roles.mjs` của chính nó.

## Testing Decisions

- Test của `roles.mjs` chuyển theo script sang `factory/scripts/`.
- Validator có test đỏ và xanh cho từng luật mới.
- Acceptance trên harness thật: mỗi harness một phiên, gồm ba bước:
  1. smode tự vào và chọn đúng playbook;
  2. một delegation *tìm hiểu* chạy subagent chỉ đọc;
  3. trên Claude Code, subagent chạy đúng alias đã chọn.
- Nơi chạy: Claude Code bằng `claude -p`; Cursor và Antigravity qua T3, hoặc app nếu người dùng chạy giúp; OpenCode cần nâng lên ≥ 1.18.0.

## Out of Scope

- Enforcement TDD bằng rule hay hook.
- Cách chọn model của factory (vẫn theo `roles.md` và T3).
- Đăng lên marketplace chính thức của Cursor hay Antigravity.

## Câu hỏi mở

1. **Codex:** không có trong danh sách bốn harness. Bỏ luôn không (`harness/codex.md`, `.codex-plugin/`, `.agents/plugins/marketplace.json`, `agents/openai.yaml` và luật validator về `allow_implicit_invocation`)?
2. **OpenCode:** cho phép `brew upgrade opencode` (1.15.13 lên ≥ 1.18.0) để chạy acceptance không?
3. **Cursor và Antigravity:** acceptance qua T3 (skill đọc theo đường dẫn, không nạp native) có đủ không, hay bạn sẽ cài plugin và chạy một phiên trong app thật?
