Status: ready-for-agent

# `smode` và factory v2

Nguồn: [plan.md](plan.md) đã review, cùng kết quả spike trong [research/](research/).

## Problem Statement

Người dùng chạy skill trên nhiều harness (Claude Code, Codex, Oh My Pi) và chuyển sang chạy nhiều provider qua T3 Code (Claude, Cursor, Antigravity, …). Bộ skill hiện tại gặp ba vấn đề:

1. **Không có điểm vào chung.** Có 26 skill trong `core` và `software`. Mỗi skill tự kích hoạt theo `description` hoặc phải gọi tên. Agent không có một quy trình chung để biết tình huống nào thì dùng skill nào, theo thứ tự nào.
2. **Agent definition gắn với nền tảng.** Factory v1 cho worker giao bước cho role agent (`planner`, `implementer`, `verifier`, `review-*`) chỉ để chọn model. Agent được viết riêng cho Claude và cho OMP. Provider khác (Cursor, Antigravity) không nạp chúng. Mỗi lần đổi provider, model ghi trong agent lại lỗi thời. Trong khi đó factory vốn đã giao việc theo từng bước, và lúc giao việc là lúc chọn được model.
3. **Skill không tới được mọi provider.** T3 điều phối chung mọi provider, nhưng mỗi provider tự nạp skill theo cách riêng. Worker trên Cursor hay Antigravity không thấy skill của repo, nên những skill gọi nhau (`implement` gọi `tdd`, `code-review` gọi review) bị gãy.

## Solution

- **`smode`**: một **mode skill** do người dùng gọi, nằm trong plugin `software`. Nó đọc yêu cầu, chọn một **playbook** ngắn cho đúng tình huống, chép các bước vào todo list, rồi gọi các skill sẵn có ở từng bước. Bảng trigger trong `smode` thay cho việc trông vào `description`. `smode` tìm skill theo tên qua một skills index, nên vẫn chạy được khi harness không nạp skill đó. Cấu trúc học theo `poteto-mode` của pstack (MIT).
- **Model theo role, chọn lúc giao việc.** Mỗi máy có một cấu hình role → model cho từng harness. Bên giao việc truyền model khi sinh worker. Không cần agent definition.
- **Nội dung của các agent trở thành playbook** của `smode`: `plan-ticket`, `ticket`, `verify`, `review`.
- **Factory v2**: skill `factory-v2` mới trong plugin `factory`, nằm cạnh v1. v2 kế thừa ticket chain, merge guard, memory và 10 thao tác của v1. Mỗi bước của worker là một playbook của `smode`. Model đi theo role và quota. Lõi không phụ thuộc nền tảng. Lúc ra mắt chỉ có một **reference**, cho T3.
- **Factory v1 giữ nguyên**, cùng `software-claude`, `software-omp` và `references/orca.md`.
- **T3 chỉ là một reference.** Mọi chi tiết của T3 nằm trong `smode/harness/t3.md` và `factory-v2/references/t3.md`. OMP vẫn là harness hạng nhất của `smode`.

## User Stories

