Status: ready-for-agent

# Config của skill ở project scope, một hệ role, mode `override`

Nguồn: cuộc brainstorm ngày 2026-11-18 sau khi đóng `smode-factory-v2`. Spec này sửa một quyết định của ADR-0003: cấu hình role không còn là "per-machine".

## Problem Statement

Người dùng chạy cùng bộ skill trên nhiều project và nhiều harness (Claude Code, Codex, Oh My Pi, các provider trong T3 Code). Cách cấu hình hiện tại gặp bốn vấn đề:

1. **Cấu hình role nằm ở mức máy, và mỗi harness giữ một chỗ, một format riêng.** Với Claude Code, file nằm ở `~/.claude/rules/smode-roles.md`. Với OMP là `modelRoles` trong `~/.omp/agent/config.yml`, với Codex là `~/.codex/agents/`. Vì vậy `smode`, một mode skill lẽ ra trung lập, lại phụ thuộc vào harness: harness quyết định file roles ở đâu và viết thế nào. Cách dùng `~/.claude/rules/` còn là một workaround: Claude Code tự nạp file đó vào mọi phiên ở mọi project, kể cả phiên không dùng `smode`.
2. **Không cấu hình được theo project.** Repo quan trọng cần reviewer mạnh, repo phụ muốn chạy rẻ, nhưng hiện chỉ có một cấu hình cho cả máy. Cấu hình đó cũng không đi theo repo, nên người khác clone về không có.
3. **Có hai hệ role.**
   - `ROLES.md` có `scout`, `worker`, `thinker`, `coordinator`, `architect`, `judge`, cộng các role custom `reviewer`, `planner`, `implementer`, `verifier`, `writer`.
   - `smode` có 5 role: `scout`, `worker`, `thinker`, `reviewer`, `coordinator`.

   Cùng một tên có thể mang hai nghĩa, và đổi model thì phải nhớ sửa ở hai nơi.
4. **Không có cách chủ động sửa lại config đã setup.** Chạy lại một setup skill thì nó "nhìn trước rồi mới ghi" và giữ nguyên những gì đã có. Muốn đổi một mục thì phải sửa file bằng tay. Ngoài ra, hiện chưa có cách nào xem một role đang chạy trên model nào, ứng viên nào bị chặn vì hết quota, và ứng viên nào đã qua bài kiểm tra provider.

## Solution

- **Mọi config của skill nằm ở `docs/agents/` của project và được commit cùng code.** File mới `docs/agents/roles.md` giữ các route theo role. Sau thay đổi này, không skill nào đọc cấu hình role ở mức máy nữa.
- **Format roles trung lập với harness.**
  - Mỗi role là một route, gồm các ứng viên xếp theo thứ tự ưu tiên. Mỗi ứng viên viết là `<provider>/<model>` kèm option.
  - `<provider>` là tên trung lập (`anthropic`, `openai`, `google`, `cursor`, `antigravity`, …), không phải id của một harness.
  - Option cũng trung lập (`effort=high`).
  - Mỗi harness doc của `smode` nói harness đó chạy được ứng viên nào và ánh xạ tên, option sang tool của nó ra sao. Ứng viên nào harness không chạy được thì bỏ qua.
- **Một hệ role duy nhất, gồm 5 role của `smode`.**
  - `architect` gộp vào `thinker`, `judge` gộp vào `scout`.
  - Các role custom của agent platform đi theo bước: `planner` dùng `thinker`, `implementer` dùng `worker`, `verifier` và `reviewer` dùng `reviewer`.
  - `writer` bỏ, vì không còn plugin nào dùng.
  - `ROLES.md` chỉ còn mô tả 5 role, kèm selector dự phòng của từng platform cho agent platform.
