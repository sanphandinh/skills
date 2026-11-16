# 01: `repo list` in một tiêu đề cho mỗi plugin

**What to build:** `npm run list` in tiêu đề `<plugin> (<platform>):` đúng một lần cho mỗi plugin. Các agent nằm dưới tiêu đề của plugin mình, như các skill. Hiện tại mỗi agent kéo theo một tiêu đề riêng, nên `software-claude (claude):` xuất hiện năm lần.

**Blocked by:** none

**Status:** ready-for-agent

**Door:** two-way

- [ ] Mỗi tiêu đề plugin xuất hiện đúng một lần trong output của `repo list`
  Verify: `node cli/repo.mjs list | grep -c '^software-claude (claude):'` in ra `1`, và `node cli/repo.mjs list | grep -c '^software-omp (omp):'` in ra `1`
- [ ] Dưới mỗi tiêu đề vẫn có đủ skill và agent như trước, cùng định dạng dòng `  skill  <name>` và `  agent  <name>`
  Verify: so `node cli/repo.mjs list | grep -E '^  (skill|agent) ' | sort` trước và sau thay đổi: giống nhau
- [ ] Một test trong `cli/repo.test.mjs` hỏng với code cũ và pass với code mới
  Verify: `npm test`
- [ ] `npm run validate` và `npm test` pass
  Verify: chạy hai lệnh từ thư mục gốc của repo

## Comments

## Factory plan

2026-11-16, factory-v2 planner `01 planner` (claudeAgent/claude-fable-5-2). Door: `two-way`. Files to change: `cli/lib.mjs`, `cli/repo.mjs`, `cli/repo.test.mjs`. Files not to touch: `README.md`, `AGENTS.md`, `PLATFORMS.md`, `.scratch/**`, `docs/agents/verify.md`, `catalog.yaml`, `plugins/**`, `package.json`.

### Plan ticket 01: `repo list` in một tiêu đề cho mỗi plugin

Reply language: match-user, không có tin nhắn trực tiếp nên lấy ngôn ngữ của ticket và spec: tiếng Việt.

**Mục tiêu:** `npm run list` in tiêu đề `<plugin> (<platform>):` đúng một lần cho mỗi plugin, agent nằm dưới tiêu đề plugin của mình. Hiện `software-claude (claude):` và `software-omp (omp):` mỗi cái lặp 5 lần (đo tại `ec1ebb5`: 52 dòng, 13 tiêu đề, 39 dòng skill/agent). Sau thay đổi: 44 dòng, 5 tiêu đề, 39 dòng skill/agent.

Base: `origin/main` = `ec1ebb5`. Nhánh `factory/01-list-one-header-per-plugin` chưa có trên origin. Không có handoff nào phải đọc. `GLOSSARY.md` và ba ADR (0001 đến 0003) không nói gì về `repo list`.

#### Decisions