1. Là developer, tôi muốn một skill gọi ở đầu mọi việc kỹ thuật, để không phải nhớ skill nào trong 26 skill hợp với việc đó.
2. Là developer, tôi muốn `smode` nói lại mục tiêu của tôi và thay đổi nhỏ nhất nó dự kiến trước khi làm, để tôi bắt được hiểu lầm sớm.
3. Là developer, tôi muốn `smode` dừng lại và đưa bằng chứng khi bằng chứng loại trừ thay đổi tôi yêu cầu, để nó không làm sai thứ.
4. Là developer, tôi muốn `smode` chọn playbook hợp với việc của tôi (investigation, bug fix, feature, refactor, prototype, spec, ticket, spec run, verify, review, triage, pickup, retro, setup, factory), để công việc đi theo một quy trình đã biết.
5. Là developer, tôi muốn các bước của playbook được chép nguyên vào todo list, bước bị bỏ vẫn giữ kèm lý do, để tôi thấy việc nào đã làm, việc nào chưa.
6. Là developer, tôi muốn `smode` gọi các skill sẵn có (`tdd`, `diagnosing-bugs`, `code-review`, `pr`, `grilling`, `research`, …) ở đúng bước cần, để mỗi skill tiếp tục làm tốt phần của nó.
7. Là developer, tôi muốn `smode` có bảng trigger (kế hoạch chưa rõ thì `grilling`, thuật ngữ thì `domain-modeling`, viết code thì `tdd`, …), để skill đúng được gọi kể cả khi `description` của nó không khớp.
8. Là developer, tôi muốn `smode` giải câu hỏi kiểm được bằng thử nghiệm bằng skill `prototype` thay vì hỏi tôi, để tôi chỉ phải trả lời những quyết định về sản phẩm hay sở thích.
9. Là developer, tôi muốn `smode` tự làm việc đảo ngược được, và luôn dừng trước force-push nhánh chung, deploy, xoá dữ liệu hay nhắn khách hàng, để nó vừa nhanh vừa an toàn.
10. Là developer, tôi muốn `smode` gọi được skill ở plugin khác (`core`) và skill chỉ người dùng gọi (`implement`, `to-tickets`), để playbook dùng được mọi skill trong repo.
11. Là developer dùng Claude Code, tôi muốn `smode` chạy với plugin cài theo cách thường, để không phải cài thêm gì.
12. Là developer dùng Oh My Pi, tôi muốn `smode` chạy như trên Claude Code, để tôi tiếp tục dùng OMP.
13. Là developer dùng OMP, tôi muốn `smode` sinh worker từ agent đóng gói sẵn của OMP với model mà config của tôi gán cho role, để không cần agent definition.
14. Là developer, tôi muốn một cấu hình role → model cho mỗi máy và mỗi harness, do playbook `setup` của `smode` ghi, để đổi model ở một chỗ.
15. Là developer, tôi muốn role được mô tả bằng đặc tính cần có (suy luận sâu, rẻ và nhanh, độc lập với người viết code) thay vì tên model, để role không lỗi thời khi model đổi.
16. Là developer, tôi muốn reviewer và verifier chạy trên họ model khác với worker đã viết code, để việc kiểm tra thật sự độc lập.
17. Là developer, tôi muốn mỗi việc giao đi mới đều đến một worker mới, mang theo work order gốc, các chỉ thị sau đó và báo cáo trước đó, để không mất gì giữa các vòng.
18. Là developer, tôi muốn kiến thức của các agent `planner`, `implementer`, `verifier` và review hiện nay được giữ lại thành playbook, để v2 bỏ agent mà không mất gì.
19. Là developer, tôi muốn `code-review` mang quy tắc của từng trục trong brief giao cho subagent, để nó chạy như nhau dù có hay không có review agent.
20. Là developer, tôi muốn `smode` trả lời bằng ngôn ngữ mà `docs/agents/response-language.md` quy định, mỗi khẳng định ghi rõ là đo được, suy ra hay đoán, để tôi tin được điều mình đọc.
21. Là maintainer của repo, tôi muốn validator báo lỗi khi playbook nhắc một skill không tồn tại hoặc skills index đã cũ, để một lần đổi tên không âm thầm làm hỏng `smode`.
22. Là maintainer, tôi muốn validator báo lỗi khi tên tool của một harness xuất hiện ngoài `harness/` và `references/`, để T3 hay bất kỳ harness nào không lọt vào lõi.
23. Là maintainer, tôi muốn factory v1 không bị đụng tới trong lúc xây v2, để factory đang chạy vẫn chạy.
24. Là người vận hành factory, tôi muốn v2 là một skill riêng, có file cấu hình và thư mục memory riêng, để chuyển giữa v1 và v2 theo từng repo.
25. Là người vận hành, tôi muốn setup từ chối bật v2 trên repo đang bật lịch thức của v1, và ngược lại, để hai coordinator không tranh nhau một repo.
26. Là người vận hành, tôi muốn v2 giữ nguyên verdict status `factory/verify` và `factory/review`, để merge policy và branch protection không đổi.
27. Là người vận hành, tôi muốn mỗi bước worker của v2 chạy một playbook của `smode` (`plan-ticket`, `ticket`, `verify`, `review`) trên model mà route của role chọn, để các bước đi theo cùng quy trình như khi tôi làm tay.
28. Là người vận hành, tôi muốn coordinator bỏ qua route hết quota, và chạy lại bước thất bại vì quota trên route kế tiếp, để không bước nào phải chờ reset khi provider khác vẫn còn quota.
29. Là người vận hành, tôi muốn route bị chặn vì quota được ghi kèm giờ reset vào memory, để các lần thức sau bỏ qua route đó cho tới giờ reset.
30. Là người vận hành, tôi muốn chỉ provider đã qua smoke test mới được nhận việc, để provider không đọc được skill, không ghi được kết quả hay không push được không bao giờ nhận ticket.
31. Là người vận hành, tôi muốn worker trên provider không hỏi coordinator được thì báo `failed` kèm câu hỏi, để câu hỏi vẫn tới tôi qua một hold.
32. Là người vận hành trên T3, tôi muốn một watcher rẻ chỉ đánh thức coordinator khi GitHub có thay đổi hoặc đã qua một giờ, để những lần thức không có việc gần như không tốn gì.
33. Là người vận hành trên T3, tôi muốn worker xong, worker hỏi và sự kiện pull request đánh thức coordinator ngay, để nó phản ứng mà không chờ lần thức theo lịch.
34. Là người vận hành trên T3, tôi muốn mỗi bước bắt đầu từ một worktree mới dựa trên trunk hiện tại, để không worker nào làm trên base cũ.
35. Là người vận hành, tôi muốn smoke test của setup chứng minh mọi thao tác của interface và mọi provider trước lần chạy đầu, để tôi phát hiện lỗi setup trước khi một ticket thật phát hiện.

