# 02: README có `npm run index`

**What to build:** mục "Work on this repo" trong `README.md` liệt kê `npm run index` cùng các lệnh khác, và một câu nói khi nào chạy nó: sau khi thêm, xoá hoặc đổi tên một skill, khi `npm run validate` báo skills index đã cũ.

**Blocked by:** none

**Status:** ready-for-agent

**Door:** two-way

- [ ] `README.md` có lệnh `npm run index` trong khối lệnh của mục "Work on this repo"
  Verify: `grep -n 'npm run index' README.md`
- [ ] README nói khi nào cần chạy lệnh đó, khớp với câu lỗi của validator
  Verify: đọc mục "Work on this repo", đối chiếu với câu "skills index is stale; run `npm run index`" trong `cli/lib.mjs`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments

## Factory plan

2026-11-16, factory-v2 planner `02 planner` (claudeAgent/claude-fable-5-2). Door: `two-way`. Files to change: `README.md`. Files not to touch: `cli/repo.mjs`, `cli/lib.mjs`, `cli/repo.test.mjs`, `PLATFORMS.md`, `AGENTS.md`, `package.json`, `plugins/*/skills/*/skills-index.md`, `.scratch/**`.

##### Plan: ticket 02 "README có `npm run index`"

Reply language: match-user, không có tin nhắn người dùng nên lấy theo ngôn ngữ của ticket và spec: **tiếng Việt**. Văn bản thêm vào `README.md` vẫn là tiếng Anh vì cả file đó viết bằng tiếng Anh.

Mục tiêu: mục "Work on this repo" của `README.md` liệt kê `npm run index` và nói khi nào chạy nó, để người gặp lỗi "skills index is stale" của validator tìm thấy lệnh sửa ngay trong README. Base: `main` tại `ec1ebb5` (bằng `origin/main`); nhánh `factory/02-readme-index-command` chưa có trên origin.

#### Decisions

1. **Data shape: không có.** Ticket chỉ đổi văn bản tài liệu; không thêm kiểu, hàm, lệnh hay cấu hình nào. Lệnh `index` đã có sẵn (`package.json` scripts `index`, `cli/repo.mjs` HELP).
2. **Chỉ sửa `README.md`, hai chỗ trong mục "Work on this repo"** (dòng 22 đến 30 hiện tại, cũng là cuối file). Lý do: spec ghi rõ không đổi `PLATFORMS.md` hay `AGENTS.md`, và các lệnh khác của CLI không đổi.
3. **Vị trí dòng lệnh: `npm run index` ngay sau `npm run validate`, trước `npm test`.** Lý do: theo thứ tự của HELP trong `cli/repo.mjs` (`validate` rồi `index`) và đặt lệnh sửa cạnh lệnh báo lỗi. Chạy cả khối từ trên xuống vẫn an toàn: `index` ghi lại đúng nội dung khi index đã mới (`writeSkillsIndexes` trong `cli/lib.mjs`).
4. **Câu "khi nào chạy" là một đoạn văn riêng, ngay sau khối lệnh, cách một dòng trống, là dòng cuối của file.** Văn bản chính xác (builder chép nguyên văn):

   ```markdown
   Run `npm run index` after adding, removing or renaming a skill, when `npm run validate` reports "skills index is stale; run `npm run index`": it regenerates the `skills-index.md` of every mode skill.
   ```

   Lý do từng phần:
   - "after adding, removing or renaming a skill, when `npm run validate` reports ...": đúng nội dung ticket yêu cầu.
   - Chuỗi trong ngoặc kép chép nguyên từ `cli/lib.mjs` dòng 245, kể cả dấu backtick quanh `npm run index`, để tiêu chí 2 kiểm bằng `grep -F` được.
   - "regenerates the `skills-index.md` of every mode skill": theo HELP của `cli/repo.mjs` ("Regenerate the skills index of every mode skill (skills-index.md)") và thuật ngữ **Mode skill** trong `GLOSSARY.md`.
5. **Ngôn ngữ của câu: tiếng Anh.** `README.md` hoàn toàn bằng tiếng Anh; `docs/agents/response-language.md` chỉ áp cho văn bản gửi người (chat, issue, PR), không đổi ngôn ngữ của tài liệu sẵn có.
6. **Không nhắc lỗi thứ hai của validator** ("mode skill has no skills index; run `npm run index`", `cli/lib.mjs` dòng 244). Lý do: ticket và spec chỉ nêu câu "stale"; giữ một câu.
7. **Không thêm test tự động cho README.** Lý do: spec chỉ đòi test cho `repo list` (ticket 01); validator và test hiện không đọc `README.md` (không có chữ `README` nào trong `cli/`); một test mới sẽ phải nằm ở `cli/repo.test.mjs`, file của ticket 01. Bằng chứng là các dòng `Verify:` của ticket.
8. **Không bump version plugin, không chạy `npm run index`.** `README.md` nằm ngoài mọi plugin và không skill nào đổi, nên index không cũ đi.
9. **File cuối vẫn kết thúc bằng đúng một ký tự xuống dòng** (hiện tại là vậy, đo bằng `tail -c 1 README.md | xxd`).

#### Change map

Files to change:

- `README.md`: (a) thêm dòng `npm run index` vào khối ```bash của mục "Work on this repo", giữa `npm run validate` và `npm test`; (b) thêm một dòng trống rồi câu ở Decision 4 sau dấu đóng khối lệnh.

Kết quả mong đợi của mục (nguyên văn):

````markdown
## Work on this repo

```bash
npm install
npm run validate
npm run index
npm test
npm run list
npm run upstream -- status
```

Run `npm run index` after adding, removing or renaming a skill, when `npm run validate` reports "skills index is stale; run `npm run index`": it regenerates the `skills-index.md` of every mode skill.
````

Files not to touch:

- `cli/repo.mjs`, `cli/lib.mjs`, `cli/repo.test.mjs`: phạm vi của ticket 01 (`.scratch/repo-cli-polish/issues/01-list-one-header-per-plugin.md`, lệnh `list` và test của nó), đang được lập kế hoạch song song. Câu lỗi trong `cli/lib.mjs` là nguồn để đối chiếu, không được sửa cho khớp README.
- `PLATFORMS.md`, `AGENTS.md`: spec ghi ngoài phạm vi.
- `package.json`: script `index` đã có.
- `plugins/*/skills/*/skills-index.md`: file sinh ra bởi `npm run index`, không sửa tay; ticket này không làm nó cũ.
- `.scratch/**`: ticket và spec do coordinator ghi trên trunk, không nằm trong pull request.
- Phần còn lại của `README.md` (dòng 1 đến 21): không thuộc ticket.

#### Interfaces

Không thêm hay đổi hàm, kiểu, lệnh, endpoint hay sự kiện nào. Bề mặt duy nhất thay đổi là văn bản mục "Work on this repo" của `README.md` như ở Change map.

#### Tests

Không có test tự động mới (Decision 7); `tdd` không áp dụng vì không có code thay đổi. Mỗi tiêu chí được kiểm bằng lệnh, chạy trước khi sửa để thấy đỏ rồi sau khi sửa để thấy xanh:

| Tiêu chí | Nhánh | Kiểm | Trước khi sửa (đã đo trên `ec1ebb5`) | Sau khi sửa (đã đo trên bản nháp ngoài repo) |
|---|---|---|---|---|
| 1. Lệnh nằm trong khối lệnh | bình thường | `grep -n 'npm run index' README.md` | không có dòng nào, exit 1 | dòng 27 và dòng 33 |
| 1 | biên: đúng là trong khối ```bash của mục, không chỉ trong câu văn | `awk '/^## Work on this repo/{f=1} f&&/^```bash/{b=1;next} b&&/^```/{exit} b' README.md \| grep -x 'npm run index'` | exit 1 | in `npm run index` |
| 2. Câu khớp câu lỗi validator | bình thường | `grep -cF 'skills index is stale; run `npm run index`' README.md cli/lib.mjs` | `README.md:0`, `cli/lib.mjs:1` | cả hai `:1` |
| 2 | biên: câu nói đủ ba trường hợp thêm, xoá, đổi tên | đọc mục, thấy "adding, removing or renaming a skill" | không có | có |
| 3. `npm run validate` pass | bình thường | `npm run validate` | `29 skills, 10 agents, 0 issue(s)` | giống hệt |
| 3. `npm test` pass | bình thường | `npm test` | `pass 18`, `fail 0` | giống hệt |

Nhánh lỗi: không có; thay đổi không thêm đường chạy nào.

#### Verify

Theo `docs/agents/verify.md`, từ thư mục gốc của checkout:

1. Launch: `npm install` (bắt buộc: worktree mới của T3 không có `node_modules/`).
2. Doctor: năm lệnh ở mục Doctor của `docs/agents/verify.md`; `pwd` phải là checkout của pull request.
3. Journey 1: `npm run validate`, dòng cuối khớp `^[0-9]+ skills, [0-9]+ agents, 0 issue\(s\)$` (tiêu chí 3).
4. Journey 2: `npm test`, có `ℹ fail 0` (tiêu chí 3).
5. Journey 3: `npm run list` kèm hai lệnh `grep` của doc (đường mặc định của verifier; ticket này không đổi output của nó).
6. Tiêu chí 1: `grep -n 'npm run index' README.md` và lệnh `awk ... | grep -x` ở bảng Tests.
7. Tiêu chí 2: `grep -cF 'skills index is stale; run `npm run index`' README.md cli/lib.mjs` in `:1` cho cả hai file, rồi đọc mục "Work on this repo".

Môi trường hôm nay với tới mọi lệnh trên (đã đo): Node `v26.13.0` (cần >= 20), `npm install --dry-run` thành công, `validate` và `test` xanh trên bản sao của `ec1ebb5`. Không cần fixture, tài khoản, thiết bị hay dịch vụ nào. Journey 4 (upstream) không cần: ticket không chạm `UPSTREAM.md` hay lệnh upstream.

#### Door

`two-way`. Chỉ thêm hai đoạn văn bản vào một file tài liệu; hoàn tác bằng một `git revert`, không có dữ liệu, API công bố hay tác động ra ngoài. Khớp dòng `Door: two-way` của ticket.

#### Questions

Không có câu hỏi sản phẩm nào còn mở: ticket đã cho nội dung của câu, và lời văn chính xác theo câu lỗi của validator.

Split: none. Một file, một luồng, một lượt review.
