# Factory: mỗi ticket một coordinator — đối chiếu brief và kế hoạch sửa (bản 12, đã được duyệt)

Bản 12 đã đưa vào các điểm của mười vòng review do Antigravity viết: `scratchpad/review/review-1.md` (ký hiệu `[R#]`), `review-2.md` (`[S#]`), `review-3.md` (`[T#]`), `review-4.md` (`[U#]`) `review-5.md` (`[V#]`), `review-6.md` (`[W#]`), `review-7.md` (`[X#]`), `review-8.md` (`[Y#]`), `review-9.md` (`[Z#]`) và `review-10.md` (`[AA#]`). Vòng 11 (`review-11.md`) kết luận `approve`, chỉ còn một ghi chú low (`[AB1]`), đã đưa vào.

## Context

Lần chạy factory thật trên `gia-pha-studio` (2026-11-26/27) cho thấy thiết kế một coordinator dùng mãi có bốn vấn đề:
- context phình dần;
- wake rỗng mỗi giờ (8 wake Opus liên tiếp);
- mỗi bước một worktree, mỗi lần lại `pnpm install`;
- lịch sử của một ticket bị rải qua nhiều wake.

Brief đề xuất kiến trúc mới: watcher → dispatcher (mỗi lần chạy một thread mới) → mỗi ticket một coordinator có worktree riêng → các worker dùng chung worktree đó. **Chưa sửa file nào trong repo.**

Quyết định đã chốt sau brief:
- **Merge queue:** luôn cập nhật nhánh theo trunk trước khi merge, và giữ `merge` suốt lúc verify và review chạy lại. Có thêm đường tắt cho trường hợp nhánh đã chứa trunk (mục 1.4).
- **INTERFACE.md trung lập với manager.** `references/t3.md` chỉ ánh xạ sang tool T3.
- **Model:** watcher và dispatcher chạy route `scout`, coordinator theo ticket chạy route `coordinator`. Bỏ dòng `Coordinator:` trong `factory.md`; `setup` tự chuyển file cũ.
- **Setting mới `Max tickets`**, mặc định bằng `Max workers`.
- **Comment yêu cầu sửa code** của owner hoặc collaborator không tính vào `Fix rounds`.
- **Không thêm label mới; bỏ `factory:active` của brief.** Label không chống được claim trùng (gắn label không atomic). Một label trạng thái là nguồn sự thật thứ hai, sẽ lệch với memory, và mỗi lần gắn hay gỡ lại làm đổi fingerprint. Bộ skill đã có sẵn các triage role (`ready-for-agent`, `ready-for-human`, …) trong `triage-labels.md`. Claim nằm trong memory; người nhìn thấy qua comment `## Factory claim`.

- **Thay `factory:hold` bằng triage role `ready-for-human`**, giống cách tracker Jira và local đang hold. Mọi tracker dùng chung một luật, và factory không còn label riêng nào (chi tiết ở mục 1.13). Các label `priority:p*` giữ nguyên: đó là quy ước của tracker, không phải trạng thái của factory.

## 1. Thiết kế đã chỉnh, so với brief

### 1.1 Khớp với skill hiện tại, giữ nguyên
- Coordinator chỉ điều phối, không đọc diff (`PLAYBOOK.md:5`).
- Mỗi bước là một `delegate_task` mới trên route của role, kèm Routing và Quota.
- Verdict là status trên đúng head commit, merge bằng `--match-head-commit`. Giữ Fix rounds, hold và brief.
- Watcher là thread rẻ, mỗi lần chạy một session mới.
- Giữ `Max workers`, `Scarce resources` và No collisions (`PLAYBOOK.md:126-129`). Riêng Finish before start (`PLAYBOOK.md:128`) chỉ còn dùng để xếp thứ tự claim. Hàng đợi tài nguyên là FIFO thuần [R12].
- Bảng Ticket chain vẫn đúng. Mỗi turn đọc trạng thái ticket từ tracker và GitHub.

### 1.2 Mâu thuẫn, phải viết lại
| Chỗ hiện tại | Thiết kế mới |
|---|---|
| `INTERFACE.md:34` "One coordinator per repository" | Mỗi ticket đã claim có một coordinator; tại một thời điểm chỉ một dispatcher chạy |
| `t3.md:7-8`: coordinator là một thread dùng mãi, chạy ở project root | Coordinator theo ticket, chạy trong worktree riêng |
| `t3.md:17-18`: mỗi bước một worktree, chuyển việc qua `fetch` rồi `reset --hard origin/<branch>`; `WORK-ORDERS.md:29`: switch rồi `pull --ff-only` | Mỗi ticket một worktree, worker dùng `isolation: "shared"` [R12] |
| `t3.md:10`: bật cleanup "after the thread settles" | Tắt chế độ đó, chỉ bật "after merging" |
| `t3.md:40`: wake khi fingerprint cũ hơn 1 giờ | Bỏ, thay bằng cơ chế due (mục 1.3) |
| `SKILL.md:17`: session gõ `run` thành coordinator | `run` chỉ lập lịch watcher; `once` là một lần chạy dispatcher |
| `MEMORY.md:3` "only writer"; `MEMORY.md:16` commit mỗi wake | Nhiều người ghi, nhưng chỉ dispatcher commit (mục 1.5) [R12] |
| `t3.md:24`: close-workspace bằng `git worktree remove` | T3 dọn sau khi merge; dispatcher quét làm lưới cuối [R12] |
| Resume test (`t3.md:80-84`) | Revive bằng `existing_worktree` |
| `SETUP.md` dòng `Coordinator:` | Bỏ, dùng route `coordinator` |
| `ADR-0002`: coordinator sống lâu | Cần ADR mới |
| `PLATFORMS.md:91-130`, `README.md:18`, mô tả ở `SKILL.md:3` | Đều tả thiết kế cũ, phải viết lại [R18] |

