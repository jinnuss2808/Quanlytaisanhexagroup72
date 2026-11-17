# HEXA: Chuyển từ Vercel sang Cloudflare Pages + Render (17/11/2026)

## Kiến trúc

- **Frontend:** ReactJS + Vite trên **Cloudflare Pages**, URL thực tế do Cloudflare cấp (`https://<ten-site>.pages.dev`).
- **Backend:** Express / Node.js 22 trên **Render Web Service**, URL thực tế do Render cấp (`https://<ten-api>.onrender.com`).
- **Database / đăng nhập:** giữ nguyên Firebase Realtime Database và Firebase Authentication. **Không tạo database mới, không chạy lệnh xóa dữ liệu Firebase**.
- **Mã nguồn:** nên đặt trong repository GitHub **Private** với cấu trúc `frontend/`, `backend/`, `firebase/` và `render.yaml` ở thư mục gốc.

> Đừng copy `node_modules`, `.git`, `.env` có khóa thật, `service-account.json` hoặc các file PEM vào GitHub. Repo này chứa `.env.example` để tham khảo.

## A. Triển khai API trên Render — thực hiện trước

1. Truy cập https://dashboard.render.com, đăng nhập và kết nối repository GitHub private chứa bản HEXA này.
2. Cách dễ nhất: **New > Blueprint**, trỏ tới repository có file `render.yaml` ở thư mục gốc. Hoặc tạo thủ công **New > Web Service**, chọn cấu hình sau:
   - Language: **Node**; Root directory: `backend`
   - Instance type: **Free**
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
   - Node: **22** hoặc phiên bản tương thích Node >=22
3. Cấu hình **Environment Variables** trên Render (không ghi vào GitHub):

| Key | Giá trị cần điền |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `FIREBASE_PROJECT_ID` | Project ID Firebase **hiện có** |
| `FIREBASE_DATABASE_URL` | URL Realtime Database **hiện có** |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Khóa Service Account JSON mã hóa base64 (xem bên dưới) |
| `CLIENT_ORIGINS` | `https://<ten-site>.pages.dev` (thay bằng domain Pages thực sau khi tạo frontend) |
| `REMINDER_SWEEP_MS` | `30000` |

4. Tạo chuỗi `FIREBASE_SERVICE_ACCOUNT_BASE64` **trên máy cá nhân**, trong PowerShell (đường dẫn phải là file JSON khóa mà bạn đang sử dụng):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\duong-dan-rieng\service-account.json'))
```

Copy chuỗi thu được vào **Render > Environment**. Base64 **không phải mã hóa bảo mật**, không chia sẻ chuỗi này, không đính kèm vào repository hoặc chat. Nếu khóa cũ bị công khai, hãy thu hồi và cấp khóa mới.

5. Deploy backend và thử mở `https://<ten-api>.onrender.com/api/health` trong browser. Phản hồi mong đợi: JSON `ok: true`; endpoint này **không** chứng minh Firebase Auth / Database đã kết nối thành công.

## B. Deploy frontend lên Cloudflare Pages

1. Mở https://dash.cloudflare.com -> **Workers & Pages > Create > Pages > Connect to Git**; chọn đúng repository private.
2. Cấu hình:
   - **Project name:** tự chọn, ví dụ `hexa-ticket-it` nếu còn trống.
   - Framework preset: **React (Vite)**
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment: **Production**
3. Thêm các biến môi trường **Production** sau, đúng theo Firebase cũ (xem `frontend/.env.example`):

