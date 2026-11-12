# HEXA — Unified IT Helpdesk + Asset Management

Hệ thống ReactJS + Node.js (Express) + Firebase Realtime Database. Mã nguồn dựa trên project HEXA do bạn cung cấp, giữ tài khoản, ticket và tài sản trong Firebase `tickethexaa`.

**Chạy local:**
- Backend: `cd backend`, `npm ci`, `npm start`.
- Frontend: `cd frontend`, `npm ci`, `npm run dev`.

**Deploy GitHub + Vercel từ đầu:** chạy `DEPLOY_TICKET_ASSET_HEXA.bat` ở thư mục gốc. Xem [HUONG_DAN_DEPLOY.md](HUONG_DAN_DEPLOY.md).

**Nhiệm vụ theo lịch trên cloud:** xem `DEPLOY_SCHEDULER_FIREBASE.bat`; cần gói Firebase Blaze.

> Lưu ý: bản ZIP có chứa cấu hình và Service Account do bạn tải lên. Không chia sẻ ZIP, không đưa khóa quản trị vào GitHub hoặc frontend. Script triển khai chỉ đồng bộ biến bí mật tới backend Vercel.