### 1.3 Đánh thức (liveness) [R1, R2, R14; S5, S11; T1, T4]
- **Due**, ghi trong hồ sơ máy đọc (mục 1.5):
  - **Bật** khi ticket ở `running`, tức là đang chờ một worker hoặc chờ `Required checks`. Giá trị là `now + Wake timeout`. Due cũng được bật khi dispatcher launch coordinator và khi có người đánh thức coordinator.
  - **Xoá** (`null`) khi ticket chuyển sang `held`, `waiting`, `parked`, hoặc Close. Ticket đang chờ người hay chờ ticket khác thì không sinh wake nào [T1].
  - **Bước bị chặn vì mọi candidate của route đều hết quota:** coordinator nhả mọi tài nguyên đang giữ, rồi đặt due bằng mốc `blocked until` sớm nhất của route đó, không phải `now + Wake timeout`. Coordinator kiểm route còn candidate chạy được trước khi xin tài nguyên [U11, V3].
  - **Due riêng của dispatcher:** quota hết hạn chặn, CI trunk đang chạy hoặc chưa báo, và **hạn giữ tài nguyên đã quá**. Nguồn cuối cùng này bắt được holder đang park mà đã chết [U1].
  - **Người đầu hàng:** tính là tới hạn khi có thể cấp tài nguyên cho họ (`free >= queue[0].count`) nhưng chưa ai báo, hoặc đã báo quá 5 phút mà họ chưa nhận [S5].
- **Dispatcher xử lý due đã quá của một coordinator còn sống** bằng cách gửi tin đánh thức nó, rồi bật lại due. Chính coordinator mới inspect được worker của mình (task của thread nào thuộc thread đó). Vì vậy coordinator xử lý worker blocked và Unknown CI như **Humans** và **Stop the line** đã nói. Dispatcher không tự inspect worker [T1].
- **Watcher gọi dispatcher khi** fingerprint của board khác bản đã lưu **hoặc** `resources.mjs due` báo có mục tới hạn. Watcher không gọi khi lock `dispatcher` còn hạn **và** thread trong lock vẫn đang chạy, hoặc khi đang `paused` mà không ticket nào có worker sống [S11, U9].
- **Fingerprint của board** gồm issue và PR như hiện tại, cộng trạng thái các `Trunk checks` trên head của trunk. Bỏ `results/` khỏi fingerprint.
- **Ai ghi fingerprint:** `wake-check.sh` chỉ đọc. Dispatcher chụp hash lúc bắt đầu đọc board, và ghi `wake-fingerprint` khi chạy xong, ngay trước lúc nhả lock [S5].
- **Lock `dispatcher`** do **người launch dispatcher** giữ, gồm watcher, `once` và `resume` [T4]:
  - Người launch lấy lock (có hạn giữ `Wake timeout`) **trước** khi launch, rồi ghi ngay id thread vừa nhận vào lock.
  - Dispatcher nhả lock khi xong.
  - Ở lần sau, nếu lock quá hạn hoặc thread trong lock đã fail: đọc `error` của thread đó. Có dấu hiệu quota thì chặn candidate `scout` đó, thu hồi lock, rồi launch trên candidate `scout` kế tiếp.

  Cách này bắt được cả dispatcher chết ngay ở turn đầu vì hết quota.
- **Candidate `scout`** được chọn là candidate đầu tiên có `PASS` và chưa bị chặn quota. Nếu chính watcher hết quota thì chấp nhận, ghi là giới hạn đã biết.

### 1.4 Tài nguyên và Land [R3, R11, R15; S4, S8, S9; T2, T13]
- **Tài nguyên:** `slot` (tổng bằng `Max workers`), các mục trong `Scarce resources`, và `merge` (1).
- **Thứ tự toàn phần:** `slot` → các scarce resource xếp theo tên → `merge`. Script từ chối mọi lần xin sai thứ tự.
- **FIFO chặn đầu hàng:** người cần 2 slot không bị người cần 1 slot chen lên trước.
- **Hạn giữ và thu hồi:**
  - Coordinator gia hạn ở mỗi turn. Dispatcher cũng gia hạn cho mọi coordinator còn sống, kể cả coordinator đang park.
  - `resources.mjs` không bao giờ tự thu hồi theo đồng hồ. Hạn giữ quá chỉ sinh due cho dispatcher (mục 1.3) [U1].
  - Chỉ khi thread đã chết hoặc đã fail, dispatcher mới gọi `reclaim <ticket>`, lệnh nhả mọi tài nguyên của ticket. Không có thời hạn park tối đa [S8, T13].
- **Cổng trước Land**, kiểm theo đúng thứ tự dưới đây. Cổng chạy lại sau lần `git fetch origin` ở bước 3, trước bước 4. Mọi lối ra của cổng đều nhả tài nguyên đang giữ trước [T2, U4, V1]:
  1. Ticket hoặc PR đã có `ready-for-human`: hold như thường. Nếu chỉ PR mang role, gắn thêm role lên ticket để bước gỡ hold chờ người trả ticket về. `state` thành `held`, due bị xoá, flag-human. Không đăng brief lần hai nếu đã có [W3].
  2. `Required checks` của head:
     - `PENDING`: bật due, kết thúc turn, chờ watch-pr;
     - fail: Rework;
     - Unknown CI: đăng brief như ở **Stop the line**.
  3. Hold theo chính sách: `Auto-merge: off`; door `one-way` hay blast radius không được phép mà người chưa duyệt (người đã duyệt thì merge, `PLAYBOOK.md:55`); protected path; PR sửa trunk. Hold ngay, không cập nhật nhánh, không chờ trunk. PR sửa trunk qua cổng này trước cổng 4, nên không bị kẹt khi trunk đỏ.
  4. Trunk đỏ: `state` thành `waiting`, `waitingOn: [trunk]`, chờ. Không merge trunk vào nhánh, không tính là Rework hay Hold. Dispatcher đánh thức ticket ở bước đánh thức người chờ, ngay khi trunk hết đỏ: xanh, đang chạy, hoặc unknown (`PLAYBOOK.md:89,96`).