1. **Dạng dữ liệu: văn bản.** Một hàm thuần `renderList(root, catalog)` trả về toàn bộ văn bản của `repo list` dưới dạng một chuỗi, mỗi dòng kết thúc bằng `\n`, chuỗi rỗng khi không có skill và agent nào. Lý do: các tiêu chí của ticket đều nói về dòng in ra, nên test so đúng thứ người dùng thấy. Theo mẫu có sẵn `renderSkillsIndex(root, catalog)` trong `cli/lib.mjs` (hàm render trả về chuỗi). Không thêm cấu trúc nhóm trung gian nào được export.
2. **Logic nằm trong `cli/lib.mjs`, không nằm trong `cli/repo.mjs`.** `cli/repo.mjs` chạy `main()` ngay khi được import và lấy `REPO_ROOT` từ vị trí file của nó, nên test không import được và không trỏ được vào fixture. Mọi test hiện có đều import từ `./lib.mjs` và chạy trên repo tạm của `repo()`. `cli/repo.mjs` chỉ còn in kết quả.
3. **Thứ tự plugin: theo lần xuất hiện đầu tiên trong output hiện tại.** Plugin có skill đứng trước (theo thứ tự `catalog.yaml`), rồi tới plugin chỉ có agent (theo thứ tự `catalog.yaml`). Lý do: spec ghi "Thứ tự plugin ... không đổi". Output hôm nay là `core`, `software`, `factory`, `software-claude`, `software-omp`, trong khi `catalog.yaml` xếp `factory` cuối cùng; lặp một vòng theo `catalog.plugins` sẽ đẩy `factory` xuống cuối và trái spec. Cách làm: `new Set([...skills, ...agents].map((e) => e.plugin))` giữ đúng thứ tự này. Đo trên repo thật: output cũ bỏ các tiêu đề lặp bằng đúng output mới.
4. **Trong một plugin: skill trước, agent sau.** Ticket ghi "Các agent nằm dưới tiêu đề của plugin mình, như các skill". Plugin có cả skill lẫn agent (hôm nay chưa có plugin nào như vậy) in một tiêu đề ở vị trí skill của nó, agent ngay dưới các skill.
5. **Plugin không có skill và không có agent: không in tiêu đề.** Giữ hành vi hiện tại.
6. **Định dạng dòng giữ nguyên từng ký tự:** `  skill  <name>` và `  agent  <name>`, tên agent là `path.basename(file)` bỏ đuôi `.md` hoặc `.toml`. Thứ tự skill và agent trong plugin vẫn do `listSkills` và `listAgents` quyết định; hai hàm đó không đổi.
7. **Platform của tiêu đề** lấy từ `catalog.plugins[plugin].platform` (`loadCatalog` đã gán mặc định `shared`).
8. **In ra:** `process.stdout.write(renderList(REPO_ROOT))`, không dùng `console.log`, để catalog rỗng vẫn in ra không byte nào như hôm nay.
9. **Lỗi:** không thêm đường lỗi nào. Thiếu `catalog.yaml` vẫn ném từ `loadCatalog` và `cli/repo.mjs` vẫn in `error: ...` với mã thoát 2.
10. **Không đổi:** dòng `list` trong `HELP`, script `list` trong `package.json`, các export hiện có của `cli/lib.mjs` (`listSkills`, `listAgents` vẫn được export), phiên bản plugin.

#### Change map

Files to change:

- `cli/lib.mjs`: thêm `export function renderList` ngay sau `listAgents`, trong phần `// ---------- catalog and repo contents ----------`. Không sửa gì khác.
- `cli/repo.mjs`: `case "list"` chỉ còn gọi `process.stdout.write(renderList(REPO_ROOT))` rồi `return`. Dòng import bỏ `listAgents`, `listSkills` (không còn dùng trong file này) và thêm `renderList`. Các `case` khác và `HELP` không đổi.
- `cli/repo.test.mjs`: thêm `renderList` vào dòng import từ `./lib.mjs`; thêm hai test (mục Tests) ngay trước dòng `// ---------- upstream ----------`.

Files not to touch:

- `README.md`: phạm vi của ticket 02 (`.scratch/repo-cli-polish/issues/02-readme-index-command.md`), đang được plan song song.
- `AGENTS.md`, `PLATFORMS.md`: spec ghi ngoài phạm vi.
- `.scratch/**`: coordinator tự ghi plan, handoff và trạng thái ticket lên trunk, không nằm trong pull request.
- `docs/agents/verify.md`: hai lệnh `grep` của journey 3 (`skill  grilling`, `skill  setup-verification`) vẫn đúng vì định dạng dòng không đổi.
- `catalog.yaml`, `plugins/**`: không skill hay agent nào đổi; sửa ở đây kéo theo version và skills index.
- `package.json`: script `list` giữ nguyên.

#### Interfaces

Thêm vào `cli/lib.mjs`:

```js
// The text of `repo list`: each plugin's header once, then its skills, then its
// agents. Plugins with skills come first, then plugins with only agents, both
// in catalog order.
export function renderList(root, catalog = loadCatalog(root)) // => string
```

- Trả về: các dòng `<plugin> (<platform>):`, `  skill  <name>`, `  agent  <name>`, mỗi dòng kết thúc bằng `\n`; `""` khi không có gì để liệt kê.
- Ném: lỗi của `loadCatalog` khi `catalog.yaml` thiếu hoặc không có `plugins`.

Bản tham chiếu, đã đo là xanh với hai test bên dưới và với repo thật:

```js
export function renderList(root, catalog = loadCatalog(root)) {
  const skills = listSkills(root, catalog);
  const agents = listAgents(root, catalog);
  const lines = [];
  for (const plugin of new Set([...skills, ...agents].map((e) => e.plugin))) {
    lines.push(`${plugin} (${catalog.plugins[plugin].platform}):`);
    for (const s of skills) if (s.plugin === plugin) lines.push(`  skill  ${s.name}`);
    for (const a of agents) if (a.plugin === plugin) lines.push(`  agent  ${path.basename(a.file).replace(/\.(md|toml)$/, "")}`);
  }
  return lines.map((l) => `${l}\n`).join("");
}
```

Đổi trong `cli/repo.mjs`:

```js
import { renderList, upstreamAdd, upstreamPull, upstreamStatus, validate, writeSkillsIndexes } from "./lib.mjs";
// ...
    case "list": {
      process.stdout.write(renderList(REPO_ROOT));
      return;
    }
```

Giao diện dòng lệnh (`repo list`, `npm run list`) không đổi tham số; chỉ output bớt các tiêu đề lặp.

#### Tests

Cả hai test nằm trong `cli/repo.test.mjs`, viết trước code, theo skill `tdd`.

**T1** `list prints one header per plugin, with its skills and then its agents below it` (tiêu chí 1, 2, 3). Một fixture phủ mọi nhánh, so bằng `assert.equal` trên toàn bộ chuỗi:

```js
const root = repo({
  "catalog.yaml": `${CATALOG}  empty:\n    platform: shared\n`,
  "plugins/core-claude/skills/deep/SKILL.md": skill("deep"),
  "plugins/core-claude/agents/planner.md": agent("planner", "model: opus\n"),
  "plugins/core-omp/agents/nested/helper.toml": "",
});
assert.equal(
  renderList(root),
  [
    "core (shared):",
    "  skill  alpha",
    "mkt (shared):",
    "  skill  mkt-launch",
    "core-claude (claude):",
    "  skill  deep",
    "  agent  planner",
    "  agent  reviewer",
    "core-omp (omp):",
    "  agent  helper",
    "  agent  reviewer",
    "",
  ].join("\n"),
);
```

Nhánh được phủ:

- Plugin chỉ có skill (`core`, `mkt`): một tiêu đề.
- Plugin chỉ có agent, nhiều agent (`core-omp`): một tiêu đề. Đây là lỗi của ticket.
- Plugin có cả skill và agent (`core-claude`): một tiêu đề, skill rồi agent, đứng ở vị trí skill của nó nên trước `core-omp`.
- Plugin không có gì (`empty`): không có tiêu đề.
- Định dạng dòng, đuôi `.toml`, agent trong thư mục con: chỉ in tên file không đuôi.

**T2** `list prints nothing for a catalog with no skills and no agents` (cạnh của quyết định 8):

```js
const root = tmp();
put(root, { "catalog.yaml": "plugins:\n  empty:\n    platform: shared\n" });
assert.equal(renderList(root), "");
```

**Chứng minh tiêu chí 3 (đỏ với code cũ, xanh với code mới), theo thứ tự:**