- **Thiếu `docs/agents/roles.md` thì worker chạy trên model của phiên.** Reply nói rõ điều đó và gợi ý chạy playbook `setup` của `smode`.
- **Mọi setup skill có mode `override`.** Mode này đọc config hiện tại, hỏi người dùng mục nào cần đổi (mặc định giữ), chỉ ghi lại mục được chọn, cho xem diff rồi commit. Chạy không có mode thì vẫn như cũ: nhìn trước rồi mới ghi, giữ nguyên cái đã có.
- **`smode` có script `roles` để xem trạng thái.** Script in bảng role → ứng viên, mỗi ứng viên kèm nguồn, trạng thái kiểm tra provider, block quota còn hiệu lực, và lần gần nhất được dùng. Hai cột sau lấy từ memory của factory-v2 nếu project có.
- **Migration tự động.** Playbook `setup` của `smode` phát hiện cấu hình role ở các vị trí cũ, đề xuất `docs/agents/roles.md` từ đó, và sau khi commit thì hỏi có xoá file cũ không.

## User Stories

1. Là developer, tôi muốn cấu hình role nằm trong repo, để clone về là có, và lịch sử thay đổi nằm trong git.
2. Là developer, tôi muốn mỗi project có route riêng, để repo quan trọng dùng reviewer mạnh còn repo phụ chạy rẻ.
3. Là developer, tôi muốn mọi config của skill nằm chung một thư mục `docs/agents/`, để biết ngay phải tìm và sửa ở đâu.
4. Là developer, tôi muốn `smode` đọc roles theo cùng một cách trên mọi harness, để đổi harness không phải cấu hình lại.
5. Là developer, tôi muốn `docs/agents/roles.md` không chứa id riêng của harness nào, để cùng một file chạy được trên Claude Code, Codex, OMP và T3.
6. Là developer dùng Claude Code, tôi muốn `smode` tự bỏ qua ứng viên không phải model Claude, để route có Gemini vẫn dùng được ở Claude Code.
7. Là developer dùng T3, tôi muốn mọi ứng viên của route đều chạy được qua provider tương ứng, để có fallback khi một provider hết quota.
8. Là thành viên team không có gói Antigravity, tôi muốn ứng viên Antigravity bị bỏ qua thay vì làm hỏng bước, để tôi dùng chung `roles.md` với team.
9. Là developer, tôi muốn Claude Code không còn nạp file roles vào mọi phiên ở mọi project, để context không bị dính cấu hình không liên quan.
10. Là developer, tôi muốn chỉ có một hệ role, để một tên role chỉ có một nghĩa.
11. Là developer, tôi muốn `ROLES.md` mô tả role bằng đặc tính chứ không bằng model, để nó không lỗi thời khi model đổi.
12. Là developer dùng factory v1, tôi muốn agent `planner`, `implementer`, `verifier`, `review-*` vẫn chạy được sau khi gộp role, để v1 không gãy.
13. Là developer dùng OMP, tôi muốn agent OMP vẫn có fallback về role sẵn có của OMP khi chưa cấu hình gì, để cài plugin xong là chạy được.
14. Là developer dùng OMP, tôi muốn `setup` đồng bộ các model trong `roles.md` sang user config của OMP mà không ghi đè cấu hình của project khác, để OMP chấp nhận model chọn theo từng lần gọi.
15. Là developer dùng Codex, tôi muốn `setup` sinh custom agent theo role từ `roles.md` ở scope project, để Codex đọc cùng nguồn.
16. Là developer, tôi muốn khi project chưa có `roles.md` thì worker chạy trên model của phiên và reply nói rõ, để tôi biết vì sao model không như mong đợi.
17. Là developer, tôi muốn chạy `setup-software-context override` để đổi riêng một mục (ví dụ reply language) mà không phải trả lời lại cả bộ câu hỏi.
18. Là developer, tôi muốn `setup-verification override` cho phép đổi riêng cách verify một mục, giữ nguyên phần còn lại.
19. Là developer, tôi muốn `smode setup override` cho phép đổi route của một role, giữ nguyên các role khác.
20. Là developer, tôi muốn `factory setup override` và `factory-v2 setup override` cho phép đổi riêng `Required checks`, `Max workers` hay `Wake timeout`.
21. Là developer, tôi muốn mode `override` cho xem diff trước khi commit, để không ghi nhầm.
22. Là developer, tôi muốn chạy lại setup không có mode thì vẫn an toàn như cũ, để thói quen cũ không phá config.
23. Là developer, tôi muốn một lệnh in bảng role → ứng viên, để biết lúc này mỗi role sẽ chạy trên model nào.
24. Là developer chạy factory-v2, tôi muốn bảng đó cho biết ứng viên nào đang bị chặn vì quota và tới khi nào, để biết vì sao một bước đang chờ.
25. Là developer chạy factory-v2, tôi muốn bảng đó cho biết ứng viên nào đã qua hoặc chưa qua bài kiểm tra provider, để biết cần kiểm tra lại cái nào.
26. Là developer chạy factory-v2, tôi muốn bảng đó cho biết lần gần nhất mỗi ứng viên được dùng, để thấy route có thực sự chạy như cấu hình không.
27. Là developer, tôi muốn lệnh đó báo lỗi format của `roles.md` (role lạ, ứng viên sai cú pháp, option lạ), để sửa trước khi factory gặp lỗi.
28. Là developer đã setup trên máy này, tôi muốn `setup` tự đọc cấu hình cũ (`~/.claude/rules/smode-roles.md`, `~/.codex/agents/`, `modelRoles` của OMP) và đề xuất `roles.md` từ đó, để không phải gõ lại.
29. Là developer, tôi muốn `setup` hỏi trước khi xoá file roles cũ ở mức máy, vì đó là file ngoài repo.
30. Là developer chạy factory-v2, tôi muốn factory-v2 đọc roles thẳng từ `docs/agents/roles.md`, để bỏ được dòng `Routes:`.
31. Là developer chạy factory-v2, tôi muốn `quota.md`, `providers.md` và trường `route` của kết quả dùng tên ứng viên trung lập, để khớp với `roles.md`.
32. Là người viết skill, tôi muốn validator chặn tên harness và đường dẫn cấu hình của harness (`~/.claude`, `~/.omp`, `~/.codex`) ở mọi nơi ngoài `harness/` và `references/`, để lõi không phụ thuộc lại.
33. Là người viết skill, tôi muốn validator kiểm tra template `roles.md` và mọi role mà skill hay agent nhắc tới đều thuộc 5 role, để hai hệ role không mọc lại.
34. Là người viết skill, tôi muốn có một ADR ghi lại việc đổi từ per-machine sang project scope, để người sau hiểu vì sao ADR-0003 bị sửa.

