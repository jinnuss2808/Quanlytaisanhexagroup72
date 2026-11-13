import { randomUUID } from 'node:crypto';

export const LIB_CATEGORIES = Object.freeze(['software', 'printer_driver', 'script', 'document']);
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;
export const SIGNED_URL_MS = 10 * 60 * 1000;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,128}$/;
const FILE_EXT = /\.(exe|msi|msix|zip|7z|rar|cab|inf|pdf|docx?|xlsx?|txt|md|bat|cmd|ps1|psm1|reg|iso|dmg|pkg|deb|rpm)$/i;

export function libError(status, message) { return Object.assign(new Error(message), { status }); }
export function libId(value) {
  if (!IDENTIFIER.test(String(value || ''))) throw libError(400, 'Mã định danh không hợp lệ.');
  return value;
}
export function safeText(value, length = 255) { return String(value ?? '').trim().slice(0, length); }
export function normalizeExternalUrl(value) {
  const text = safeText(value, 2000);
  let parsed;
  try { parsed = new URL(text); } catch { throw libError(400, 'Đường dẫn không hợp lệ.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw libError(400, 'Chỉ cho phép liên kết HTTPS không chứa thông tin đăng nhập.');
  }
  return parsed.href;
}
export function normalizeLibraryFields(body = {}) {
  const title = safeText(body.title, 160), category = safeText(body.category, 32);
  if (!title) throw libError(400, 'Cần nhập tên bộ cài / driver / công cụ.');
  if (!LIB_CATEGORIES.includes(category)) throw libError(400, 'Nhóm tài liệu không hợp lệ.');
  const printerIds = Array.isArray(body.printerIds) ? [...new Set(body.printerIds.map(libId))] : [];
  if (printerIds.length > 20) throw libError(400, 'Tối đa 20 máy in cho một file.');
  if (printerIds.length && category !== 'printer_driver' && category !== 'document') {
    throw libError(400, 'Chỉ gắn driver hoặc tài liệu vào máy in.');
  }
  return {
    title, category, description: safeText(body.description, 1500),
    version: safeText(body.version, 80), platform: safeText(body.platform, 120),
    vendor: safeText(body.vendor, 120), printerIds,
  };
}
export function validateFile({name, size, contentType} = {}) {
  const filename = safeText(name, 180);
  const length = Number(size);
  if (!filename || /[\\/\u0000-\u001F]/.test(filename) || !FILE_EXT.test(filename)) {
    throw libError(400, 'Định dạng file chưa được cho phép.');
  }
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_UPLOAD_BYTES) {
    throw libError(400, 'File phải từ 1 byte đến 150 MB.');
  }
  const mime = safeText(contentType || 'application/octet-stream', 100);
  if (!/^[a-z0-9][\w.+-]*\/[a-z0-9][\w.+-]*$/i.test(mime)) throw libError(400, 'Content-Type không hợp lệ.');
  return { filename, length, mime };
}
export function buildStoragePath() { return `it-library/${randomUUID()}`; }
export function getVisibleRow(row) {
  const {storagePath, externalUrl, ...safe} = row;
  return {...safe, kind: row.kind};
}
export function hasPrinter(row, printerId) { return Array.isArray(row.printerIds) && row.printerIds.includes(printerId); }