1. Viết T1 và T2, chưa sửa `cli/lib.mjs`: `npm test` đỏ vì `SyntaxError: The requested module './lib.mjs' does not provide an export named 'renderList'` (đã đo).
2. Chuyển nguyên vòng lặp hiện tại của `case "list"` vào `renderList` (nối chuỗi thay cho `console.log`): T1 đỏ đúng lý do, `actual` có `core-omp (omp):` hai lần và `core-claude (claude):` ba lần; T2 xanh; tổng 19 pass, 1 fail (đã đo). Giữ transcript này làm bằng chứng, không cần commit trạng thái này.
3. Viết lại `renderList` như bản tham chiếu và nối `cli/repo.mjs`: 20 pass, 0 fail (đã đo; trunk hiện có 18 test).

Lỗi: không có nhánh lỗi mới nên không có test lỗi mới.

#### Verify

Theo `docs/agents/verify.md`. Chạy từ gốc checkout của ticket.

- **Launch:** `npm install`. Worktree mới không có `node_modules/`; thiếu nó mọi lệnh hỏng với `Cannot find package 'yaml'`. Đã đo hôm nay: `npm install` tới được registry từ máy này (thử trên bản sao `package.json` ngoài checkout).
- **Doctor:** năm lệnh trong mục Doctor của `docs/agents/verify.md`.
- **Tiêu chí 1:** `node cli/repo.mjs list | grep -c '^software-claude (claude):'` in `1`; `node cli/repo.mjs list | grep -c '^software-omp (omp):'` in `1`. Thêm: `node cli/repo.mjs list | grep -v '^  ' | sort | uniq -d` không in gì.
- **Tiêu chí 2:** lấy output của code cũ mà không đổi checkout:

  ```bash
  B=$(mktemp -d) && git archive origin/main | tar -x -C "$B" && ln -s "$PWD/node_modules" "$B/node_modules"
  node "$B/cli/repo.mjs" list > "$VERIFY_EVIDENCE/list-before.txt"
  node cli/repo.mjs list > "$VERIFY_EVIDENCE/list-after.txt"
  diff <(grep -E '^  (skill|agent) ' "$VERIFY_EVIDENCE/list-before.txt" | sort) <(grep -E '^  (skill|agent) ' "$VERIFY_EVIDENCE/list-after.txt" | sort)
  diff <(awk '/^  /{print;next} !seen[$0]++' "$VERIFY_EVIDENCE/list-before.txt") "$VERIFY_EVIDENCE/list-after.txt"
  ```

  Cả hai `diff` không in gì. Lệnh `diff` thứ hai chứng minh thêm thứ tự plugin không đổi (quyết định 3). Cần `bash` hoặc `zsh` cho `<( )`. Đã đo với bản thử: cả hai rỗng.
- **Tiêu chí 3:** `npm test` (journey 2): `ℹ tests 20`, `ℹ fail 0`. Đỏ với code cũ: `cp cli/repo.test.mjs "$B/cli/" && (cd "$B" && node --test cli/repo.test.mjs)` thoát khác 0.
- **Tiêu chí 4:** journey 1 `npm run validate`: dòng cuối `29 skills, 10 agents, 0 issue(s)`; journey 2 `npm test`; journey 3 `npm run list` cùng hai lệnh `grep` của nó.
- Môi trường tới được mọi lệnh trên hôm nay; không cần fixture, tài khoản hay dịch vụ nào. Journey 4 (upstream) không cần: ticket không chạm lệnh upstream.

#### Door

`two-way`. Chỉ đổi văn bản in ra của một lệnh CLI nội bộ và thêm một hàm export; không có dữ liệu, API đã công bố, thao tác xoá hay tác động ra ngoài. Không có gì trong repo đọc lại các dòng tiêu đề của `list` (`docs/agents/verify.md` chỉ `grep` dòng `skill`). Hoàn tác bằng một commit revert.

#### Questions

Không có. Điểm duy nhất có thể hiểu hai cách là thứ tự plugin, và spec đã định: "Thứ tự plugin ... không đổi" (quyết định 3).

#### Split

none
