# HEXA – Import nhân viên có cột trống, bỏ qua bản ghi trùng và sắp xếp mã (19/11/2026)

Bản ZIP này **thay thế bản `HEXA-DANH-BA-GON-LINK-MAIL-NHAN-VIEN-20261119.zip`**. Nếu đã cài bản trước thì vẫn có thể dùng ZIP này để cập nhật. Chức năng Link mail và danh sách nhân viên đã có được giữ nguyên.

## Các thay đổi

- Có thể để trống **Mã NV**, **Tên**, **Phòng/Công ty** hoặc **Mật khẩu** (khi import Excel và khi thêm/sửa thủ công).
- Mỗi dòng cần **ít nhất Mã NV hoặc Mail** để kiểm tra trùng. Không nhập dòng hoàn toàn thiếu cả hai, vì không thể nhận diện để tránh trùng.
- Nếu mã NV (không trống) **hoặc** email (không trống) đã tồn tại thì **bỏ qua dòng đó**, giữ nguyên bản ghi cũ. So sánh không phân biệt chữ hoa/chữ thường và bỏ khoảng trắng đầu/cuối.
- Dòng không hợp lệ được báo số dòng và bỏ qua **riêng**, các dòng hợp lệ vẫn được nhập; không dừng cả file Excel. Không hiển thị nội dung mật khẩu trong thông báo lỗi.
- Sắp xếp theo **số sau dấu chấm**: `CL18.211` → `CL23.212` → `CL18.213` → `CL18.326`. Nếu trùng số thì so theo mã đầy đủ. Nhân viên **chưa có mã** nằm cuối; trong nhóm đó sắp xếp theo email.
- Mật khẩu có thể bỏ trống; nếu có mật khẩu mới thì chỉ lưu ở backend bằng `MAIL_VAULT_KEY` đã cấu hình. Không sửa mật khẩu cũ khi import gặp bản ghi trùng.
- Không tạo Firebase Authentication account, không ghi giờ chấm công, không xóa bất kỳ nhân viên nào.

**Lưu ý:** File Excel vẫn nên có 5 tiêu đề cột đúng mẫu `Mã NV | Tên | Phòng | Mail | Mật khẩu` (các **ô dữ liệu** được để trống); định dạng `.xlsx`.

## Cách áp dụng trên project ổ E

1. Sao lưu mã nguồn đang sử dụng.
2. Giải nén **toàn bộ** ZIP vào thư mục:

   `E:\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\HEXA-Ticket-Asset-ONE-DEPLOY`

   Đảm bảo file `CAP_NHAT_HEXA_DANH_BA_GON.cjs` và thư mục `modules/` nằm **cùng cấp** `backend/` và `frontend/`. Ghi đè bản `modules` cũ nếu đã tải.
3. Mở PowerShell tại thư mục gốc và chạy:

   ```powershell
   node .\CAP_NHAT_HEXA_DANH_BA_GON.cjs --check
   node .\CAP_NHAT_HEXA_DANH_BA_GON.cjs
   cd backend
   npm test
   cd ..\frontend
   npm run build
   cd ..
   ```

   Chỉ chạy lệnh áp dụng thứ hai sau khi `--check` đạt. Script sao lưu các file bị thay đổi ở `HEXA-code-backups` trong thư mục người dùng, không can thiệp dữ liệu Firebase.

## Đẩy lên GitHub / Vercel

Sau khi kiểm tra local, ở thư mục gốc:

```powershell
git add -- backend/src/attendance-api.js backend/src/employee-roster-core.js backend/src/asset-excel.js backend/test/employee-roster.test.js
git add -- frontend/src/AttendanceManagement.jsx frontend/src/MailLinks.jsx frontend/src/hexa-modules.css frontend/public/Mau_Nhap_Nhan_Vien_HEXA.xlsx
git diff --cached --stat
git diff --cached --check
git commit -m "Allow incomplete employee records and numeric roster sorting"
git push origin main
```

Không dùng `git add .` khi dự án còn file `.env`, khóa Firebase, file Excel thật chứa mật khẩu hay script vá cũ. Giữ **nguyên `MAIL_VAULT_KEY`** backend ở local/Vercel và chờ cả frontend và backend nhận deployment Git mới.

## Kết quả đã thử

- 9/9 bài test phần import/lọc trùng/sắp xếp trên mã nguồn được sửa: đạt.
- Nhập file Excel `.xlsx` thử với các ô trống: tạo 3 dòng, bỏ 1 dòng trùng.
- Kiểm tra cú pháp `AttendanceManagement.jsx`, `attendance-api.js` và trình cài đặt: đạt.
- Chưa kiểm thử với Firebase thật hoặc trên website production của bạn. Lần nhập đầu nên dùng file Excel mẫu ít dòng để xác minh.