- **Land:**
  1. Xin `merge`, rồi `git fetch origin` [S4].
  2. Nhánh đã chứa `origin/<trunk>` (`git merge-base --is-ancestor`): kiểm Merge guard, merge, rồi nhả.
  3. Trunk đã đi tiếp: nhả `merge`. Xin `min(2, Max workers)` slot, rồi các scarce resource mà verify cần, rồi `merge`. Chạy `git fetch origin` lần nữa.
  4. `git merge-tree --write-tree HEAD origin/<trunk>` để biết có conflict không, mà không đọc diff.
     - Sạch: worker `build` merge trunk vào nhánh, không tính vòng.
     - Có conflict: nếu đã chạm `Conflict rounds` thì hold. Nếu chưa, tăng `conflictRounds` rồi giao work order gỡ conflict [S9].
  5. Cổng reset, rồi verify ‖ review trên head mới; khi chỉ có 1 slot thì chạy lần lượt. Verify và review pass thì nhả `slot` và scarce resource. Sau đó chờ `Required checks` trên head mới, vẫn giữ `merge`. Đang `PENDING` thì bật due và chờ, không coi là fail. Gặp Unknown CI thì nhả `merge` trước khi đăng brief [T2, U4].
  6. Kiểm Merge guard, merge, rồi nhả hết.
  7. Mọi lối ra khác merge đều nhả ngay mọi tài nguyên rồi chuyển sang Rework hoặc Hold: build fail, hỏi, hoặc chạm giới hạn; verify `FAIL` hoặc vẫn `UNVERIFIED`; review `fail`; `Required checks` fail; Merge guard fail. Riêng trunk đỏ khi kiểm Merge guard, ở bước 2 hay bước 6, thì nhả hết và chờ trunk như cổng 4, không Rework, không Hold [W5].
- **Hold** nhả mọi tài nguyên, chỉ giữ lại worktree và claim.
- **Ai đánh thức người đầu hàng:** người nhả tài nguyên gửi tin cho họ. Due của người đầu hàng là lưới an toàn.

### 1.5 Memory có nhiều người ghi [R6, R17; S11, S12; T6, T16]
- **Hồ sơ máy đọc `state/tickets/<n>.json`**, chỉ ghi qua hàm cập nhật có lock của `resources.mjs`. `comments.mjs ack` cũng gọi hàm đó [U8]. File này cũng chính là claim, không còn thư mục `claims/` [T16]. Nó chứa:
  - `claimed`, `claimedAt`;
  - thread, worktree, nhánh, PR;
  - task đang sống và childThreadId;
  - `reworkRounds`, `conflictRounds`;
  - `files_to_change`, `planCleared`;
  - `state`: `running | parked | waiting | held | closed_unmerged`, kèm `parkedOn` hay `waitingOn`;
  - due;
  - id của các comment đã ack.

  `planCleared` tách riêng khỏi `state`, nên ticket đang park hay hold vẫn được tính khi kiểm collision [T6].
- **Phần tường thuật `tickets/<n>.md`**: coordinator là người ghi duy nhất, chỉ để người đọc lại.
- **Lessons:** dispatcher ingest từ `results/*.json`, file không bao giờ bị sửa sau khi ghi, theo một watermark riêng của nó [S11].
- **Trạng thái `running` hay `paused`** nằm ở `state/status.json`, ghi qua `resources.mjs` [S11].
- **`quota.md`** chỉ ghi qua `resources.mjs`, có lock, giữ nguyên định dạng dòng để `roles.mjs:138-142` vẫn đọc được.
- **Dispatcher** là người ghi duy nhất cho `journal.md`, `wiki/` và `index.md`, và là người duy nhất commit memory folder.
- **`.gitignore`**: `resources/`, `state/`, `evidence/`, `*.lock`, `*.tmp`, `wake-fingerprint`. Evidence của một ticket bị xoá khi Close hoặc khi quét.
- Lock bằng `mkdir`. Lock bỏ lại sẽ bị phá dựa vào pid và mtime. Script chỉ dùng built-in của Node, giống `roles.mjs:12`.

### 1.6 Claim, khởi động và hồi sinh [R4, R9; S2, S10; T3]
- **Thứ tự việc của dispatcher:**
  1. Đọc `state/status.json`.
  2. **PR của ticket đã merge** (kể cả khi GitHub tự đóng ticket nhờ `Closes #<n>`, `WORK-ORDERS.md:31`): không phải bỏ ticket. Nếu coordinator đang `running` với due chưa quá thì bỏ qua: nó đang tự chạy Close. Ngược lại, ghi `running` cùng due như ở bước 4 và 5, rồi đánh thức coordinator để nó chạy Close nhánh đã merge (mục 1.7); coordinator đã chết thì revive để chạy Close [Z1, AA1]. Còn lại, ticket đã đóng mà PR không merge, hoặc ticket `wontfix`, ở bất kỳ `state` nào: nhả claim và tài nguyên. Coordinator còn sống thì gửi tin đánh thức để nó tự dọn. Coordinator đã chết thì dừng worker sót lại và để bước quét lo worktree. Bước này chạy trước revive, để không hồi sinh một ticket đã bỏ [U5, V5].
  3. Revive.
  4. Gỡ hold.
  5. Đánh thức người chờ (kể cả người chờ trunk) và coordinator có due đã quá.

  Trước khi gửi tin đánh thức ở bước 2, 4 và 5, dispatcher ghi một lần qua `resources.mjs` [V4, W2, AA1]:
  - ticket `held` vừa gỡ hold, ticket `waiting` mà `waitingOn` đã rỗng (gỡ các thứ đã xong khỏi `waitingOn` trước), và ticket `running` có due đã quá: đặt `state` thành `running`, xoá `waitingOn`, đặt due bằng `now + Wake timeout`;
  - người đầu hàng đợi đang `parked`: chỉ đặt `queue[0].notifiedAt = now`, giữ `state` là `parked`. Coordinator tự `acquire` khi thức dậy.

  Ticket vừa được đánh thức vì thế được tính đúng vào `Max tickets`, và lần dispatcher sau không đánh thức nó lần nữa.
- **Stop the line chạy trước bước claim mới**, theo `PLAYBOOK.md:14`, và vẫn bị bỏ qua khi `paused`. **Ticket sửa trunk** (tối đa một ticket, `PLAYBOOK.md:95`) không bị giới hạn bởi `Max tickets`, để nó luôn được claim kể cả khi mọi chỗ đang bị các ticket chờ trunk chiếm [W1].
  6. Quét worktree. Chạy trước bước claim, để ticket được làm lại không đụng worktree hay nhánh cũ [U3].
  7. Claim mới.

  Khi đang `paused`: bỏ qua bước 4, 5 và 7 cùng Stop the line; chỉ còn revive và đánh thức các ticket có worker đang sống, gia hạn, ghi journal, commit, quét, nhả lock [S2, U2].
