# S1: OMP duyệt model khi role có namespace

Ngày: 2026-11-18.

**Câu hỏi:** OMP có chấp nhận một model truyền theo từng lần gọi khi model đó chỉ được nêu dưới một key `modelRoles` có namespace theo repo (ví dụ `smode-skills-thinker`) không?

**Cách làm:** đọc mã OMP 18.20.3 đã cài (`@oh-my-pi/pi-coding-agent/src/task/model-approval.ts`, `config/settings.ts`, `config/model-roles.ts`).

**Kết quả (đọc mã):**
- `perCallModelGrantPatterns` gom giá trị của **mọi** role trong `settings.grantAuthority().getModelRoles()` (`configuredRoleGrantPatterns`). Chỉ bỏ các role kiểu "kind" (`isKindRole`, danh sách cố định của OMP) và các giá trị là alias role (`@slow`), `default`, `inherit`.
- `getModelRoles()` đọc `modelRoles` như một record bất kỳ: key nào cũng được, không có danh sách key hợp lệ.
- `grantAuthority()` bỏ qua config của project, nên key vẫn phải nằm trong user config (`~/.omp/agent/config.yml`), như spike S6 của `smode-factory-v2`.
- Giá trị là selector chính xác `provider/model-id[:level]` thì so khớp chính xác; glob không cấp quyền.

**Kết luận:**
- Key có namespace cấp quyền như key thường. Mỗi project đồng bộ các key `smode-<repo>-<role>` của riêng nó, nên không ghi đè project khác.
- Giữ dạng an toàn: key dùng chữ, số và dấu gạch ngang, không dùng dấu chấm (tránh bị hiểu là đường dẫn setting).
- Phương án dự phòng (đồng bộ dạng hợp) không cần.
- ID provider của OMP trên máy này: `anthropic`, `cursor`, `antigravity-cli` (đọc từ `modelRoles` hiện có). `harness/omp.md` ánh xạ `via=antigravity` sang `antigravity-cli`.
