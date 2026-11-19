# HEXA — Tích hợp Chấm công và Link mail (19/11/2026)

Bản cập nhật bổ sung tính năng vào dự án HEXA React/Node/Firebase hiện tại. **Không tạo lại project**, không chạy các BAT deploy cũ, không sửa dữ liệu tài sản/máy in/ticket.

## Tính năng

**1. Chấm công** (menu trái, tài khoản Quản lý IT):
- Tạo nhân viên: mã nhân viên, họ tên, công ty, email, mật khẩu khởi tạo.
- Firebase Authentication quản lý mật khẩu. Mật khẩu **không** lưu trong bảng `attendanceEmployees`.
- Khóa/mở khóa tài khoản, xem giờ vào/ra theo tháng; dữ liệu lưu tại `attendanceRecords/YYYY-MM/{uid}/YYYY-MM-DD`.
- Trang cho nhân viên đăng nhập và bấm giờ vào/ra: `https://hexa72.vercel.app/attendance` hoặc `http://127.0.0.1:5173/attendance`.
- Thời điểm chấm công lấy từ backend, hiển thị múi giờ `Asia/Ho_Chi_Minh`. Mỗi ngày ghi giờ vào một lần và giờ ra một lần, không cho sửa từ trình duyệt.
- Chức năng này **không xác minh GPS, ca đêm, máy chấm vân tay hoặc vị trí làm việc**. Nếu cần những quy tắc đó phải xây dựng chính sách bổ sung.

**2. Link mail** (menu trái, chỉ Quản lý IT):
- Lưu tên liên kết, URL HTTPS, tên tài khoản, mật khẩu mã hóa AES-256-GCM trong Firebase Realtime Database (`mailVault`).
- Có nút Mở trang, Chép tài khoản, Chép mật khẩu (thao tác riêng biệt có ghi nhật ký xem mật khẩu), Sửa và Xóa.
- Dữ liệu mật khẩu **không xuất hiện trong API danh sách**, không đưa vào GitHub/Vite/frontend, chỉ giải mã trên backend cho người có quyền Admin.
- Form điền sẵn URL `https://103.232.120.76/domainadmin/` cho mục "Tạo mail HEXA"; **không tạo sẵn tài khoản hay mật khẩu**.
- **Không tự điền được mật khẩu sang website khác** bằng ReactJS vì chính sách cùng nguồn (same-origin). Để tự điền ở trang mail, hãy sử dụng trình quản lý mật khẩu của trình duyệt hoặc tích hợp SSO/API chính thức từ hệ thống mail nếu có.

## Cách cài vào đúng project đang chạy trên ổ E

1. **Sao lưu** project trước khi cài. Giải nén toàn bộ ZIP vào thư mục gốc chứa `backend/` và `frontend/`, ví dụ:
   `E:\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\HEXA-Ticket-Asset-ONE-DEPLOY`.
2. Mở PowerShell tại thư mục đó. Kiểm tra trước, **chưa đổi bất kỳ file nào**:

   ```powershell
   node .\APPLY_HEXA_CHAM_CONG_MAIL.cjs --check
   ```

3. Nếu không báo STOP, áp dụng:

   ```powershell
   node .\APPLY_HEXA_CHAM_CONG_MAIL.cjs
   ```

   Script thêm 9 file và chèn mã vào `frontend/src/App.jsx`, `backend/src/app.js`. Tự sao lưu các file bị thay đổi vào thư mục TEMP trước khi ghi đè. Nếu không tìm được điểm chèn do phiên bản source khác, script **dừng không sửa file**, không áp dụng patch mù.

4. Tạo khóa mới **một lần duy nhất** tại PowerShell hoặc CMD:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Sao chép 64 ký tự hex và cấu hình `MAIL_VAULT_KEY` **chỉ ở backend**:
   - Local: file `backend/.env` (không commit)
   - Vercel backend `quanlytaisanhexa72`: Settings → Environment Variables → `MAIL_VAULT_KEY` → loại **Secret** → Production (và môi trường cần dùng)

   **Rất quan trọng:** hai nơi phải dùng cùng **một khóa** nếu dùng chung Firebase. Lưu bản dự phòng khóa an toàn. Mất/đổi khóa sẽ không giải mã được mật khẩu mail đã lưu. Không gửi khóa qua chat, không đưa vào frontend / `VITE_*`.

5. Kiểm tra:

   ```powershell
   cd backend
   npm test
   cd ..\frontend
   npm ci --include=dev
   npm run build
   cd ..
   git status --short
   ```

6. Nếu đã kiểm thử local thành công, commit **đúng những file đã cập nhật**:

   ```powershell
   git add -- frontend/src/App.jsx frontend/src/AttendanceManagement.jsx frontend/src/AttendanceClock.jsx frontend/src/MailLinks.jsx frontend/src/hexa-modules.css
   git add -- backend/src/app.js backend/src/attendance-core.js backend/src/attendance-api.js backend/src/mail-vault-core.js backend/src/mail-vault-api.js backend/test/attendance-mail.test.js
   git diff --cached --stat
   git diff --cached --check
   git commit -m "Add attendance and secured mail links"
   git push origin main
   ```

   Đừng dùng `git add .` trước khi kiểm tra file bí mật. **Không commit** `backend/.env`, `service-account.json`, password hay khóa mã hóa.

7. Sau khi push, kiểm tra cả hai project Vercel kết nối Git: frontend `hexa72-web-oneclick` (Root `frontend`) và backend `quanlytaisanhexa72` (Root `backend`). Xác nhận cả **hai** nhận commit mới và đạt Ready trước khi dùng, vì API mới nằm ở backend. URL backend production hiện dùng: `https://hexagon72.vercel.app`; frontend `VITE_API_URL` cần trỏ đúng URL này.

## Giới hạn kiểm thử

Đã chạy 121/121 bài kiểm thử backend và kiểm tra cú pháp 4 file JSX bằng TypeScript parser. Chưa chạy được build Vite trong container do thiếu dependency npm offline, chưa kiểm thử với Firebase/Vercel thật, chưa xác nhận form đăng nhập trên trang `domainadmin`.

Không dùng bộ này để chấm công pháp lý/tiền lương nếu chưa bổ sung quy trình duyệt, GPS/chống gian lận và chính sách ca làm việc phù hợp.