- **`Max tickets`** chỉ đếm ticket có `state` là `running`, `parked` hoặc `waiting`. Ticket `held` giữ claim và worktree nhưng không chiếm chỗ.
- **Claim:**
  1. Kiểm route `coordinator` còn candidate chạy được.
  2. Ghi `claimed` vào hồ sơ.
  3. Launch coordinator, tiêu đề `factory #<n> <slug>`.
  4. Ghi thread id.
  5. Đăng comment `## Factory claim` kèm link tới thread. Comment là lịch sử, không cần dọn.
- **Claim dở dang** (đã `claimed` mà chưa có thread): tìm thread tiêu đề `factory #<n>`, chưa settle, chưa archive, và được tạo từ `claimedAt` trở đi. Thấy thì nhận thread đó; không thấy thì launch như thường [S10, U9].
- **Ticket đã có PR mở** (`PLAYBOOK.md:32`): launch với `baseRef: origin/<pr_branch>` và `branch: <pr_branch>`. PR đến từ fork thì hold kèm brief. Ngoài trường hợp đó, launch từ `origin/<trunk>` với nhánh `factory/<n>-<slug>`. Nếu `git ls-remote origin` cho thấy tên đó đã có, dùng hậu tố chưa ai dùng đầu tiên: `-2`, `-3`, … [V7].
- **Hồi sinh**, theo thứ tự [T3]:
  1. Đọc `error` của thread đã chết. Có dấu hiệu quota thì chặn candidate đó.
  2. Worker cũ còn chạy thì chờ nó kết thúc hoặc dừng nó.
  3. `reclaim <n>`: nhả mọi tài nguyên của ticket và xoá task cũ khỏi hồ sơ.
  4. Launch coordinator mới trên `existing_worktree`. Nếu chỉ cần hồi sinh để chạy Close nhánh đã merge mà worktree đã bị T3 dọn, launch ở project root: Close không cần worktree (mục 1.7). Ticket C chốt chi tiết này theo kết quả spike 4 và 8 [AB1].
- **Turn đầu của mọi coordinator:** nếu ticket đã có PR (do hồi sinh, do claim một PR có sẵn, hay do chuyển đổi), gọi link-pr và watch-pr trước mọi việc khác [T3].
- **Đầu mỗi turn**, kiểm theo đúng thứ tự [Z1, AA1]:
  1. Ticket không còn claim, hoặc claim thuộc thread khác: settle ngay. Không chạy Close, không nhả claim hay tài nguyên của người khác.
  2. PR của ticket đã merge: chạy Close nhánh đã merge (mục 1.7), kể cả khi GitHub đã tự đóng ticket. Close chạy lặp lại không sao: handoff đã đăng thì không đăng lại.
  3. Ticket đã đóng mà PR không merge, hoặc `wontfix`: coordinator tự dọn rồi settle [T12, U5]:
  - dừng worker còn sống;
  - nhả tài nguyên còn giữ;
  - clear flag-human;
  - unwatch-pr;
  - settle.
- **Đang `paused`:** coordinator xử lý sự kiện rồi dừng, không bắt đầu bước mới, và xoá due. Khi chuyển sang `running`, dù do `resume` hay `run`, `resources.mjs` làm hai việc [U2, V2]:
  - đặt due bằng `now` cho mọi ticket `running` không có worker sống và đang có `due == null`. Due đặt theo mốc quota thì giữ nguyên;
  - xoá `notifiedAt` của người đầu mỗi hàng đợi.

  Lần dispatcher kế tiếp sẽ đánh thức ngay các ticket đó.

### 1.7 Close [R4, R10; S3; T7]
- **Đã merge:**
  - đăng `## Handoff` (nếu chưa có), đóng ticket (nếu chưa đóng);
  - xoá nhánh remote, nhả tài nguyên, nhả claim. Người chờ ticket này được dispatcher đánh thức ở lần chạy kế tiếp (mục 1.10); việc merge đã làm đổi fingerprint nên lần chạy đó đến ngay [X2];
  - clear flag-human, unwatch, rồi settle [AA2].

  Mọi lệnh sau khi merge chạy bằng `gh -R <owner>/<repo>` từ memory folder.
- **Đóng mà không merge:**
  - không đăng handoff, không đóng ticket;
  - đăng brief hỏi đóng hẳn hay làm lại, đặt ticket sang `ready-for-human`;
  - nhả tài nguyên và claim, unwatch. Người chờ do dispatcher đánh thức, như trên [X2];
  - khi head của PR đã nằm trong `refs/pull/<pr>/head` và nhánh có dạng `factory/*`, xoá nhánh remote. Nhánh không phải `factory/*` thì giữ nguyên. Lần làm lại tự chọn tên nhánh chưa dùng (mục 1.6) [U3, V7];
  - ghi `closed_unmerged`, clear flag-human, rồi settle [AA2].

  Worktree để dispatcher quét sau, không tự xoá worktree mình đang đứng. close-workspace xoá cả worktree lẫn nhánh local. Người trả ticket về `ready-for-agent` thì dispatcher claim lại từ đầu.
- **Push check khi PR đã merge hoặc đã đóng** (`INTERFACE.md:32` mở rộng): `git status --porcelain` rỗng, và HEAD nằm trong `refs/pull/<pr>/head` (`git fetch origin refs/pull/<pr>/head`, rồi `git log FETCH_HEAD..HEAD` rỗng). Như vậy vẫn qua được khi nhánh remote đã bị xoá [T7].

### 1.8 Cổng reset [R7; S13]
- Chạy một lần trước mỗi bước. Với cặp verify ‖ review thì chạy một lần trước cả cặp.
- Trình tự:
  1. `git fetch origin`.
  2. Nếu `origin/<branch>` đã có: `git log origin/<branch>..HEAD` phải rỗng. Nếu chưa có: `git log origin/<trunk>..HEAD` phải rỗng. Không đạt thì dừng, vì đó là việc chưa push.
  3. Đứng trên nhánh, rồi `git reset --hard origin/<branch>` (hoặc về head hiện tại khi nhánh chưa push). Commit mà người tự push lên PR được kéo về bằng fast-forward [U7].
  4. `git clean -fdx`, giữ các đường dẫn trong `Reset keeps:`.
