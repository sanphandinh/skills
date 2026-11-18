Status: closed

# Bốn harness native, smode không delegate, delegation chỉ ở factory

Nguồn: thảo luận ngày 2026-11-18 sau `one-factory-smode-entry`. Người dùng chốt:

- Bốn harness: Claude Code, OpenCode, Antigravity, Cursor. Bỏ OMP và Codex. Hướng đi native, được chính hãng hỗ trợ.
- smode không delegate. Delegation, role và chọn model chỉ có ở factory.
- Skill nào bản chất dùng sub-agent (`implement-spec`, `code-review`, `research`, `wayfinder`, `improve-codebase-architecture`) vẫn dùng, với sub-agent mặc định của harness và model của phiên, không chọn model.
- OpenCode được nâng lên ≥ 1.18.0 để chạy acceptance. Cursor và Antigravity chạy acceptance qua T3.

Spec xây trên branch `refactor/one-factory-smode-entry` (chưa merge).

## Research (đo ngày 2026-11-18)

Ký hiệu: **đo** là đã chạy thật trên máy này hoặc qua T3; **docs** là chỉ đọc tài liệu hoặc source.

| | Claude Code | OpenCode | Antigravity | Cursor |
|---|---|---|---|---|
| Cài đặt chính thức | Plugin marketplace (**đo**) | Plugin là module JS/npm, không chứa skill. Skill vào bằng thư mục hoặc mảng `skills` trong `opencode.json` (**docs**) | Plugin `.antigravity-plugin/plugin.json` gồm `skills/`, `agents/`, `rules/`, `hooks.json`; `agy plugin install <github url | path>`, `agy plugin validate` (**docs**) | Plugin `.cursor-plugin/plugin.json` và `.cursor-plugin/marketplace.json`; `cursor-agent plugin marketplace add`, rồi cài bằng tay qua `/plugin` (**docs**, forum) |
| Skill đọc từ | `.claude/skills`, `~/.claude/skills`, plugin | `.opencode/skills`, `.claude/skills`, `.agents/skills` và bản `~` (**docs**) | `.agents/skills`, `.gemini/skills`, `~/.gemini/config/skills`, plugin (**đo** qua T3: phiên tìm ở `.agents/skills`, `.gemini/skills`) | `.cursor/skills`, `.agents/skills`, `.claude/skills`, `.codex/skills` và bản `~` (**docs**) |
| `disable-model-invocation` | Tôn trọng (**đo**) | Tôn trọng (**docs**) | Tôn trọng (**docs**) | Tôn trọng (**đo**) |
| Tool tạo sub-agent | `Agent` (`subagent_type`, `model`, `effort`) (**đo**) | `task` (`description`, `prompt`, `subagent_type`, `task_id`, `command`), không có `model` (**đo**, binary 1.15.13) | `invoke_subagent` (`TypeName`, `Role`, `Prompt`, `Model`, `Workspace`) (**đo**) | `Task` (`description`, `prompt`, `subagent_type`, `model`, `resume`, `file_attachments`) (**đo**) |
| Sub-agent có sẵn | `general-purpose`, `Explore` | `general`, `explore` (**đo**) | `research` (chỉ đọc), `self` (**đo**) | `generalPurpose`, `explore`, … (**đo**) |
| Tool tự dặn về model | Không | Không có tham số | "always use 'inherit' unless the user explicitly requests"; `flash`, `pro` qua T3 lỗi `PlatformClient is nil` (**đo**) | "Use inherit unless the user explicitly requested another listed model"; chỉ slug trong `<available_subagent_models>` (**đo**) |

Kết luận: chỉ Claude Code cho agent tự chọn model theo việc. Trong một phiên, delegation chỉ còn mang lại context sạch, và đổi lại là thêm độ phức tạp. Việc chọn model thật sự có ích ở nơi có coordinator gọi nhiều provider: factory trên T3.

## Problem Statement

1. smode delegate qua 5 role và `docs/agents/roles.md`. Cơ chế này chỉ chạy đúng khi có T3, nhưng vẫn kéo theo `roles.mjs`, các bước setup role, mục **Candidates** và **Migration** của mỗi harness doc, grant key của OMP, và các luật "fresh worker" trong playbook.
2. Harness doc chỉ có cho Claude Code, Codex, OMP và T3. OpenCode, Antigravity và Cursor chưa có.
3. OMP và Codex không còn nằm trong hướng đi, nhưng vẫn có manifest, marketplace, `agents/openai.yaml`, template, luật validator và harness doc.
4. Cursor và Antigravity có plugin chính thức chứa được skill, nhưng repo chưa có manifest cho cả hai.

## Solution

- **smode làm việc một mình.**
  - Không spawn worker, không chọn model, không còn mục **Delegation** và bảng role.
  - Playbook chạy `verify` và `review` như các bước riêng trong cùng phiên: đọc lại diff từ đầu và kiểm theo ticket, không theo trí nhớ về lúc viết code.
  - Skill có sub-agent theo thiết kế vẫn chạy chúng trên sub-agent mặc định của harness và model của phiên.
  - Step playbook (`plan-ticket`, `verify`, `review`) và `RESULTS.md` vẫn ở smode, vì worker của factory chạy chúng.