## Implementation Decisions

### Từ vựng

- Thuật ngữ mới trong glossary:
  - **Harness**: agent đang chạy một session (Claude Code, Codex, OMP, hay một session trong T3). Khác với agent manager.
  - **Mode skill**, **Playbook**, **Role**.
  - **Route**: danh sách ứng viên `provider/model` theo thứ tự cho một role.
- Hướng dẫn worker nhận vẫn gọi là **work order**. **Brief** vẫn là ghi chú gửi người.
- ADR-0003 ghi các quyết định:
  - một mode skill với các playbook;
  - model được chọn lúc giao việc;
  - skill được tìm theo tên qua index;
  - T3 là một reference;
  - factory v2 nằm cạnh một v1 đóng băng.
- `AGENTS.md` giữ quy tắc "Never name an agent's tools" cho skill và playbook, và cho phép nhắc tên tool trong `smode/harness/` và trong reference của factory.

### `smode`

- Skill do người dùng gọi, nằm trong plugin `software`, gồm:
  - `SKILL.md`, dưới 200 dòng;
  - thư mục `playbooks/` và `harness/`;
  - một skills index sinh tự động;
  - metadata cho Codex, tắt implicit invocation.
- Các phần của `SKILL.md`:
  - mở đầu nhiệm vụ: nói lại mục tiêu và thay đổi nhỏ nhất, dừng lại khi bằng chứng loại trừ thay đổi;
  - bảng trigger;
  - chạy một skill theo tên;
  - autonomy, kèm danh sách luôn dừng lại hỏi;
  - giao việc: mỗi việc một worker mới, model theo role, reviewer khác họ model với người viết code, work order trỏ tới đường dẫn tuyệt đối của `smode` và tên playbook;
  - viết trả lời: ngôn ngữ trả lời, nhãn bằng chứng;
  - mục lục playbook.
- **Chạy một skill theo tên**, theo thứ tự (S1):
  1. cách gọi gốc của harness, nếu harness đã nạp skill đó;
  2. bản checkout của repo;
  3. plugin đã cài của harness (`installPath` của `<plugin>@sanphan-skills`);
  4. bản sao marketplace của harness.

  Index ghi mỗi skill thuộc plugin nào. Đường dẫn cụ thể của từng harness nằm trong harness doc. Đọc file thì cũng chạy được skill chỉ người dùng gọi, loại mà tool skill của harness từ chối.