- Verify ghi evidence vào `<memory>/evidence/<n>/`.
- File untracked do verify tạo trong lúc chạy song song không phải finding. Bước kiểm `git status` sau worker (`t3.md:74`) chỉ chạy khi không còn worker anh em nào chạy trong cùng worktree.

### 1.9 Comment của người [R5; S6; T5, T15]
- `scripts/comments.mjs` có hai lệnh, `fetch` (chỉ đọc) và `ack <ids>`.
- **`fetch --issue <n>`** (khi tracker là GitHub) và **`--pr <n>`** (khi đã có PR). Đọc bốn nguồn [T5]:
  - `/issues/<issue>/comments` (ticket);
  - `/issues/<pr>/comments` (cuộc hội thoại trên PR);
  - `/pulls/<pr>/reviews` (dùng `submitted_at`);
  - `/pulls/<pr>/comments` (comment inline).
- **Id** có namespace `issue:`, `review:`, `inline:`. Comment của issue và của PR dùng chung không gian id `issue:`. Mỗi mục được gắn nhãn nơi đăng: `ticket` hay `pr`.
- **Mốc `since`** là `claimedAt`, ghi một lần, không đổi về sau. Comment đã ack bị loại [T15].
- **Lọc tác giả:** giữ người có quyền `admin`, `maintain` hoặc `write`. Mọi phản hồi khác 200, như 404 của bot, coi là không tin được. Bỏ comment do factory đăng (heading `## Factory …`) và comment của skill `triage`.
- Coordinator chỉ gọi `ack` sau khi đã xử lý xong. Chỉ phần đã qua lọc mới vào context của coordinator.
- Tracker Jira và local: câu trả lời cho hold đọc theo tài liệu tracker như hiện tại. Script chỉ lọc phía GitHub.

### 1.10 Collision [R11; S12; T6, T14]
- Kiểm sau bước plan bằng một lệnh atomic, chạy dưới lock: `resources.mjs check-plan <n> --files … --open-prs …`.
  - So với các PR đang mở và các ticket có cả `claimed` lẫn `planCleared`, trừ chính ticket `<n>` và PR của nó. Nhả claim thì `planCleared` cũng bị xoá [W4, AA3].
  - Không trùng: đặt `planCleared` rồi đi tiếp.
  - Trùng: `state` thành `waiting`, ghi những gì đang chặn vào `waitingOn`.
  - Không cần luật phân xử theo số ticket, vì lock đã xếp các lần kiểm thành hàng [T14].
- Có thể chờ nhiều thứ cùng lúc, kể cả PR không do factory mở. Dispatcher gỡ một thứ khỏi `waitingOn` khi nó không còn mở hay không còn được claim (đã merge, đã đóng, hoặc `claimed: false`), và đánh thức người chờ khi `waitingOn` rỗng [W4].
- Hết chờ: **chạy lại `check-plan`** trước. Trùng lần nữa thì quay lại `waiting`. Lần kiểm đặt được `planCleared` thì: nếu chưa push gì, `git fetch origin && git reset --hard origin/<trunk>`, rồi build [Y1, Z2]. Nhờ vậy, hai ticket cùng chờ một thứ không build chồng lên nhau, và PR mới mở trong lúc chờ cũng được tính [Y1].

### 1.11 Lệnh của người [R19; T8]
- `SKILL.md` thêm ba mode `pause`, `resume` và `stop`, gõ được từ bất kỳ thread nào ở project root. Cả ba ghi qua `resources.mjs`:
  - `pause` ghi `paused`;
  - `resume` ghi `running`, rồi chạy dispatcher một lần (lấy lock như ở 1.3);
  - `stop` xoá lịch của watcher và ghi `paused`.
- `run` ghi `running` khi lập lịch watcher, cùng một bước chuyển trạng thái như `resume` (mục 1.6) [T8, V2].
- Mọi coordinator đọc trạng thái này ở đầu mỗi turn.

### 1.12 Phần còn lại
- **Dispatcher** lo Stop the line: chạy lại CI, mở ticket sửa trunk, viết brief cho Unknown CI của trunk. Unknown CI của một PR do coordinator của ticket đó lo, khi due của nó được đánh thức.
- **Dispatcher tự archive khi xong.**
- **Coordinator được snooze ngay khi tạo.**
  - flag-human: unsnooze, pin, rồi rename `⏸ #<n>`.
  - Clear: unpin, rename lại như cũ, rồi snooze [T9].
- **Quét worktree** chỉ xoá worktree có trong hồ sơ của factory, đã nhả claim (`claimed: false`: gồm ticket đã đóng, `wontfix`, `closed_unmerged`, PR đã merge), có thread đã settle hoặc đã chết, và qua push check (mục 1.7) [V5]. Lệnh xoá chạy từ project root. Không bao giờ chọn worktree theo commit [R21].
- **Gỡ conflict:** `WORK-ORDERS.md` có một biến thể của `build`. Conflict chạm protected path, hoặc làm đổi ý nghĩa của ticket khác, thì worker dừng và ghi vào `questions` [R20].
- **Chuyển đổi từ thiết kế cũ** kích hoạt khi `factory.md` có `Coordinator:` **hoặc** memory index có `t3-coordinator` [R13]. Danh sách việc:
  - không còn worker nào đang sống;
  - xoá watcher cũ, `wake-check.sh` và `wake-fingerprint`;
  - tạo `state/`, `resources/` và `.gitignore`. Không claim sẵn ticket nào: lần dispatcher đầu tiên tự claim, và nhận PR có sẵn theo luật ở mục 1.6 [T10];
  - unpin và đổi lại tên thread coordinator cũ, xoá `t3-coordinator` và `live workers` khỏi index;
  - nhắc người dùng tắt cleanup "after the thread settles";
  - ghi `Max tickets`, `Conflict rounds` và `Reset keeps`;
  - bỏ dòng `Coordinator:`;
  - với mỗi `factory:hold` đang có: trên issue thì gỡ `factory:hold` và `ready-for-agent`, rồi gắn `ready-for-human`; trên PR thì gỡ `factory:hold`. Xoá label `factory:hold` khỏi repo khi người dùng đồng ý [T12].

  `setup override` cũng biết các setting mới.