- **Delegation chỉ ở factory.** `roles.md`, `roles-template.md`, `scripts/roles.mjs` và test chuyển sang skill `factory`. `factory setup` viết `roles.md`, thay cho playbook `setup` của smode. `smode/harness/t3.md` gộp vào `factory/references/t3.md`.
- **Bốn harness doc native** trong `smode/harness/`: `claude-code.md`, `opencode.md`, `antigravity.md`, `cursor.md`. Mỗi doc chỉ có cách tìm skill và bảng action (hỏi người dùng, todo list, lập lịch, sub-agent cho skill cần nó), mở đầu bằng dòng **Verified**.
- **Phân phối:**
  - **Claude Code:** plugin như hiện tại.
  - **Cursor:** `.cursor-plugin/plugin.json` cho `core` và `software`, cùng `.cursor-plugin/marketplace.json` ở gốc repo.
  - **Antigravity:** `.antigravity-plugin/plugin.json` cho mỗi plugin.
  - **OpenCode:** `npx skills add … -a opencode` vào `.agents/skills`.
  - Manifest chưa cài thử thì ghi "chưa kiểm chứng" trong `PLATFORMS.md`.
- **Bỏ OMP và Codex:**
  - harness doc của cả hai;
  - `.omp-plugin/` và `.codex-plugin/` của mỗi plugin;
  - catalog `.omp-plugin/marketplace.json` và `.agents/plugins/marketplace.json`;
  - mọi `agents/openai.yaml`;
  - `templates/roles.omp-config.yml`;
  - `platform: omp` trong `catalog.yaml`, cùng các luật validator về Codex policy và version OMP.
- **ADR-0006** ghi các quyết định trên. Nó thay phần smode chọn model của ADR-0003 và ADR-0004, và phần OMP, Codex của ADR-0005.

## User Stories

1. Là developer, tôi muốn smode làm việc trong chính phiên của tôi, không sinh worker, để tôi thấy và điều khiển được mọi bước.
2. Là developer, tôi muốn `bug-fix`, `ticket` và `refactor` vẫn verify và review như các bước riêng, để thay đổi vẫn được kiểm theo ticket.
3. Là developer, tôi muốn `code-review`, `implement-spec` và `research` vẫn dùng sub-agent của harness, để giữ cách làm song song của chúng.
4. Là developer chạy factory, tôi muốn `factory setup` viết `roles.md` và factory là nơi duy nhất đọc nó.
5. Là developer, tôi muốn playbook `setup` của smode không còn hỏi role.
6. Là developer dùng OpenCode, Antigravity hay Cursor, tôi muốn smode biết cách tìm skill và hỏi tôi bằng tool của harness đó.
7. Là developer dùng Cursor, tôi muốn thêm marketplace của repo này và cài `core`, `software`.
8. Là developer dùng Antigravity, tôi muốn cài plugin bằng `agy plugin install`.
9. Là developer dùng OpenCode, tôi muốn một lệnh cài skill vào `.agents/skills`.
10. Là maintainer, tôi muốn không còn file nào của OMP và Codex, để validator và tài liệu chỉ nói về bốn harness.

## Implementation Decisions

- `smode/SKILL.md`:
  - **Delegation** thay bằng **Working alone**: không worker; step playbook chạy như bước riêng; skill có sub-agent dùng sub-agent mặc định của harness và model của phiên; "read-only is a rule"; "you own the result".
  - Bước 1 của **Opening the task** vẫn đọc "your work order names a playbook", vì worker của factory dùng nó.
- Playbook bỏ tên role và "fresh worker". `spec-run` vẫn gọi `implement-spec`.
- `code-review`: mỗi trục một sub-agent chỉ đọc, loại sub-agent mặc định của harness, model của phiên.
- Harness doc không còn mục **Candidates**, **Migration** hay **Models on offer**. Bảng action giữ "Spawn a sub-agent" chỉ cho skill cần nó, không có model.
- Validator:
  - bộ harness doc bắt buộc là bốn file trên;
  - `smode/` không nhắc `docs/agents/roles.md`, `roles.mjs`, và không dùng `scout`, `thinker`, `reviewer`, `coordinator` như tên role;
  - version của `.claude-plugin`, `.cursor-plugin` và `.antigravity-plugin` khớp nhau;
  - mỗi plugin shared có đủ ba manifest.
- Luật validator về entry point chỉ còn `disable-model-invocation`, vì Codex đã bỏ nên không còn policy của Codex.
- `factory` giữ năm role. Mọi đường dẫn tới `roles.mjs` đổi thành `<factory>/scripts/roles.mjs`.

## Testing Decisions

- Test của `roles.mjs` chuyển theo script.
- Validator có test đỏ và xanh cho từng luật mới, và bỏ test của những luật đã gỡ.
- Acceptance: mỗi harness một phiên.
  - **Claude Code** (`claude -p`) và **OpenCode** (≥ 1.18.0, project nháp cài skill vào `.agents/skills`): smode tự vào, chọn đúng playbook và không spawn worker.
  - **Cursor và Antigravity** qua T3: đọc smode theo đường dẫn, chọn đúng playbook.
  - Manifest Antigravity kiểm bằng `agy plugin validate` nếu cài được CLI.

## Out of Scope

- Enforcement TDD bằng rule hay hook.
- Cách chọn model của factory (vẫn theo `roles.md` và T3).
- Đăng lên marketplace chính thức của Cursor hay Antigravity.
