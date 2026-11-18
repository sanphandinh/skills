Status: needs-triage

# Một factory, smode là entry point, không còn platform agent

Nguồn: deep review kiến trúc smode và factory v2 ngày 2026-11-18, sau khi đóng `project-config-roles`. Spec này xây trên ADR-0004 (branch `feat/project-config-roles`, chưa merge vào `main`), nên chỉ bắt đầu sau khi branch đó merge.

## Problem Statement

Người dùng chạy bộ skill trên nhiều harness và nhiều provider qua T3 Code. Sau ADR-0003 và ADR-0004, model được chọn lúc delegate và route nằm trong `docs/agents/roles.md` của project, nhưng kiến trúc cũ vẫn còn nguyên bên cạnh:

1. **Hai factory gần như giống hệt nhau.** Sáu file lõi của `factory` (v1) có 341 dòng, và chỉ 43 dòng khác `factory-v2` (đo bằng `diff`). Mỗi bản sửa phải làm hai lần, và v1 đã bị bỏ sót: bug fingerprint `ls -la` đã sửa trong reference T3 nhưng vẫn còn trong reference Orca. v2 phải mang thêm những dòng chỉ để tránh v1: `Factory: v2`, "one repository runs one version", bước kiểm lịch thức của v1, tên worker "giữ theo v1". Orca không còn được dùng.
2. **Platform agent chỉ là bản chép đã lệch.** `software-claude` và `software-omp` chép lại nội dung các playbook `plan-ticket`, `ticket`, `verify`, `review`, và bản chép đã sai: `filesToChange` thay vì `files_to_change`, `prBody` thay vì `pr_body`, verifier trả về `notes` mà không có `findings`, `model: opus` cố định trong khi route reviewer của project là Gemini. Chỉ factory v1 và một câu fallback trong `code-review` còn dùng các agent này. `ROLES.md`, một phần validator và các template cấu hình tồn tại chỉ vì chúng.
3. **smode chưa phải là entry point.** `smode` là skill do người dùng gọi (`disable-model-invocation: true`). Khoảng 13 skill khác tự kích hoạt theo description của mình, nên câu "fix bug X" có thể vào thẳng `diagnosing-bugs` và bỏ qua bước verify, review bằng fresh worker của playbook `bug-fix`. Danh sách 16 playbook là văn xuôi, trộn playbook cho người dùng với playbook chạy bên trong worker (`plan-ticket`, `verify`), không có tín hiệu đầu vào nào để route và không có luật nào cho trường hợp hai playbook cùng khớp. Thủ tục mở đầu (restate, todo list, hai fresh worker "however small the fix") quá nặng cho một câu hỏi hay một sửa đổi một dòng.
4. **Cùng một nội dung nằm ở nhiều nơi.** Schema kết quả nằm trong phần Reply của playbook, trong `WORK-ORDERS.md` của factory và trong các agent. Luật verdict của verify có ba bản, template handoff có ba bản, bảng năm role có bốn bản.
5. **Hai plugin phụ thuộc vòng vào nhau.** `smode` (plugin `software`) gọi `factory-v2` (plugin `factory`), và `factory-v2` gọi lại `smode`. Hai plugin có version riêng, nên đường dẫn đã cài của bên này không suy ra được từ bên kia (bug #16).
6. **Cấu hình và tài liệu cũ vẫn còn.** `~/.claude/rules/smode-roles.md` vẫn được nạp vào mọi phiên Claude Code và ghi `reviewer: opus`, trái với route của project. `AGENTS.md` liệt kê năm skill không tồn tại. Các template vẫn bảo cài `software-claude` và `software-omp`.

## Solution

- **Một factory duy nhất, tên `factory`, nằm trong plugin `software`.** Nội dung là `factory-v2` hiện tại, bỏ mọi dòng chỉ tồn tại vì có hai version. Plugin `factory`, factory v1 và reference Orca bị xoá. T3 là reference duy nhất. Settings ở `docs/agents/factory.md`. Setup chuyển một project v1 hoặc v2 sang bản mới mà không mất journal, wiki hay kết quả.
- **Không còn platform agent.** Xoá hẳn hai plugin `software-claude` và `software-omp`, kể cả hai rule TDD của OMP (enforcement TDD sẽ tính sau, ngoài spec này). Xoá `ROLES.md`; năm role do script roles của `smode` định nghĩa và `smode` mô tả. `code-review` chạy mỗi trục trên một worker của role `reviewer`.
- **smode tự kích hoạt và là entry point cho mọi yêu cầu kỹ thuật.** Trong plugin `software`, chỉ `smode` được model tự gọi. Mọi skill khác chỉ chạy khi `smode` (hoặc người dùng) gọi tên. smode route theo một bảng tín hiệu, câu đầu của reply nói đã chọn playbook nào và vì sao, và có playbook `quick` cho việc nhỏ.
- **Mỗi nội dung chỉ có một nguồn.** Schema kết quả nằm trong một file của `smode`, và cả playbook lẫn factory đều trỏ tới đó. Work order của factory chỉ giữ những gì riêng của factory.
- **`implement` và `implement-spec` giữ nguyên.** Playbook của smode vẫn gọi chúng (`spec-run` gọi `implement-spec`), và người dùng vẫn gọi trực tiếp được.

## User Stories

1. Là developer, tôi muốn chỉ có một factory, để mỗi bản sửa chỉ làm một lần.
2. Là developer, tôi muốn gọi factory bằng tên `factory` như trước, để không phải nhớ hậu tố version.
3. Là developer có project đang chạy factory v2, tôi muốn `factory setup` đổi `docs/agents/factory-v2.md` thành `docs/agents/factory.md` và giữ nguyên `Memory:`, để journal, wiki và kết quả vẫn tiếp tục.
4. Là developer có project từng chạy factory v1 với Orca, tôi muốn `factory setup` nhận ra settings v1 và đề xuất settings mới, để không phải làm lại từ đầu.
5. Là developer có thư mục memory v1, tôi muốn setup bổ sung `providers.md` và `quota.md` vào đúng thư mục đó, để lessons cũ còn dùng được.
6. Là developer, tôi muốn tên worker theo bước (`plan`, `build`, `verify`, `review`), để journal không nhầm worker `reviewer` với role `reviewer`.
7. Là developer, tôi muốn factory nằm cùng plugin với `smode`, để hai bên luôn cùng version và đường dẫn đã cài suy ra được.
8. Là developer, tôi muốn reference Orca bị xoá, để không phải giữ một đường chạy không còn dùng.
9. Là developer, tôi muốn không còn agent `planner`, `implementer`, `verifier`, `review-*`, để chỉ playbook mô tả mỗi bước làm gì.
10. Là developer, tôi muốn `code-review` chọn model cho hai trục theo role `reviewer` trong `docs/agents/roles.md`, để review luôn đi theo route của project.
11. Là developer, tôi muốn không còn `ROLES.md`, để danh sách role chỉ có một nguồn.
12. Là developer dùng Claude Code, tôi muốn marketplace chỉ còn `core` và `software`, để cài đặt chỉ cần hai lệnh.
13. Là developer dùng OMP, tôi muốn OMP chạy smode chỉ với plugin shared, để không cần plugin riêng cho từng harness.
14. Là developer, tôi muốn mọi yêu cầu kỹ thuật tự vào smode mà không phải gõ `/smode`, để quy trình (verify, review, fresh worker) không bị bỏ qua.
15. Là developer, tôi muốn các skill như `tdd` hay `diagnosing-bugs` không tự kích hoạt, để chúng không tranh trigger với smode.
16. Là developer, tôi muốn câu đầu tiên của reply nói smode đã chọn playbook nào và vì sao, để tôi sửa route ngay nếu nó chọn sai.
17. Là developer, tôi muốn một câu hỏi ngắn hoặc một sửa đổi một dòng đi qua playbook `quick`, không todo list và không fresh worker, để việc nhỏ vẫn nhanh.
18. Là developer, tôi muốn `quick` tự chuyển sang playbook đầy đủ khi việc lớn hơn dự kiến, để quy trình không bị bỏ qua chỉ vì lúc đầu trông nhỏ.
19. Là developer, tôi muốn smode route theo tín hiệu cụ thể (số PR, đường dẫn ticket, `setup`, handoff, triệu chứng lỗi), để cùng một yêu cầu luôn ra cùng một playbook.
20. Là developer, tôi muốn có luật cho trường hợp hai playbook cùng khớp, để route không phụ thuộc may rủi.
21. Là developer, tôi muốn danh sách playbook tách thành playbook cho người dùng và playbook chạy trong worker, để smode không chọn `plan-ticket` cho một yêu cầu của tôi.
22. Là worker nhận work order của factory, tôi muốn smode bỏ qua bước route khi work order đã nêu playbook, để tôi không chọn playbook khác với coordinator.
23. Là developer, tôi muốn vẫn gọi được `implement` và `implement-spec` trực tiếp, để làm việc không qua smode khi cần.
24. Là coordinator, tôi muốn schema kết quả của mỗi bước nằm ở một file, để key tôi đọc luôn khớp key worker ghi.
25. Là maintainer, tôi muốn validator báo lỗi khi key mà factory đọc không có trong schema, để lỗi lệch như `filesToChange` không quay lại.
26. Là maintainer, tôi muốn validator báo lỗi khi bảng route của smode và các file playbook không khớp nhau, để không có playbook mồ côi.
27. Là maintainer, tôi muốn validator báo lỗi khi một skill của `software` ngoài `smode` lại cho model tự gọi, để entry point không bị phá.
28. Là maintainer, tôi muốn template handoff chỉ nằm ở doc tracker, để đổi một lần là đủ.
29. Là developer, tôi muốn `AGENTS.md`, `PLATFORMS.md`, `README.md` và các template mô tả đúng những gì đang có, để agent đọc chúng không làm theo kiến trúc cũ.
30. Là developer dùng Claude Code, tôi muốn `~/.claude/rules/smode-roles.md` được xoá khi tôi đồng ý, để phiên ở project khác không bị route cũ điều khiển.
31. Là developer có project đã cài `factory`, `software-claude` hay `software-omp`, tôi muốn release notes ghi lệnh gỡ, để project không báo plugin thiếu.

## Implementation Decisions

- **ADR-0005** ghi lại ba quyết định: một factory, không platform agent, smode tự kích hoạt. Nó thay thế phần "v1 frozen" của ADR-0002 và ADR-0003, và phần platform agent của ADR-0004. `GLOSSARY.md` cập nhật các thuật ngữ liên quan: **Mode skill** là entry point; **Playbook** có loại cho người dùng và loại chạy trong worker.
- **Vị trí của factory:** skill `factory` trong plugin `software`, gồm `SKILL.md`, `PLAYBOOK.md`, `WORK-ORDERS.md`, `INTERFACE.md`, `MEMORY.md`, `SETUP.md` và `references/t3.md`. Plugin `factory` bị xoá khỏi `catalog.yaml` và khỏi ba marketplace. Interface mười thao tác giữ nguyên, kể cả việc start-worker nhận model, nên một manager khác vẫn thêm được bằng một reference mới.
- **Settings:** `docs/agents/factory.md`, không có dòng `Factory:`. Setup của factory (và `setup override`) chuyển đổi trước khi làm gì khác:
  - Có `docs/agents/factory-v2.md`: đổi tên file, bỏ dòng `Factory: v2`, giữ mọi dòng khác, kể cả `Memory:`.
  - Có `docs/agents/factory.md` của v1 (có `Agent:`, không có `Coordinator:`): báo cho người dùng, đề xuất `Manager: t3` và `Coordinator:` dạng candidate, giữ các dòng chung, và ghi đè chỉ khi người dùng đồng ý.
- **Memory:** mặc định `~/.local/share/factory/<repo>`. Bố cục v1 là tập con của bố cục mới, nên với thư mục v1 đã có, setup thêm `providers.md` và `quota.md` và giữ `journal.md`, `wiki/`, `results/`. Index bỏ dòng `Factory: v2`.
- **Tên worker theo bước:** `plan`, `build`, `verify`, `review`, dùng trong tên worker (`<number> <step>`), tên file kết quả, khoá trong work order và trường `role` của kết quả được đổi thành `step`. Bảng bước sang role: `plan` → `thinker`, `build` → `worker`, `verify` và `review` → `reviewer`.
- **Wake prompt** trong reference T3 gọi skill `factory` ở mode `once`. Watcher nhận ra một lần thức đang chờ theo chữ `factory once`.
- **`code-review`:** mỗi trục chạy trên một worker của role `reviewer` trong `docs/agents/roles.md`. Không có file đó thì dùng sub-agent general-purpose. Không có sub-agent thì tự chạy hai trục riêng. Đây là skill upstream, nên đoạn thay thế được ghi vào `rewrites` của `UPSTREAM.md`.
- **Năm role** chỉ định nghĩa trong script roles của `smode`. Validator lấy danh sách từ đó. Phần kiểm tra agent và danh sách role có sẵn của OMP bị xoá. Validator vẫn giữ khái niệm `platform` trong catalog và luật "plugin shared không có `agents/`", để sau này thêm được plugin chỉ chứa rule.
- **Template:** `roles.omp-config.yml` chỉ còn phần grant của smode. `roles.claude-settings.json` bị xoá. `templates/AGENTS.md` chỉ cài `core` và `software`.
- **Kích hoạt:** `smode` bỏ `disable-model-invocation`, và `agents/openai.yaml` của nó cho phép gọi ngầm. Description nói rõ phạm vi: mọi yêu cầu kỹ thuật phần mềm trong repo (câu hỏi về code, lỗi, tính năng, refactor, review, ticket, spec, PR, handoff, setup) và việc nó route tới một playbook. Mọi skill khác của `software` đặt `disable-model-invocation: true` và `allow_implicit_invocation: false`. Skill của `core` giữ nguyên, vì chúng dùng chung cho mọi domain.
- **Route:** `smode/SKILL.md` thay danh sách playbook bằng hai bảng:
  - *Entry playbooks:* tín hiệu, rồi playbook. Bảng có luật phân xử theo thứ tự: tín hiệu tường minh (lệnh như `setup`, số PR, đường dẫn) thắng mô tả; việc cần nhiều hơn một ticket đi `spec`; không thay đổi gì thì là `quick` hoặc `investigation`; không khớp gì thì nói ra và đi theo triggers.
  - *Step playbooks* (`plan-ticket`, `verify`, `review`): chỉ chạy khi một playbook khác hay một work order gọi tới. `review` vẫn có một dòng trong bảng entry.

  Câu đầu của reply có dạng `Playbook: <name> (<tín hiệu>)`. Khi work order đã nêu playbook, smode bỏ qua bước route. Các file playbook giữ nguyên chỗ, nên đường dẫn trong work order không đổi.
- **Playbook `quick`:** một câu hỏi trả lời được sau vài lượt đọc, hoặc một sửa đổi không đổi hành vi nhìn thấy được và không đụng test. Không todo list, không fresh worker, restate một câu. Nâng lên `investigation`, `bug-fix`, `feature` hoặc `refactor` khi việc vượt khỏi giới hạn đó, và nói trong reply rằng đã nâng.
- **Schema kết quả:** một file trong `smode` (`RESULTS.md`) giữ object kết quả của `plan`, `build`, `verify`, `review` (key snake_case, các phần chung `step`, `ticket`, `route`, `ok`, `summary`, `questions`, `lessons`). Reply của playbook và `WORK-ORDERS.md` trỏ tới file này. `WORK-ORDERS.md` chỉ giữ phần riêng của factory: branch, push, không đụng GitHub, đường dẫn kết quả, `<route>`, các bài học từ memory. Template handoff chỉ còn trong doc tracker, và work order trỏ tới đó.
- **Ngôn ngữ trung lập với tracker:** bảng ticket chain của factory nói "what the tracker and the pull request show", không nói "what GitHub shows".
- **Release:** plugin `software` lên minor version. Release notes trong `README.md` ghi lệnh gỡ `factory`, `software-claude` và `software-omp` ở project scope cho từng harness.

## Testing Decisions

- Một test tốt kiểm tra hành vi nhìn thấy được từ ngoài: lệnh `npm run validate` báo hoặc không báo lỗi trên một repo dựng sẵn, và lệnh `roles.mjs` in ra gì. Không kiểm tra hàm nội bộ.
- **Seam chính là validator** (`cli/repo.mjs validate` trên một repo fixture), theo cách `cli/repo.test.mjs` đang làm. Các luật mới, mỗi luật một test xanh và một test đỏ:
  - một skill của `software` ngoài `smode` không có `disable-model-invocation: true`;
  - bảng route của `smode` nêu một playbook không có file, hoặc một file playbook không có trong bảng nào;
  - một key mà `PLAYBOOK.md` của factory đọc từ kết quả không có trong `RESULTS.md`;
  - một plugin shared có `agents/`.
- Script roles giữ test hiện có và đổi fixture kết quả sang tên bước mới (`roles.test.mjs`).
- **Seam thật:** một lần `factory once` trên T3 với settings đã chuyển đổi, và một phiên Claude Code mới trong repo nhận một yêu cầu thường mà không có `/smode`. Hai việc này thuộc ticket acceptance.
- Prior art: `cli/repo.test.mjs` (fixture repo tạm), `roles.test.mjs`.

## Out of Scope

- Enforcement TDD sau khi bỏ rule OMP (hook Claude Code, rule OMP, hay lint trong project): người dùng sẽ tính sau.
- Một manager khác ngoài T3 (Orca bản v2 hay bất kỳ manager nào).
- Thay đổi `implement` và `implement-spec`.
- Thay đổi các skill của `core` và trigger của chúng.
- Kiểm chứng `harness/codex.md` (các dòng **Unchecked**).
- Tự chuyển settings của các project khác trên máy (`Ody-drive`, `gia-pha-studio`, …): mỗi project tự chạy `factory setup` khi cần.

## Further Notes

- Máy này còn memory v1 cho `Ody-drive`, `factory-sandbox`, `gia-pha-studio` và `skills` trong `~/.local/share/factory/`, và memory v2 cho `skills` trong `~/.local/share/factory-v2/`. Repo này giữ `Memory: ~/.local/share/factory-v2/skills` sau khi chuyển đổi.
- Theo memory của phiên trước, main checkout có thay đổi chưa commit trong `orca.md` của v1. Kiểm tra và quyết định trước khi xoá reference Orca.
- Xoá `~/.claude/rules/smode-roles.md` là việc ngoài repo: chỉ làm khi người dùng đồng ý.