| Key | Giá trị |
|---|---|
| `VITE_API_URL` | `https://<ten-api>.onrender.com` (không có `/api` ở cuối) |
| `VITE_FIREBASE_API_KEY` | Firebase **Web API key** |
| `VITE_FIREBASE_AUTH_DOMAIN` | Tên miền Firebase Authentication của project (thường là `<project-id>.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_DATABASE_URL` | URL Firebase Realtime Database |
| `NODE_VERSION` | `22` |

**Quan trọng:** Giá trị `VITE_*` được đóng gói vào mã frontend khi build và người dùng có thể xem được. Không bao giờ đặt Service Account private key, `FIREBASE_SERVICE_ACCOUNT_BASE64`, token Admin hoặc mật khẩu trong `VITE_*`.

4. Deploy. Ghi lại URL thật do Cloudflare cấp, ví dụ `https://<ten-site>.pages.dev`. File `frontend/public/_redirects` có các rule cụ thể để `/it` và `/assets/<publicId>` mở trực tiếp/refresh; không có catch-all ghi đè file tĩnh.
5. Quay lại **Render > hexa-ticket-api > Environment** đổi `CLIENT_ORIGINS` thành **URL Pages chính xác** (ví dụ `https://<ten-site>.pages.dev`), **không thêm** dấu `/` cuối. Nếu có domain riêng khác, thêm sau dấu phẩy. Save và redeploy nếu Render yêu cầu.
6. Vào **Firebase Console > Authentication > Settings > Authorized domains**, thêm domain Pages **không có** `https://`, ví dụ `<ten-site>.pages.dev`.
7. Mở `https://<ten-site>.pages.dev/it`, thử đăng nhập IT, xem máy in, quản lý tài sản, kho, trạng thái ticket, các trang QR công khai. Kiểm tra `DevTools > Network` nếu có lỗi CORS/401/500.

## C. Test nghiệm thu và lưu ý miễn phí

- API `/api/health` trả 200 và JSON `ok: true`.
- Frontend `/<...>` ở Pages hoạt động, đặc biệt `/it`, `/assets/<publicId>`.
- API yêu cầu đăng nhập dùng token Firebase như trước.
- Các luồng thêm/sửa và dữ liệu cũ phải được kiểm tra **không xóa dữ liệu thực**.
- Xem Render > Logs nếu API báo lỗi xác thực Firebase.
- **Render Free ngủ sau 15 phút không có request**; yêu cầu mới có thể chờ ~1 phút để khởi động lại. **Đây không phải server 24/7**. Lịch quét reminder chạy trong Node.js sẽ dừng khi Render ngủ; với hệ thống ticket phục vụ công ty nên ưu tiên backend always-on (Render trả phí, máy Windows chạy liên tục kết hợp Cloudflare Tunnel có domain, hoặc một máy chủ khác).
- **Render Free có giới hạn 750 instance hours/workspace/tháng** và không phù hợp cho sản phẩm production yêu cầu SLA.
- Firebase Storage / Functions có thể yêu cầu Billing/Blaze và phí riêng; việc chuyển hosting **không tự sửa** lỗi upload Storage hoặc thiết lập lịch Firebase.

## D. Thử chạy local

`backend/.env` phải có credentials và `frontend/.env` có VITE vars như file `.env.example`.

```powershell
cd backend
npm ci
npm test
npm start

# Mở PowerShell thứ hai:
cd frontend
npm ci
npm run build
npm run dev
```

## Những thay đổi khi chuyển hosting

- `backend/src/server.js`: ở `NODE_ENV=production`, mặc định bind `0.0.0.0` (Render yêu cầu).
- `render.yaml`: tự động khai báo Render Web Service Free, yêu cầu điền bí mật riêng.
- `frontend/public/_redirects`: SPA fallback cho Cloudflare Pages.
- `frontend/.node-version`, `backend/.node-version`: chọn Node 22 khi build.
- `frontend/src/App.jsx` + 2 file: giữ cập nhật **đồng hồ và trạng thái mạng** mới nhất từ gói ngày 13/11.
- Bỏ các `vercel.json`, `.vercelignore`, `backend/index.js` chỉ dùng làm Vercel serverless entrypoint. Backend vẫn chạy `npm start`.
- Không chứa khóa Service Account, không tự push GitHub, không tự deploy tài khoản thật.