## Implementation Decisions

**Vị trí và nguồn sự thật**

- Mọi config mà skill đọc nằm ở `docs/agents/` của project và được commit. `docs/agents/roles.md` là nguồn sự thật duy nhất cho model theo role.
- Thứ tự đọc của `smode` chỉ có một tầng: `docs/agents/roles.md`, không có thì dùng model của phiên. Không có tầng override cục bộ và không có cấu hình ở mức máy.
- State không phải config, nên vẫn nằm ngoài git: journal, quota, kết quả của worker, wiki của factory.

**Format `docs/agents/roles.md`**

- Theo cùng kiểu các file khác trong `docs/agents/`: vài dòng giải thích, sau đó mỗi role một dòng `Key: value`.
  ```
  scout: anthropic/claude-haiku-5-5 effort=low, google/gemini-3.8-flash effort=low via=antigravity
  reviewer: google/gemini-4-hydrogen effort=high via=antigravity, xai/grok-4.7 effort=high via=cursor
  ```
- Mỗi ứng viên gồm:
  - `<provider>/<model>`: provider là nhà cung cấp model, tên trung lập;
  - `via=<channel>`: tuỳ chọn, là kênh chạy model khi kênh đó khác nhà cung cấp (Cursor, Antigravity chạy model của hãng khác);
  - option trung lập. Lúc này chỉ có `effort` (`low`, `medium`, `high`).
- Chỉ 5 role được dùng làm key: `scout`, `worker`, `thinker`, `reviewer`, `coordinator`. Role nào thiếu dòng thì dùng model của phiên.
- Quy tắc chọn không đổi so với ADR-0003. Lấy ứng viên đầu tiên thoả cả ba điều kiện:
  - harness chạy được nó;
  - provider đang sẵn sàng;
  - không bị chặn quota.

  Ứng viên của `reviewer` còn phải khác họ model với ứng viên được chọn cho `worker`.

