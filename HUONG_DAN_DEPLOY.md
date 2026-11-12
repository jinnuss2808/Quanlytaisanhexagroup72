# HEXA — Triển khai lại từ đầu lên GitHub + Vercel

**Project frontend:** `ticket-asset-hexa`  
**Project backend:** `ticket-asset-hexa-api`  
**GitHub (Private):** `ticket-asset-hexa`  
**Firebase:** dùng lại `tickethexaa`, không xóa hoặc tạo lại Realtime Database.

## 1. Vì sao lần trước API bị lỗi

Bản bạn gửi có backend `src/server.js` để chạy Node.js liên tục trên Windows, nhưng thiếu entrypoint đúng cho Vercel Functions. Bản này bổ sung `backend/index.js` xuất Express `app` mà không gọi `listen()`. Lệnh `npm start` trong backend vẫn hoạt động ở local như cũ.

Bản này cũng ngăn phản hồi API dạng object đi vào các biến danh sách ticket, thông báo và tài khoản, tránh lỗi React `filter is not a function`; nếu có lỗi hiển thị khác, màn hình sẽ thông báo thay vì trắng hoàn toàn.

## 2. Chuẩn bị lần đầu

Máy Windows cần Node.js >=22, Git for Windows, GitHub CLI (`gh`) và tài khoản Vercel. Script sẽ tự cài Vercel CLI nếu thiếu.

- Git: https://git-scm.com/downloads/win
- GitHub CLI: `winget install --id GitHub.cli -e`
- Node.js: https://nodejs.org/

**Không cần tự chép `.env`:** bản ZIP có cấu hình Firebase từ file `.7z` bạn gửi và `backend/service-account.json`. ZIP là **tài liệu nội bộ rất nhạy cảm**. Không gửi công khai, không upload toàn bộ ZIP lên GitHub/Vercel.

## 3. Chạy một file BAT

1. Giải nén `ticket-asset-hexa-ready.zip` vào một thư mục riêng (không ghi đè bản cũ đang làm việc).
2. Chạy `DEPLOY_TICKET_ASSET_HEXA.bat`.
3. Nếu được hỏi, đăng nhập GitHub và Vercel theo hướng dẫn trên cửa sổ trình duyệt. GitHub sẽ hiển thị mã Device Login trong Terminal (không nằm trên trang nhập mã).
4. Script tự chạy: `npm ci` backend/frontend → test → build → tạo/cập nhật repo **private** → push GitHub → link backend Vercel → đồng bộ biến môi trường → deploy API → kiểm tra HTTP 200 `/api/health` → deploy frontend.
5. Nếu API kiểm tra thất bại, script dừng và ghi **HTTP status**; không đưa lên web một frontend mới khi API lỗi.

Tên Team Vercel hiện được đặt là `trungs-projects` dựa trên ảnh bạn đã gửi. Nếu Team đã thay đổi, sửa dòng `$VercelScope` ở đầu file `.ps1`.

## 4. Link kiểm tra

- Frontend: https://ticket-asset-hexa.vercel.app/it
- API: https://ticket-asset-hexa-api.vercel.app/api/health
- Git: `https://github.com/<GitHub-user>/ticket-asset-hexa`

Các URL frontend và API ở trên là alias dự kiến. Chỉ coi đã deploy khi BAT kết thúc thành công và trực tiếp kiểm tra HTTP 200.

Sau đó mở **Firebase Console → Authentication → Settings → Authorized domains**, thêm `ticket-asset-hexa.vercel.app` nếu chưa có. Không thêm `https://`.

## 5. Nếu API vẫn lỗi

- `HTTP 404`: Vercel project `ticket-asset-hexa-api` → Settings → Build and Deployment → **Root Directory**. Với deploy CLI từ thư mục backend, Root Directory phải không khiến Vercel tìm sai đường dẫn. Bản này có `backend/index.js` xuất Express app.
- `HTTP 401/403`: Kiểm tra **Deployment Protection** (Production) và quyền truy cập, không tắt bảo vệ một cách tùy tiện.
- `HTTP 500`: Vercel → `ticket-asset-hexa-api` → Logs / Functions, kiểm tra `FIREBASE_SERVICE_ACCOUNT_BASE64` và `FIREBASE_DATABASE_URL`.
- Khi frontend trắng: kiểm tra Console hoặc màn hình ErrorBoundary, lưu mã lỗi cụ thể.

## 6. Cơ chế tự giao & nhắc ticket trên cloud

Vercel Functions **không chạy `setInterval` liên tục**, nên sau khi deploy web và API, nếu cần tự giao 5 phút, nhắc Support 30 phút, nhắc yêu cầu tài sản 12 giờ khi máy tắt, hãy chạy riêng `DEPLOY_SCHEDULER_FIREBASE.bat` (chỉ khi Firebase đã ở gói **Blaze**, có thể tính phí). File BAT này yêu cầu xác nhận trước khi deploy.

## 7. Bảo mật

- Repo GitHub **Private**; script chỉ đẩy mã nguồn đã lọc, không đẩy `.env`, Service Account, thư mục `.vercel`, `node_modules`, `dist`.
- `FIREBASE_SERVICE_ACCOUNT_BASE64` chỉ được nạp lên Vercel backend dưới dạng **Secret**, không xuất hiện trong frontend.
- Nếu khóa từng bị commit vào Git trước đây, xóa commit mới **không xóa được lịch sử**: phải xử lý lịch sử Git và xoay khóa riêng trong Google Cloud/Firebase.
- Tài khoản và 250 tài sản đang có vẫn nằm trong Firebase `tickethexaa`, không bị tác động bởi quá trình triển khai mã nguồn.

**Giới hạn đã kiểm tra:** backend 77/77 test; entrypoint API chạy thử HTTP 200 trên Node.js; JSX được phân tích cú pháp. Chưa thực hiện deploy thực tế vì yêu cầu đăng nhập GitHub/Vercel của bạn. Build Vite đầy đủ cần chạy `npm ci` trên Windows vì môi trường kiểm tra sử dụng dependency từ Windows, không có Rollup native Linux.
