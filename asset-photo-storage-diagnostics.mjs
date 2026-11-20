// HEXA_ASSET_PHOTO_DIAGNOSTICS_20261120
// Pure helpers: never log credentials, object content, or untrusted error messages to clients.
export function photoStorageError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.publicCode = code;
  error.expose = true;
  return error;
}

export function storageBucketName(raw) {
  const text = String(raw || '').trim().replace(/^gs:\/\//i, '').replace(/\/+$/, '');
  if (!text) throw photoStorageError(503, 'STORAGE_BUCKET_MISSING',
    'Chưa có FIREBASE_STORAGE_BUCKET tại backend. Vào Firebase Console → Storage, sao chép tên bucket thực tế và thêm vào biến môi trường backend trên Vercel.');
  if (!/^[a-z0-9][a-z0-9._-]{2,221}$/i.test(text) || text.includes('..') || text.includes('//')) {
    throw photoStorageError(503, 'STORAGE_BUCKET_INVALID',
      'FIREBASE_STORAGE_BUCKET không hợp lệ. Chỉ nhập tên bucket thực tế, không dùng URL https:// hoặc dấu /.');
  }
  return text;
}

export function classifyStorageFailure(err, operation = 'write') {
  if (err?.expose && err?.publicCode) return err;
  const rawCode = err?.code ?? err?.statusCode ?? err?.status ?? err?.response?.status;
  const statusCode = Number(rawCode);
  const msg = String(err?.message || '');
  const code = String(rawCode || '');
  if (/billing|blaze|billingnotenabled|paymentrequired/i.test(msg) || statusCode === 402) {
    return photoStorageError(503, 'STORAGE_BILLING_REQUIRED', 'Firebase Storage yêu cầu kiểm tra gói Blaze / trạng thái thanh toán của dự án Firebase.');
  }
  if (/quota|rate.?limit|resource exhausted/i.test(msg) || statusCode === 429) {
    return photoStorageError(503, 'STORAGE_QUOTA', 'Firebase Storage đang giới hạn dung lượng hoặc lượt yêu cầu. Kiểm tra Usage / Billing trên Firebase.');
  }
  if (statusCode === 401 || statusCode === 403 || /permission.?denied|access denied|does not have storage\.objects\.|forbidden/i.test(msg)) {
    return photoStorageError(503, 'STORAGE_PERMISSION_DENIED', 'Firebase Storage từ chối truy cập. Kiểm tra Service Account của backend có quyền đọc/ghi đối tượng trên bucket hay không.');
  }
  if (statusCode === 404 || /bucket (?:does not exist|not found)|no such bucket|not found:.*bucket/i.test(msg)) {
    return photoStorageError(503, 'STORAGE_BUCKET_NOT_FOUND', 'Không tìm thấy Firebase Storage bucket. Kiểm tra tên bucket trong Firebase Console → Storage và FIREBASE_STORAGE_BUCKET của backend.');
  }
  if (statusCode === 412) {
    return photoStorageError(503, 'STORAGE_PRECONDITION', 'Firebase Storage không đáp ứng điều kiện truy cập. Kiểm tra bucket, dịch vụ Storage và quyền Firebase Service Agent.');
  }
  if (/invalid_grant|could not load the default credentials|invalid.?credential|unauthenticated|private_key|jwt/i.test(msg)) {
    return photoStorageError(503, 'STORAGE_CREDENTIALS', 'Không thể xác thực Firebase Admin khi truy cập Storage. Kiểm tra service account của backend.');
  }
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network error/i.test(code + ' ' + msg)) {
    return photoStorageError(503, 'STORAGE_NETWORK', 'Backend chưa kết nối được dịch vụ Firebase Storage. Hãy thử lại và xem Vercel Runtime Logs.');
  }
  return photoStorageError(503, 'STORAGE_' + (operation === 'read' ? 'READ' : operation === 'check' ? 'CHECK' : 'WRITE') + '_ERROR',
    'Firebase Storage gặp lỗi khi ' + (operation === 'read' ? 'đọc' : operation === 'check' ? 'kiểm tra' : 'lưu') + ' ảnh. Xem Vercel Runtime Logs để biết lỗi gốc.');
}