- **Phát hiện bản version 1:** `SETUP.md:10` đổi thành "có dòng `Agent:` và không có dòng `Manager:`".
- **Lỗi nhỏ:** `t3.md:55` ghi `thinking_level`; tên đúng là `thought_level`. Dòng Migration ở `t3.md:63` cũng có ví dụ `thinking_level`; dòng đó là input cũ nên giữ, chỉ thêm biến thể `thought_level`.

### 1.13 Hold bằng triage role [S1, S2, S7; T11]
Hiện tại, GitHub và GitLab hold bằng `factory:hold` (`PLAYBOOK.md:100`, `issue-tracker-github.md:33`), còn Jira và local hold bằng `ready-for-human` (`issue-tracker-jira.md:23`, `issue-tracker-local.md:25`). Thiết kế mới dùng một luật cho mọi tracker, đọc tên label hoặc trạng thái từ `triage-labels.md`.
- **Hold chỉ đặt trên ticket.** Trên tracker dùng label: gỡ `ready-for-agent` nếu có, rồi gắn `ready-for-human`. Trên Jira và local: chuyển trạng thái như hiện tại. Sau đó đăng brief, nhả tài nguyên, flag-human.
- **PR chỉ mang `ready-for-human` khi một người phải tự merge nó**: chạm protected path, hoặc là PR sửa trunk (`PLAYBOOK.md:56`). Đúng với nghĩa trên PR mà skill `triage` đang dùng (`triage/SKILL.md:40`) [S1].
- **Setup kiểm label `ready-for-human` có trên host của PR.**
- **Dòng "To answer" trong brief** có bốn biến thể [T11]:
  - ticket thường trên tracker dùng label: "reply, then remove `<ready-for-human>` and add `<ready-for-agent>`";
  - tracker Jira hay local: "reply, then move it back to `<ready-for-agent>`" [X1];
  - ticket con của spec trên tracker dùng label: "reply, then remove `<ready-for-human>`";
  - PR phải do người merge: "merge the pull request, or reply and hand the ticket back" (theo biến thể của tracker ở trên) [U10, Y2].
- **Mọi lần gỡ hold:** nếu PR của ticket mang `ready-for-human`, coordinator gỡ role đó khỏi PR trước khi đi tiếp. Nếu PR vẫn cần người merge thì cổng 3 của Land gắn lại [U10, X1].
- **Gỡ hold:**
  - ticket thường: có `ready-for-agent`, không có `ready-for-human`, `needs-*` hay `wontfix` (như Frontier) [X1];
  - ticket con của spec: `ready-for-human` đã gỡ, không có `needs-*` hay `wontfix`, và spec vẫn mở, vẫn approved;
  - ticket bị `wontfix` hoặc bị đóng: nhả claim; coordinator tự settle ở đầu turn kế tiếp (mục 1.6).
- **Frontier:** ticket không có `ready-for-human`, không có `needs-*` hay `wontfix`. Điều kiện này thay cho "không có `factory:hold`" ở `PLAYBOOK.md:19`.
- **Merge guard dòng 4** (`PLAYBOOK.md:88`): cả ticket lẫn PR đều không có `ready-for-human`.
- **`triage-labels.md`**, cả template lẫn `docs/agents/`: nghĩa của `ready-for-human` đổi thành "Waits on a person: to implement it, to merge it, or to answer a `## Factory brief` and hand it back".
- **Skill `triage`** (`triage/SKILL.md:37,40,46,81`):
  - nới nghĩa của `ready-for-human` như trên;
  - comment `## Factory brief` là dấu hiệu phân biệt factory hold với ticket người phải tự làm;
  - chuyển qua lại `ready-for-agent ↔ ready-for-human` khi có brief của factory là chuyển bình thường.

## 2. Spike — chạy đầu tiên

Chạy trên một repo hoặc ticket thử. Kết quả ghi vào `.scratch/factory-per-ticket/research/`.

| # | Thử | Nếu thất bại |
|---|---|---|
| 1 | `t3_thread_launch` với worktree: setup script có chạy xong trước worker đầu tiên không; nhánh có giữ đúng tên không; có launch được trên nhánh của một PR đã có không | giữ worktree theo từng bước |
| 2 | Worker Antigravity với `isolation: "shared"` có chạy đúng trong worktree của coordinator không | loại Antigravity khỏi các bước dùng shared worktree |
| 3 | `watch_pull_request` có đánh thức khi có review comment, khi PR bị conflict, khi CI đổi không | dispatcher fingerprint PR rồi báo cho coordinator |
| 4 | Cleanup "after merging" có dọn worktree của thread đã gắn PR không; thread đang hold có bị dọn không | dispatcher tự quét và dọn |
| 5 | `existing_worktree` có hồi sinh được coordinator không; có đọc hoặc dừng được worker con của thread cũ không | hold cho người xử lý |
| 6 | Dispatcher chạy scout có launch được coordinator với model khác và `full-access` không | dispatcher chạy route `coordinator` |
| 7 | `t3_thread_send` tới một thread cấp cao đang nghỉ có mở turn mới không | dispatcher relaunch hoặc revive thay cho việc gửi tin; phải xem lại thiết kế park |
| 8 | Cleanup "after merging" có xoá worktree trong lúc Close đang chạy không | Close chạy ngoài worktree (đã có sẵn trong 1.7) |
| 9 | `watch_pull_request` có báo khi label trên *issue* đổi không | dự kiến là không: dispatcher lo gỡ hold. Nếu có báo thì bỏ việc này khỏi dispatcher |

## 3. Sửa theo ticket, theo thứ tự [R10]

