# HEXA Unified — chạy thủ công bằng npm (không dùng BAT)

Bản này đã có sẵn cấu hình thực tế trong `frontend/.env`, `backend/.env` và `backend/service-account.json` (Firebase `tickethexaa`). Không cần copy hay tạo lại các file này. Đã sửa lỗi dòng `CLIENT_ORIGINS` bị dính chú thích trong `.env` bản trước.

## Yêu cầu
- Windows 10/11, **Node.js phiên bản 22 trở lên**, npm.
- Có kết nối Internet lần đầu chạy `npm install`.
- Nếu Helpdesk cũ đang chạy: dừng cả terminal frontend/backend cũ để không trùng cổng hoặc chạy hai bộ hẹn giờ cùng lúc.

## 1. Chạy backend
Mở VS Code ở thư mục `HEXA-Unified-NPM-Ready`, chọn **Terminal > New Terminal** rồi chạy:

```powershell
cd backend
npm install
npm start
```

Giữ Terminal này mở. Test bằng trình duyệt: `http://127.0.0.1:4000/api/health`.
Kết quả kỳ vọng có `"ok":true`.

## 2. Chạy frontend
Mở **Terminal mới** trong VS Code ở thư mục gốc `HEXA-Unified-NPM-Ready`:

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://127.0.0.1:5173/it` để đăng nhập IT / Admin, hoặc `http://127.0.0.1:5173/` để gửi yêu cầu.

**Lưu ý:** Nếu mở Terminal từ thư mục khác, dùng `cd` để chuyển đến thư mục `backend` hoặc `frontend` tương ứng. Có thể dùng `npm ci` thay cho `npm install` nếu muốn cài đúng phiên bản trong lockfile.

## Lần chạy tiếp theo
- Backend: `cd backend` → `npm start`.
- Frontend: `cd frontend` → `npm run dev`.
- Không phải `npm install` lại trừ khi đổi dependencies hoặc xóa node_modules.

## Khi gặp lỗi
- `npm is not recognized`: cài Node.js 22+ rồi mở lại VS Code.
- Port 4000 / 5173 đang được dùng: dừng server cũ; không chạy hai bản HEXA cùng Firebase.
- Backend báo lỗi Service Account: xác nhận file `backend/service-account.json` vẫn nằm đúng chỗ (đã đóng gói sẵn).
- API health có `ok:true` nhưng không đăng nhập được: kiểm tra F12 Network/Console; tài khoản IT đăng nhập bằng Firebase Authentication cũ.
- `npm run dev` dùng 5174 vì 5173 bận: tốt nhất đóng Vite cũ và chạy 5173. .env backend đã cho phép localhost/127.0.0.1 của 5173 và 5174.

## Bảo mật và giới hạn
- ZIP có chứa **Firebase Service Account private key** do bạn cung cấp trước đó. Không chia sẻ ZIP này, không đẩy khóa lên GitHub hoặc Vercel. `.gitignore` đã chặn thêm khóa và các `.env` vào Git.
- Project là bản chạy local; máy cần bật để backend tự giao ticket và nhắc lịch.
- Chưa kiểm thử đăng nhập và ghi dữ liệu đầu-cuối trên Firebase của bạn từ môi trường đóng gói. Các kiểm thử logic backend đã chạy thành công.