**Harness doc**

- Mỗi harness doc của `smode` (`claude-code`, `codex`, `omp`, `t3`) có một mục "Ứng viên" nói ba điều:
  - harness đó chạy được ứng viên nào;
  - ánh xạ `<provider>/<model>` và `via` sang tham số của tool ra sao (T3: `anthropic` không có `via` thành `claudeAgent`, `via=antigravity` thành `antigravity`, …; Claude Code: model Claude thành alias `opus`/`sonnet`/`haiku`/`fable`);
  - ánh xạ `effort` sang option riêng của provider (`effort`, `thinking_level`, `reasoning_effort`).
- Mục "Role configuration" của mỗi harness doc bị bỏ. Phần chung chuyển vào `SKILL.md` của `smode`: đọc `docs/agents/roles.md`.
- **OMP là ngoại lệ có kiểm soát.** OMP chỉ chấp nhận model chọn theo từng lần gọi khi model đó được một role ở user config nêu tên (spike S6). Vì vậy playbook `setup` trên OMP đồng bộ một chiều các model của `roles.md` vào `modelRoles` của user config:
  - dùng key có namespace theo repo, để project này không ghi đè cấu hình của project khác;
  - bật `task.perCallModel: on` sau khi hỏi người dùng.

  Việc OMP có chấp nhận model khi key mang namespace hay không phải được chứng minh trước (xem Further Notes). Nếu không được, thì đồng bộ dạng hợp (union): chỉ thêm, không xoá.
- **Codex** (dòng còn "unchecked"): `setup` sinh `.codex/agents/<role>.toml` ở scope project từ `roles.md`. File này được sinh ra, mở đầu bằng dòng ghi chú "sinh từ `docs/agents/roles.md`, đừng sửa tay". Có commit hay không thì theo `.codex/config.toml`, vốn đã được commit.

**Một hệ role**

- `ROLES.md` chỉ còn 5 role. Frontmatter vẫn được máy đọc. Mỗi role có `purpose` và selector dự phòng cho từng platform: OMP `@<built-in>`, alias của Claude, effort của Codex.
- Agent platform giữ tên (`planner`, `implementer`, `verifier`, `review-standards`, `review-spec`) nhưng nêu role theo bước: `planner` là `thinker`, `implementer` là `worker`, các agent còn lại là `reviewer`.
  - Agent OMP: `model: ["@thinker", "@slow"]`. Key `@thinker` có khi `setup` đã đồng bộ; chưa có thì OMP dùng role built-in.
  - Agent Claude: alias mà `ROLES.md` ghi cho role đó.
- Validator cũ kiểm tra "agent OMP chỉ dùng `@role` có trong `ROLES.md`". Kiểm tra này vẫn giữ, chỉ đổi danh sách role.

**Mode `override`**

- Áp dụng cho các setup skill ghi config đọc bởi skill:
  - `setup-software-context`;
  - `setup-verification`;
  - playbook `setup` của `smode`;
  - `factory` (mode `setup`): đây là ngoại lệ có chủ đích với việc đóng băng v1 của ADR-0003, chỉ thêm `override` vào `SETUP.md`, không đổi hành vi nào khác;
  - `factory-v2` (mode `setup`).
- Hành vi:
  1. đọc các file config mà skill đó sở hữu;
  2. liệt kê các mục cùng giá trị hiện tại;
  3. hỏi mục nào cần đổi, mặc định là giữ;
  4. chỉ đề xuất lại giá trị cho mục được chọn, theo đúng cách setup thường đề xuất (đọc CI, đọc model đang có, …);
  5. ghi lại, cho xem diff, rồi commit trên trunk với message "Override <skill> config: <mục>".
- Không ghi file `.bak`, vì git đã là backup.
- `argument-hint` của skill thêm `override` (ví dụ `setup | setup override | run | once` cho factory). Với skill không có mode, `override` là đối số duy nhất được nhận.