Áp dụng `writing-for-agents`:
- Tách file theo nhánh: dispatcher và coordinator mỗi bên một file.
- Mỗi ý chỉ nằm ở một chỗ: giao thức tài nguyên ở script và `MEMORY.md`.
- Dùng leading word: *claim*, *due*, *park*, *hold*.
- Mỗi turn kết thúc bằng một tiêu chí hoàn thành có thể kiểm.
- Viết câu khẳng định thay vì câu cấm.

**Ticket A — Spike và sửa lỗi nhỏ** (làm trước, không phụ thuộc gì)
- Chạy các thử nghiệm 1–9.
- Sửa `thought_level` ở `references/t3.md:55`. Bump patch `0.12.1` lên `0.12.2` ở cả ba file `plugin.json`.
- Spec và tickets cho B, C và D chỉ được viết sau khi có kết quả spike [S15].

**Ticket B — Script và memory** (chờ A, chủ yếu thử nghiệm 1, 5, 7)
1. `scripts/resources.mjs` và `resources.test.mjs`:
   - claim và release trong `state/tickets/<n>.json`; lock dispatcher do người launch giữ, có hạn giữ;
   - acquire và release theo thứ tự toàn phần, FIFO chặn đầu hàng, gia hạn hạn giữ;
   - `reclaim <ticket>` chỉ chạy khi được gọi, không bao giờ tự chạy theo đồng hồ;
   - `due` với năm nguồn;
   - đọc và ghi `state/tickets/<n>.json` (tách `state` và `planCleared`) và `state/status.json`;
   - bật và xoá due theo `state`;
   - `check-plan` atomic, không có luật phân xử, chỉ so với ticket có `claimed` và `planCleared`, bỏ qua chính ticket và PR của nó;
   - đánh thức: ghi `running` hoặc `notifiedAt` tùy trạng thái;
   - chặn và gỡ chặn quota, có lock.
2. `scripts/comments.mjs` và test, dùng fixture JSON của `gh api`:
   - hai lệnh `fetch` và `ack`, nhận `--issue` và `--pr`, đọc bốn nguồn;
   - id có namespace, mốc `since` là `claimedAt`;
   - tác giả trả 404 coi là không tin được.
3. `MEMORY.md`: layout mới, bảng ai được ghi file nào, `.gitignore` (`state/`, `evidence/`, không còn `claims/`), chỉ dispatcher commit, watermark của lessons.

**Ticket C — Phần lõi** (chờ A và B)
4. `INTERFACE.md`. Các thao tác:
   - launch-coordinator (gồm cả snooze);
   - launch-dispatcher: project root, candidate `scout`, trả về id thread, không snooze. Watcher, `once` và `resume` đều gọi nó, sau khi đã lấy lock [U6];
   - start-worker dùng chung workspace;
   - send tới worker hoặc coordinator;
   - inspect cả worker lẫn coordinator;
   - watch-pr và unwatch-pr, link-pr;
   - settle và archive một session;
   - list-workspaces, close-workspace;
   - revive, schedule-wakes, flag-human, stop-worker.

   `wait-events` gộp vào "sự kiện là một turn". Thay luật "one coordinator" [R8].
5. `COORDINATOR.md`, lấy từ `PLAYBOOK.md`: mỗi turn, Ticket chain, cổng reset, tài nguyên và park, collision, sự kiện của PR, Land, comment, Routing, Quota, Merge guard, Humans, hai nhánh Close.
6. `DISPATCHER.md`, theo thứ tự:
   - xác nhận lock đã được người launch ghi tên mình;
   - đọc trạng thái; khi `paused` chỉ chạy các bước mục 1.6 cho phép;
   - PR đã merge: đánh thức (hoặc revive) coordinator để chạy Close, trừ khi nó đang `running` với due chưa quá. Ticket đã đóng mà PR không merge, hoặc `wontfix`, ở mọi `state`: nhả, rồi đánh thức coordinator nếu nó còn sống;
   - revive (kiểm quota, rồi reclaim, rồi launch);
   - gỡ hold (đặt `running` và due trước khi gửi tin);
   - gia hạn tài nguyên cho coordinator còn sống, reclaim holder đã chết;
   - đánh thức người chờ (kể cả chờ trunk) và coordinator có due đã quá;
   - quét worktree (trước claim);
   - Stop the line (trước claim);
   - claim và launch (ticket sửa trunk không bị giới hạn bởi `Max tickets`);
   - đóng spec;
   - ingest lessons, journal, ghi fingerprint, commit;
   - nhả lock, archive.

   Xoá `PLAYBOOK.md`.
7. `WORK-ORDERS.md`:
   - workspace dùng chung;
   - checker đứng trên nhánh ở đúng head;
   - verify ghi evidence ra memory;
   - review bỏ qua file untracked do verify tạo;
   - biến thể build cho gỡ conflict, chỉ được giao khi `git merge-tree` báo có conflict;
   - bỏ switch, `pull` và `reset` không còn cần.
8. `SKILL.md`:
   - mô tả mới;
   - mode `setup | setup override | run | once | pause | resume | stop`;
   - trỏ tới `DISPATCHER.md` và `COORDINATOR.md`.

**Ticket D — Setup, reference và repo** (chờ C)
9. `SETUP.md`:
   - template `factory.md`: bỏ `Coordinator:`, thêm `Max tickets`, `Conflict rounds: 3`, `Reset keeps:`;
   - chuyển đổi theo mục 1.12, cùng `setup override`;
   - không tạo `factory:hold` nữa (`SETUP.md:80` chỉ còn tạo `priority:p*`). Kiểm label của triage role trên tracker, và label `ready-for-human` trên host của PR;
   - phát hiện bản version 1 bằng `Agent:` mà không có `Manager:` (`SETUP.md:10`);
   - role `scout` và `coordinator`;
   - smoke test viết lại quanh các thao tác mới, lấy từ spike.