- **Playbook**: `investigation`, `bug-fix`, `feature`, `refactor`, `prototype`, `spec`, `plan-ticket`, `ticket`, `spec-run`, `verify`, `review`, `triage`, `pickup`, `retro`, `setup`, `factory`. Mỗi file dài 10 đến 30 dòng và ghi tên các skill nó gọi.
  - `plan-ticket` mang khuôn kế hoạch của agent `planner`: Decisions, Change map, Interfaces, Tests, Verify (có kiểm môi trường tới được không), Door, Questions, Split.
  - `ticket` mang phần tự kiểm của agent `implementer`: chạy đủ bộ test, so lỗi typecheck với base, so file thay đổi với plan, mỗi tiêu chí một test, ghi handoff mâu thuẫn và deviations.
  - `verify` mang quy tắc của agent `verifier`: pass, fail, unverified; test xanh không phải là verdict; mỗi lúc chỉ một lệnh trên tài nguyên khan hiếm.
  - `review` chạy `code-review`. Skill này nhận thêm quy tắc từng trục của các review agent.
  - `factory` chuyển sang skill `factory-v2`.
- **Harness doc**: mỗi file `claude-code`, `omp`, `codex`, `t3` là một bảng ánh xạ cho các việc: sinh worker, chọn model và effort, worktree riêng, hỏi người, lên lịch, theo dõi pull request. Mỗi file cũng ghi việc gì bỏ qua khi harness không có tính năng tương ứng. Trên mọi harness, chế độ chỉ đọc là một quy tắc ghi trong work order, không bao giờ là một mode (S4).
- **Harness OMP**:
  - Worker sinh từ agent đóng gói `task`, `scout` hoặc `reviewer` của OMP.
  - Model theo từng lần gọi là `provider/model` chính xác mà role trỏ tới trong config của user. Lý do: OMP từ chối alias role, và chỉ duyệt model do role ở cấp user đặt tên (S6).
- **Harness T3**: work order ghi đường dẫn tuyệt đối tới skill và file kết quả. Khi tool file của provider từ chối đường dẫn ngoài workspace (Antigravity), đọc và ghi bằng shell (S3).

### Role và setup

- `ROLES.md` thêm các role của `smode`: `scout`, `worker`, `thinker`, `reviewer`, `coordinator`. Mỗi role được mô tả bằng đặc tính, kèm quy tắc `reviewer` khác họ model với `worker`.
- Playbook `setup` ghi cấu hình role của máy:
  - Claude Code: một file rules luôn được nạp;
  - OMP: config cấp user, theo `templates/roles.omp-config.yml`;
  - T3: route nằm trong file của harness đang chạy coordinator.

  Mỗi lần chạy ghi đè toàn bộ file.

### Factory v2

- Skill mới `factory-v2` trong plugin `factory`. v1 không bị sửa.
- **Giữ từ v1**: ticket chain, merge guard, stop the line, humans và hold, limits, events, bố cục memory, 10 thao tác của interface, JSON kết quả, tên verdict status.
- **Đổi**:
  - Phần role trong mỗi work order bảo worker chạy một playbook có tên của `smode` theo đường dẫn tuyệt đối. Không còn dòng delegation.
  - **Routing**: start-worker nhận thêm model. Coordinator lấy model từ route của role, chỉ giữ ứng viên thoả cả ba điều kiện: đã qua smoke test cho provider (`providers.md`), được manager báo là dùng được, và không bị chặn trong `quota.md`.
  - **Quota**: worker thất bại vì giới hạn dùng thì route đó bị chặn tới giờ reset ghi trong câu lỗi, hoặc 1 giờ khi không có. Bước đó chạy lại một lần trên ứng viên kế tiếp và không tính là thất bại. Khi mọi ứng viên đều bị chặn, bước đó chờ, và journal ghi chờ tới bao giờ.
  - Cấu hình ở `docs/agents/factory-v2.md`. Memory ở `~/.local/share/factory-v2/<repo>`. Setup có thể nhập wiki của v1.
  - Một coordinator cho mỗi repo: setup từ chối khi lịch thức của bản kia đang bật.
  - Smoke test của setup thêm bước kiểm từng provider:
    - đọc một skill theo đường dẫn;
    - ghi kết quả ra ngoài repo;
    - push bằng `HEAD:<branch>` (chạy dry run trong setup);
    - hỏi coordinator (ghi lại hỏi được hay không);
    - thư mục làm việc và `git status` nằm trong worktree của mình.