**Script `roles` của `smode`**

- Nằm trong `scripts/` của `smode`, có test bên cạnh, viết bằng Node như `cli/`, không thêm dependency.
- `check`: parse `docs/agents/roles.md` và báo lỗi:
  - role ngoài 5 role;
  - ứng viên sai cú pháp;
  - option lạ;
  - giá trị `effort` lạ.

  Trả mã lỗi khác 0 khi có lỗi.
- `show`: in bảng role → ứng viên theo thứ tự. Mỗi ứng viên có các cột:
  - harness hiện tại có chạy được không (nhận harness qua đối số);
  - trạng thái kiểm tra provider, lấy từ `providers.md`;
  - block quota còn hiệu lực và tới khi nào, lấy từ `quota.md`;
  - lần gần nhất được dùng, lấy từ trường `route` của `results/*.json`.

  Ba cột cuối chỉ có khi `docs/agents/factory-v2.md` tồn tại và thư mục `Memory:` của nó đọc được. Block đã hết hạn hiện là "hết hạn", không bị coi là đang chặn.
- Script không gọi harness hay provider nào. Việc provider có sẵn sàng hay không lúc chạy vẫn do harness kiểm.

**Factory-v2**

- Đọc route từ `docs/agents/roles.md`. Dòng `Routes:` bị bỏ khỏi template, còn `SETUP.md` bỏ mục ghi `Routes:`.
- `quota.md`, `providers.md` và trường `route` trong kết quả ghi ứng viên ở dạng trung lập, giống hệt cách viết trong `roles.md`. Reference T3 lo việc ánh xạ khi gọi `delegate_task`.
- Smoke test vẫn kiểm từng ứng viên của mọi route, nhưng lấy route từ `roles.md`.

**Migration**

- Playbook `setup` của `smode`, khi project chưa có `roles.md`, đọc các vị trí cũ mà harness doc liệt kê:
  - `~/.claude/rules/smode-roles.md`, cả dòng role thường lẫn dòng `route`;
  - các key role của smode trong `modelRoles` của OMP;
  - `~/.codex/agents/<role>.toml`.
- Từ đó nó chuyển sang dạng trung lập (`claudeAgent/claude-opus-5-5 effort=high` thành `anthropic/claude-opus-5-5 effort=high`), đề xuất `roles.md` cho người dùng duyệt, rồi ghi và commit.
- Sau khi commit, nó hỏi riêng có xoá `~/.claude/rules/smode-roles.md` không. Đây là file ngoài repo và đang được nạp vào mọi phiên.
- Các vị trí cũ chỉ được nhắc tới trong mục "Migration" của harness doc.
- `factory-v2 setup override` bỏ dòng `Routes:` khỏi `docs/agents/factory-v2.md` đã có.

**ADR và glossary**

- ADR-0004 "Config của skill ở project scope". Nó sửa ADR-0003 ở ba chỗ: cấu hình role không còn per-machine, chỉ còn một hệ role, và `factory` v1 nhận thêm mode `override`.
- `GLOSSARY.md`:
  - **Role**: ánh xạ sang model trong `docs/agents/roles.md` của project, không còn "per machine and harness".
  - **Route**: các ứng viên `<provider>/<model>`, dùng trên mọi harness, không chỉ trên manager nhiều provider.
  - Thêm thuật ngữ **Candidate**.
- Nguyên tắc "Three layers" trong `AGENTS.md` sửa theo: role ánh xạ sang model trong `docs/agents/roles.md` của project.

**Validator**

- Chặn chuỗi `~/.claude`, `~/.omp`, `~/.codex` và tên harness cụ thể khi chúng là chỉ dẫn cấu hình, trong mọi file của shared skill ngoài `harness/` và `references/`. Quy tắc này mở rộng quy tắc tên tool hiện có (`TOOL_MAPPING_DIRS`).
- `ROLES.md` có đúng 5 role. Mọi agent platform nêu một role trong số đó.
- `templates/` có một mẫu `roles.md`, và mẫu đó qua được `roles check`.

