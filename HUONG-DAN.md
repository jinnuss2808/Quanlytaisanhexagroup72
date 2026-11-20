# HEXA – QR chi tiết & sửa lỗi ảnh tài sản (20/11/2026)

Áp dụng cho project đang sử dụng:

`E:\HEXA-Ticket-Asset-ONE-DEPLOY-CLEAN\HEXA-Ticket-Asset-ONE-DEPLOY`

## Những thay đổi

- Trong cửa sổ QR của tài sản hiển thị thêm **Công ty sở hữu**, **Người đang sử dụng**, **Địa chỉ IP** (giá trị rỗng ghi "Chưa cập nhật").
- Khi quét QR: người **chưa đăng nhập** chỉ thấy các thông tin cơ bản như trước. Tài khoản IT đã đăng nhập hợp lệ sẽ thấy thêm IP, người đang sử dụng, phòng ban và serial. API mới `/api/assets/qr/:publicId/private` nằm sau middleware xác thực quyền IT.
- Sửa tab **Hình ảnh**: phân biệt đang tải / không tải được; nút thử lại; hiển thị lỗi lưu/tải Firebase Storage thay vì bỏ qua lỗi.
- Ảnh JPG/PNG/WebP lớn hơn 2,8 MB được tự chuyển sang JPEG và nén ở trình duyệt; ảnh gốc tối đa 15 MB. Tệp gửi thực tế nhỏ hơn 2,8 MB, tránh vướng giới hạn body request của Vercel. Ảnh nhỏ không bị chuyển đổi.
- Không thay đổi dữ liệu Firebase cũ, không xóa ảnh đã lưu, không đưa IP/tên người sử dụng ra API public.

## Cách áp dụng (không cần BAT)

1. **Sao lưu source** rồi giải nén ZIP. Chép `PATCH_HEXA_QR_ANH.cjs` và `asset-photo-upload.js` vào thư mục gốc HEXA (cùng cấp `frontend` và `backend`).
2. Chạy PowerShell tại thư mục HEXA:

```powershell
node .\PATCH_HEXA_QR_ANH.cjs --check
```

3. **Chỉ khi** hiện `[CHECK OK]`, chạy:

```powershell
node .\PATCH_HEXA_QR_ANH.cjs
cd backend
npm test
cd ..\frontend
npm run build
npm run dev
```

4. Mở lại tài sản ở local → Mã QR/ liên kết, thử quét trang QR khi chưa đăng nhập và khi đã đăng nhập IT. Mở tab Hình ảnh → thử ảnh JPG nhỏ, rồi PNG/JPEG lớn. Kiểm tra ảnh mới hiển thị và tải lại trang vẫn thấy ảnh.
5. Khi mọi kiểm tra đạt, push cả frontend/backend lên GitHub:

```powershell
cd ..
git add -- frontend/src/AssetManagement.jsx frontend/src/asset-management.css frontend/src/asset-photo-upload.js backend/src/asset-api.js
git diff --cached --check
git diff --cached --stat
git commit -m "Show detailed QR to IT and fix asset image upload"
git push origin main
```

Không cần commit hai file cài đặt `.cjs`/`.js` nằm ở thư mục gốc.

## Lưu ý bắt buộc nếu ảnh vẫn báo lỗi Firebase Storage

- Kiểm tra biến môi trường backend `FIREBASE_STORAGE_BUCKET` có giá trị là tên bucket **thật** đang sử dụng trong Firebase Console → Storage; không có tiền tố `gs://`.
- Với backend chạy trên Vercel, biến này phải có ở project **API** (ví dụ domain `hexagon72.vercel.app`), môi trường Production, rồi deploy lại backend.
- Firebase Admin Service Account phải có quyền đọc/ghi object trên bucket. Không dùng Firebase Web API key thay Service Account.
- Nếu trả HTTP 501: thiếu biến bucket. HTTP 503 kèm 403/404: xem quyền/bucket. HTTP 413: tệp quá lớn. Kiểm tra tab Network và Vercel Runtime Logs để biết chính xác.
- Cập nhật QR cần **deploy backend trước, frontend sau**. Ảnh trên local có thể khác production nếu hai backend dùng cấu hình Storage khác nhau.
- **Không đưa khóa Firebase** (`service-account.json`, `FIREBASE_SERVICE_ACCOUNT_BASE64`) vào GitHub hoặc gửi qua chat.

## Giới hạn kiểm thử

Đã kiểm tra `node --check` backend, parser JSX, hàm kiểm tra file ảnh (4 trường hợp), và áp dụng bản vá thử trên source HEXA 2 lần. Chưa đăng nhập/ghi ảnh thực tế vào Firebase hoặc chạy website production trên tài khoản của bạn; nếu ảnh vẫn lỗi cần mã HTTP/Runtime Logs của lần tải mới.

## Sao lưu

Bản vá tạo file backup ngoài repository tại thư mục `HEXA-PATCH-BACKUPS` trong thư mục người dùng Windows. Không tự động xóa file/ảnh/dữ liệu.
