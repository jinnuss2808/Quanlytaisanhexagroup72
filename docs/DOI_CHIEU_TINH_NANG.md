# Đối chiếu 2 hệ thống trước/sau hợp nhất

## 1. Helpdesk (giữ nguyên)

- React/Vite, Node/Express, Firebase Auth/RTDB
- Hai tab yêu cầu Support và yêu cầu tài sản, phân quyền Manager/Agent
- 5 phút tự giao, nhắc Support 30 phút và tài sản 12 giờ, tiếp nhận/từ chối, ngày nghỉ
- Quản lý Admin và nhân viên, người gửi (công tắc OFF), xác nhận/đánh giá sao
- Thống kê theo tháng và năm, số lượt được đánh giá và sao trung bình

## 2. Tài sản (đã viết lại Node/Firebase)

- Danh sách, tìm kiếm, lọc/phân trang/đếm trạng thái
- Thêm/sửa, công ty sở hữu, loại tài sản, serial, IP, giá mua, ngày mua, ghi chú
- Bàn giao/thu hồi với lịch sử, công ty sở hữu không bị đổi tự động
- Xóa mềm / phục hồi, danh mục công ty/loại do Admin quản lý
- Phần mềm và hình ảnh (cần bật Firebase Storage)
- Dữ liệu liên kết từ phiếu yêu cầu thiết bị (tạo asset từ ticket)
- Tra cứu tài sản công khai bằng PublicId mới
- Nhập/xuất CSV UTF-8 theo 11 trường cũ

## 3. Chưa chuyển nguyên trạng vì thiếu backup SQL / ảnh

- Tài sản và người sử dụng hiện có trong SQL thực
- Toàn bộ lịch sử cấp phát/nhận và lịch sử kiểm toán trước đây
- Mã QR/PublicId gốc, ảnh, các tệp Excel định dạng .xlsx
- Tài khoản / mật khẩu SQL cũ, các user phải dùng chung Firebase Auth mới

**Quy trình migration chuẩn:** backup SQL cũ → xuất bảng/danh mục/ảnh/lịch sử → thử nhập lên bản sao RTDB → đối chiếu số lượng và mã → sao lưu → mới chuyển chính thức. Không xóa SQL nguồn cho đến khi đối chiếu xong.