## Testing Decisions

- Một test tốt kiểm hành vi nhìn thấy từ ngoài: input là file, output là bảng, thông báo lỗi và mã thoát. Test không kiểm hàm nội bộ.
- **Seam 1, script `roles`:** chạy lệnh trên một thư mục project giả, có `docs/agents/roles.md` và tuỳ chọn có memory factory-v2 giả, rồi so output với mong đợi. Các ca cần có:
  - file hợp lệ;
  - role lạ, ứng viên sai cú pháp, `effort` lạ;
  - không có file;
  - harness không chạy được một ứng viên;
  - quota còn hiệu lực và đã hết hạn;
  - ứng viên `FAIL` hoặc `NOT CHECKED`;
  - lần dùng gần nhất lấy từ `results/*.json`, có ca thiếu trường `route`;
  - không có `factory-v2.md`.
- **Seam 2, validator của repo:** dùng test kiểu `cli/repo.test.mjs` hiện có, mỗi quy tắc một repo giả vi phạm. Các ca cần có:
  - đường dẫn `~/.claude` trong `SKILL.md`;
  - role thứ 6 trong `ROLES.md`;
  - agent nêu role không tồn tại;
  - mẫu `roles.md` hỏng.
- **Phần còn lại là văn bản skill**, gồm harness doc, playbook `setup`, mode `override` và `SETUP.md` của factory. Phần này được kiểm bằng `Verify:` trên ticket: chạy thật trên repo này và ghi bằng chứng (diff, bảng, nội dung file). Không có test tự động cho văn bản.
- **Tiền lệ:** `cli/repo.test.mjs` (dùng repo giả và kiểm thông báo của validator) và `core/skills/audit-product-opportunity/scripts/score_audit.py` cùng test của nó (script nằm trong skill).

## Out of Scope

- Harness doc cho Antigravity, Cursor, OpenCode, tức là chạy `smode` trực tiếp hoặc làm coordinator trên các provider đó. Đây là spec sau, xây trên format trung lập của spec này.
- Lớp override cục bộ được gitignore (`*.local.md`), và cấu hình role ở mức máy làm fallback.
- Đưa state của factory (journal, quota, wiki) vào git.
- Mode `override` cho các setup skill dựng tooling chứ không ghi config đọc bởi skill: `frontend-web-project-setup`, `portless-web-project-setup`, `setup-pre-commit`, `github-repo-setup`.
- Đưa rule TDD của `software-omp` vào playbook cho harness khác.
- Sửa logic, playbook hay reference của factory v1, trừ việc thêm mode `override`.

## Further Notes

- **Spike cần làm trước ticket OMP:** OMP có chấp nhận model chọn theo từng lần gọi khi model đó chỉ được nêu dưới key `modelRoles` có namespace (ví dụ `skills.thinker`) không? Nếu có, mỗi project đồng bộ key riêng của mình. Nếu không, đồng bộ dạng hợp: thêm model vào key chung, không xoá model của project khác.
- **Memory factory-v2 của repo này** (`~/.local/share/factory-v2/skills`) đang ghi ứng viên bằng id của T3 (`claudeAgent/...`, `cursor/...`). Ticket factory-v2 chuyển các dòng của `providers.md` sang dạng trung lập. Các block cũ trong `quota.md` đã hết hạn, nên có thể xoá.
- **Thứ tự ticket gợi ý:**
  1. format `roles.md` cùng script `roles check`;
  2. gộp role trong `ROLES.md` và validator;
  3. phần chung của `smode` và 4 harness doc;
  4. migration trong playbook `setup`;
  5. factory-v2;
  6. mode `override` cho các setup skill;
  7. `roles show`;
  8. ADR, glossary, `AGENTS.md`.

  Ticket OMP chờ spike.
- Sau khi spec này xong, playbook `setup` của `smode` không còn đụng tới `~/.claude/rules/`. File `~/.claude/rules/smode-roles.md` trên máy này chỉ bị xoá khi người dùng đồng ý ở bước migration.