- **`references/t3.md`** (reference duy nhất lúc ra mắt):
  - Mỗi bước là một `delegate_task` mới, trong worktree riêng.
  - Coordinator là một thread cố định, ghi trong memory index, vì task thuộc về thread cha.
  - Trước mỗi lần giao việc thì fetch và fast-forward trunk, vì worktree bắt đầu từ HEAD của coordinator.
  - Push bằng `HEAD:factory/<n>-<slug>`, vì T3 đổi tên nhánh tạm.
  - Worker chạy full access, vì yêu cầu duyệt quyền không được chuyển cho coordinator.
  - Đóng workspace bằng `git worktree remove` sau push check, rồi archive thread.
  - Thức dậy (S2): một thread watcher dùng `schedule_task`, chế độ fresh session, chạy role scout. Watcher chạy fingerprint, kiểm hàng đợi của coordinator, rồi gửi một lệnh `once`. Worker xong, worker hỏi và theo dõi pull request thì đánh thức coordinator trực tiếp.
  - Quota: đọc câu lỗi trong child thread, vì T3 chỉ đưa câu báo lỗi cho agent (S5).

## Testing Decisions

- Hành vi nằm trong prose (playbook, playbook của factory, work order) không có unit test. Nó được chứng minh bằng cách chạy: chạy `smode` bằng tay, smoke test của setup v2, và một lần chạy đầu cuối trên repo này (ADR-0002).
- Quy tắc chính xác trên dữ liệu có cấu trúc được test ở CLI, tại seam sẵn có: `cli/repo.mjs validate` và `cli/repo.test.mjs` với repo fixture. Đây là cách các test hiện có kiểm key của skill dùng chung, agent theo nền tảng và version của manifest. Các kiểm tra mới:
  - skills index liệt kê mọi skill trong `core`, `software` và `factory`, mỗi skill kèm plugin của nó, và file sinh ra trùng với file đã commit;
  - mọi skill mà playbook nhắc tới đều tồn tại;
  - tên tool của harness (trước hết là tên tool T3) chỉ xuất hiện trong `harness/` và `references/`;
  - frontmatter của `ROLES.md` có các role mới, mỗi role có giá trị cho từng nền tảng.
- Test tốt đưa cho validator một repo fixture nhỏ rồi kiểm các lỗi nó báo. Không test hàm nội bộ.
- `npm run validate` và `npm test` phải pass sau mọi ticket.

## Out of Scope

- Xoá agent trong `software-claude` và `software-omp`, hoặc gỡ factory v1.
- `factory-v2/references/orca.md`, và OMP làm worker hay coordinator của factory v2.
- Các skill principle, `swarm`, `arena` và `interrogate` của pstack.
- Plugin cho Cursor hoặc Antigravity.
- PR cho t3code để đưa quota và loại lỗi tới agent.
- Thay đổi rule trong `software-omp`.

## Further Notes

- Kết quả spike: [research/s1-skill-paths.md](research/s1-skill-paths.md), [research/s2-s5-s6.md](research/s2-s5-s6.md), [research/s3-s4-providers.md](research/s3-s4-providers.md).
- pstack (cursor/plugins, MIT, Lauren Tan) được credit trong `UPSTREAM.md`, mục Other sources.
- Bố cục cài đặt của Claude Code cho `smode` mới là suy ra, vì máy thử chưa cài marketplace này cho Claude Code. Ticket nghiệm thu sẽ cài nó và kiểm thứ tự tìm skill ở đó.