10. `references/t3.md`: Before the first wake (cleanup, full-access, snooze), Operations (flag-human gồm unsnooze, close-workspace chạy từ project root, push check theo `refs/pull/<pr>/head`), Events, Wakes (`wake-check.sh` chỉ đọc; watcher lấy lock rồi mới launch dispatcher; dispatcher ghi fingerprint; due), Revive test, Traps mới. Sửa `t3.md:74` để chỉ kiểm `git status` khi không còn worker anh em nào chạy.
11. `roles-template.md`: giải thích role `scout` và `coordinator`.
12. smode `playbooks/factory.md` (dòng 3, 5, 6, 7) và `smode/SKILL.md:82` (stop, pause, resume giờ là mode). Không cần chạy `npm run index`, vì index chỉ liệt kê tên skill [R12].
13. Template tracker `setup-software-context/issue-tracker-{github,gitlab,jira,local}.md`:
    - thêm một câu "the factory posts a `## Factory claim` comment when it starts a ticket";
    - GitHub và GitLab (dòng 33): thay `factory:hold` bằng luật hold theo triage role, viết giống Jira và local;
    - `triage-labels.md` (template và `docs/agents/`): nới nghĩa của `ready-for-human`;
    - sửa skill `triage` (`triage/SKILL.md:37,40,46,81`) theo mục 1.13;
    - sửa `docs/agents/issue-tracker.md:26` của repo này: bỏ `factory:hold`, thêm câu về comment claim [S14].

    Sau cùng, `grep -rn "factory:hold" plugins docs` phải không còn kết quả, trừ phần chuyển đổi trong `SETUP.md`.
14. Repo:
    - `docs/adr/0007-coordinator-per-ticket.md`;
    - `AGENTS.md` Current contents, `PLATFORMS.md` Running the factory, `README.md:18` và release note;
    - `GLOSSARY.md`: sửa **Hold** (dùng `ready-for-human` cùng brief; bỏ `park` khỏi `_Avoid_`), **Coordinator**, **Wake** và **Interface**; thêm **Park**, **Dispatcher** và **Due** [V6];
    - `docs/agents/factory.md` của repo này: bỏ dòng `Coordinator:`, sau khi ticket D xong;
    - bump `software` lên 0.13.0 ở ba file `plugin.json`. Marketplace không có trường version.

Ticket A chạy trước. Spec và tickets cho B, C và D được ghi dưới `.scratch/factory-per-ticket/` (smode `spec`, rồi `to-tickets`) sau khi có kết quả spike. Việc ở `gia-pha-studio` (sửa `verify.md`, khai báo `Reset keeps:`) làm sau khi ticket D xong.

## 4. Kiểm chứng

- **Sau mỗi ticket:** `npm run validate` và `npm test`.
  - Test của `resources.mjs` phải có:
    - claim chồng nhau;
    - FIFO với yêu cầu 2 slot, và nguồn due số 5 không báo khi chỉ còn 1 slot;
    - xin sai thứ tự;
    - gia hạn, và hạn giữ quá chỉ sinh due chứ không tự reclaim;
    - nhả xong mà chưa đánh thức ai;
    - quota chạy song song;
    - `check-plan` của hai ticket cùng lúc, và ticket đang park vẫn được tính khi kiểm;
    - hai ticket cùng hết chờ một thứ: `check-plan` chạy lại chỉ cho một ticket đi tiếp;
    - `check-plan` của một ticket đã có PR (rework kiểu `design`) không trùng với chính PR đó;
    - due bị xoá khi chuyển sang `held`, `waiting` hoặc `parked`;
    - `reclaim` nhả hết tài nguyên của ticket.
  - Test của `comments.mjs` phải có:
    - quyền `read` trên repo public, 404 của bot;
    - comment của chính factory và của skill `triage`;
    - id trùng giữa các endpoint; ticket và PR có số khác nhau;
    - comment cũ hơn `since`;
    - `fetch` không ack.
- **Smoke test mới:** chạy `factory setup` trên một repo thử bằng T3; mọi dòng phải `PASS`.
- **Chạy đầu cuối trên `gia-pha-studio`** với 2 ticket song song và `Max workers: 1`. Kiểm:
  - mỗi ticket một worktree;
  - không có wake rỗng khi board đứng yên;
  - CI trunk đỏ sau khi merge vẫn được phát hiện;
  - gỡ hold đánh thức đúng coordinator;
  - Land đi đường tắt khi trunk không đổi, và check lại khi trunk đổi;
  - PR bị đóng mà không merge thì ticket sang `ready-for-human` và claim được nhả; trả ticket về thì một coordinator mới nhận;
  - hold không gắn gì lên PR; gỡ hold xong ticket merge được;
  - dispatcher chạy hỏng thì lần watcher sau vẫn gọi lại; dispatcher chết ở turn đầu vì hết quota thì candidate `scout` kế tiếp được dùng;
  - CI của PR đang `PENDING` thì chờ, không rework; trunk đỏ thì không merge trunk vào nhánh;
  - worker bị kẹt thì coordinator được đánh thức nhờ due;
  - coordinator chết mà đang giữ `merge`: sau khi hồi sinh, tài nguyên được nhả, PR được watch lại;
  - holder đang park mà chết: hạn giữ quá đánh thức dispatcher, tài nguyên được thu hồi;
  - `pause` không claim ticket mới; `resume` đánh thức ticket đã dừng giữa chừng;
  - PR đóng không merge rồi làm lại: không đụng worktree hay nhánh cũ;
  - PR sửa trunk vẫn đi qua được khi trunk đỏ; ticket chờ trunk được đánh thức khi trunk hết đỏ;
  - PR có protected path mà CI còn `PENDING` thì chờ CI trước, rồi mới hold;
  - `stop` rồi `run`: ticket dừng giữa chừng vẫn được đánh thức;
  - mọi candidate hết quota giữa bước: tài nguyên được nhả;
  - trunk đỏ khi `Max tickets` đã đầy: ticket sửa trunk vẫn được claim;
  - người gắn `ready-for-human` lên một PR đang chạy: ticket vào hold, không sinh wake mỗi 15 phút;
  - ticket bị `wontfix` khi đang hold: coordinator tự dọn và settle;
  - người tự merge một PR (protected path), GitHub tự đóng ticket: Close nhánh đã merge chạy đúng một lần (handoff, xoá nhánh, clear flag-human);
  - hold làm ticket chuyển sang `ready-for-human`; người trả ticket về `ready-for-agent` thì đúng coordinator đó được đánh thức;
  - worktree bị dọn sau merge;
  - `tickets/<n>.md` đọc lại được toàn bộ câu chuyện.
