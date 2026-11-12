# HEXA – Một bộ triển khai GitHub → Vercel

## Những lỗi từ các BAT cũ được loại bỏ

- Không chạy `npm ci` vào `frontend/node_modules` khi Vite/esbuild đang hoạt động (lỗi `EPERM unlink esbuild.exe`). Bộ kiểm tra dùng thư mục tạm mới.
- Không dùng bản Git tạm để push rồi bỏ lại thư mục làm việc. Repo Git được cấu hình ngay trong thư mục project này.
- Không force-push GitHub. Nếu remote `main` đã tồn tại, script fetch, tạo nhánh backup cho commit local cũ, rồi đưa mã nguồn hiện tại thành commit tiếp theo dựa trên remote.
- Không có prompt bí ẩn `Type YES` bắt buộc: chạy BAT, đọc thông tin rồi bấm Enter để xác nhận (N để hủy).
- Không đưa `.env`, `service-account.json`, `node_modules`, `dist`, `.vercel` lên GitHub.
- Kiểm tra Vercel Root Directory riêng cho `backend` và `frontend`; xác nhận kết nối Git cho cả hai project.
- Chỉ báo hoàn tất khi API Production trả `ok: true` và frontend phản hồi HTML.

## Chạy lần đầu

1. Giải nén toàn bộ project vào thư mục bạn muốn dùng lâu dài. **Không giải nén đè lên project cũ đang chạy** nếu bạn còn thay đổi chưa lưu; nên sao lưu bản cũ.
2. Đảm bảo Windows có Node.js **22+**, Git, GitHub CLI (`gh`) và Vercel CLI (`vercel`). Đăng nhập `gh auth login` và `vercel login` nếu chưa đăng nhập. GitHub tài khoản hiện tại phải có quyền repo; Vercel cần thuộc team `trungs-projects`.
3. Nhấp đúp **`DEPLOY_HEXA.bat`** trong thư mục gốc (ngang hàng `frontend` và `backend`).
4. Nhấn Enter để xác nhận. Script sẽ test/build, đồng bộ repo GitHub Private `ticket-asset-hexa`, kết nối hai project Vercel `ticket-asset-hexa-api` và `ticket-asset-hexa`, nạp biến môi trường đã có, đẩy commit kích hoạt deployment và kiểm tra URL.
5. Nếu Vercel báo GitHub App chưa có quyền, vào Vercel → project → **Settings → Git** cấp quyền kết nối repo Private, sau đó chạy lại BAT. Không tạo thêm project khác.
6. Tại Firebase → Authentication → Settings → Authorized domains, nếu chưa có, thêm `ticket-asset-hexa.vercel.app`.

## Mỗi lần cập nhật sau (tại thư mục project này)

```powershell
git add -A
git commit -m "Update HEXA"
git push origin main
```

Các project Vercel đã kết nối Git sẽ tự chạy build khi có commit mới trên `main`. Không cần chạy lại BAT.

## Chạy localhost (không liên quan deploy)

Trên máy mới giải nén, vì ZIP không chứa `node_modules`, cần **cài một lần** trong từng thư mục:

```powershell
cd backend
npm ci
npm start
```

Mở terminal thứ hai:

```powershell
cd frontend
npm ci
npm run dev
```

Lệnh `npm run dev` sẽ báo `vite is not recognized` nếu bạn chưa `npm ci` trong **chính** thư mục `frontend`. Bộ kiểm tra deploy cài thư viện **trong thư mục tạm**, không nhằm cài thư viện cho localhost.

## Giới hạn thực tế

- Script phải chạy trên Windows có Internet, GitHub/Vercel đăng nhập và quyền GitHub App. Tôi không thể xác nhận deploy thành công trên tài khoản của bạn trước khi chạy script tại máy bạn.
- Cloud Vercel không giữ tiến trình `setInterval` chạy 24/24. Nhắc việc định kỳ muốn chạy khi tắt máy cần triển khai riêng Firebase Cloud Functions / Cloud Scheduler; gói này chỉ triển khai GitHub, frontend và API.
- File ZIP **chứa `.env` và Service Account do bạn cung cấp** để khỏi cấu hình lại local. Tuyệt đối không công khai ZIP, không đưa file khóa lên GitHub, và nên thay khóa Firebase nếu nó từng bị công khai trước đó.
- Khi triển khai từ Git, cấu hình hai Vercel Project bắt buộc có Root Directory lần lượt `frontend`, `backend`. BAT đặt và kiểm tra bằng Vercel CLI API; nếu tài khoản thiếu quyền sửa cấu hình, script dừng với hướng dẫn trong Terminal.
- API Health chỉ chứng minh backend có thể phản hồi; phải kiểm thử đăng nhập, đọc/ghi Firebase, thêm ticket và thao tác tài sản trực tiếp sau deploy.

## Địa chỉ dự kiến

- Frontend: `https://ticket-asset-hexa.vercel.app/it`
- API: `https://ticket-asset-hexa-api.vercel.app/api/health`

## Khi thất bại

Xem **dòng `[DEPLOY FAILED]` đầu tiên** trong Terminal và mục Deployments/Logs trên Vercel. Đừng xóa Firebase hoặc dùng `git push --force` để sửa lỗi này.
