# HEXA - Sửa trực tiếp project đang chạy trên ổ E (17/11/2026)

Mã nguồn trong gói được lấy từ `HEXA-Ticket-Asset-ONE-DEPLOY(2).7z` do bạn cung cấp. Không tạo Firebase mới và không thay đổi logic quản lý tài sản, máy in, kho hoặc ticket.

## Áp dụng bản vá trực tiếp

Thư mục project Windows hiện tại:

`E:\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\HEXA-Ticket-Asset-ONE-DEPLOY`

1. Sao lưu riêng thư mục project hiện có nếu chưa sao lưu.
2. **Giải nén file `HEXA-Va-Truc-Tiep-Vercel.zip` vào CHÍNH thư mục trên**, ghi đè đúng các file trùng tên. Không giải nén thành một project con. Thư mục `frontend/`, `backend/`, `.git/` và các file `.env` đang có vẫn giữ nguyên.
3. Chạy `node tools\deploy-hexa.mjs --check-only` trong CMD/PowerShell tại thư mục trên để kiểm tra cấu trúc (không truy cập Vercel).
4. Chạy `DEPLOY_HEXA_VERCEL.bat` từ thư mục gốc. Node.js 22+, npm, mạng và quyền Vercel cần có. Khi được yêu cầu hãy đăng nhập Vercel hợp lệ.

## Hai project Vercel đang sử dụng

| Project | Root Directory trong Vercel (Git integration) | Framework |
| --- | --- | --- |
| `quanlytaisanhexagroup72-api` | `backend` | Express |
| `quanlytaisanhexagroup72-web` | `frontend` | Vite |

**Rất quan trọng:** Script mới chạy Vercel CLI từ **THƯ MỤC GỐC REPOSITORY**, không chạy `--cwd backend` hay `--cwd frontend`. Vì project đã đặt Root Directory phía Vercel, cách chạy này tránh nhân đôi thư mục và các phản hồi 404/HTML trước đó. Nếu `vercel project inspect` cho biết Root Directory sai, script sẽ dừng, thay vì đẩy nhầm. Không tự ý đổi Root Directory phía Vercel.

Vercel CLI đăng nhập là bước cần quyền tài khoản. Các project trên phải tồn tại trong tài khoản/team đang đăng nhập. Script không tự tạo hoặc xóa project khác.

## Các bước tự động

- Kiểm tra chính xác các file `backend/index.js`, `backend/src/app.js`, `frontend/src/App.jsx`.
- Đọc `.env` + `.env.local` ở local; file `.env.local` chỉ chứa OIDC không được làm mất các biến Firebase trong `.env`.
- Kiểm tra service account của Firebase từ local mà không tải file khóa lên repo.
- Chạy `npm ci`, `npm test` backend, `npm run build` frontend trước khi thay đổi production.
- Chuyển các script cũ dạng `APPLY_*`, `FIX_*`, `PATCH_*`, `DEPLOY_*` trong gốc project sang `C:\Users\<user>\HEXA_BACKUP_SCRIPTS\...` (không xóa vĩnh viễn). Sao lưu và bỏ `backend/vercel.json` hoặc `backend/api/index.js` cũ để Express được autodetect theo `backend/index.js`.
- Liên kết project API, cập nhật biến môi trường production từ `.env` local, deploy backend, kiểm tra `/api/health` phải trả JSON thực, và kiểm tra URL production không bị Deployment Protection.
- **Chỉ sau khi API thành công**, liên kết web, cập nhật Vite env và deploy frontend.

## Trường hợp phải dừng

- Không có khóa Firebase Admin local hoặc giá trị Firebase Web: không tự tạo khóa giả.
- Project Vercel chưa thuộc tài khoản/team đang đăng nhập: không tạo bản sao ở team khác.
- API vẫn trả HTML/404/500, hoặc domain production đang bị bảo vệ: dừng và in log rõ ràng. Đọc Vercel Runtime Logs để tìm lỗi phía cloud.

Log được lưu trong `%TEMP%\HEXA-deploy-*.log` (không ghi giá trị bí mật).

## Sau khi triển khai

Kiểm tra backend: `https://quanlytaisanhexagroup72-api.vercel.app/api/health` (phải là JSON có `ok: true`). Mở frontend `https://quanlytaisanhexagroup72-web.vercel.app/it`; thêm hostname frontend vào Firebase Authentication Authorized domains nếu chưa có.

Thay đổi deploy qua CLI không tự push code lên GitHub. Nếu muốn GitHub tự deploy trong tương lai, commit mã nguồn an toàn sau khi kiểm tra `git status` và các file `.env`, khóa JSON không được track.

**Trạng thái nghiệm thu:** Mã nguồn/backend và frontend unit tests đã kiểm tra; cú pháp script và bước preflight đã kiểm tra. Chưa xác nhận build Vite thật trên Windows của bạn, hoặc runtime Vercel trên tài khoản bạn. Không thể đảm bảo cloud thành công khi quyền project, Protection, Firebase hoặc Root Directory trên Vercel chưa đúng.
