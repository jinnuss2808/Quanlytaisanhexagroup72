/**
 * Atomic, conditional ticket updates for Firebase Realtime Database.
 *
 * Firebase's client-side transaction update callback can be invoked with null
 * while a real record exists on the server. Returning undefined for that first
 * call silently aborts a real ticket change ("Không tìm thấy yêu cầu").
 *
 * We instead read the server's current ETag and use a conditional PUT. The
 * server rejects stale writes with 412, so concurrent manager/auto assignments
 * cannot overwrite each other and a deleted ticket cannot be recreated.
 *
 * All requests use the backend service-account OAuth access token; this token
 * is NEVER sent to the browser. No RTDB rules need to be opened for writes.
 */

function makeSnapshot(data) {
  return {
    val: () => data,
    exists: () => data !== null && data !== undefined
  };
}

async function getAdminToken() {
  const { getApp } = await import('firebase-admin/app');
  const credential = getApp().options.credential;
  if (!credential || typeof credential.getAccessToken !== 'function') {
    throw new Error('Backend chưa được cấu hình Firebase Admin SDK service account.');
  }
  const credentials = await credential.getAccessToken();
  if (!credentials?.access_token) throw new Error('Không lấy được access token của Firebase Admin.');
  return credentials.access_token;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * @param ref Firebase Admin RTDB Reference at tickets/{ticketId}.
 * @param update Pure synchronous function(currentTicket) => updatedTicket or undefined to abort.
 * @param options Dependency injection for deterministic tests only.
 */
export async function transactExistingTicket(ref, update, options = {}) {
  const http = options.fetchImpl || fetch;
  const credential = options.getToken || getAdminToken;
  const maxAttempts = options.maxAttempts || 6;
  const url = new URL(ref.toString().replace(/\/+$/, '') + '.json');
  if (url.protocol !== 'https:' && !options.allowHttpForTest) {
    throw new Error('Realtime Database phải sử dụng HTTPS.');
  }
  const expectedHost = process.env.FIREBASE_DATABASE_URL
    ? new URL(process.env.FIREBASE_DATABASE_URL).host : null;
  if (expectedHost && url.host !== expectedHost && !options.allowHttpForTest) {
    throw new Error('Địa chỉ Firebase Database trong backend không khớp cấu hình.');
  }
  url.searchParams.set('access_token', await credential());
  const endpoint = url.toString();
  const common = { cache: 'no-store', signal: AbortSignal.timeout(20000) };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const read = await http(endpoint, {
      ...common,
      method: 'GET',
      headers: { 'X-Firebase-ETag': 'true' }
    });
    if (!read.ok) {
      throw httpError(502, `Không thể đọc ticket từ Firebase (HTTP ${read.status}).`);
    }
    const etag = read.headers.get('etag');
    if (!etag) throw httpError(502, 'Firebase không trả về ETag để cập nhật an toàn.');
    const current = await read.json();
    if (current === null || current === undefined) {
      return { committed: false, snapshot: makeSnapshot(null) };
    }

    // Supply a fresh copy: an updater must not mutate current or perform I/O.
    let updated;
    try {
      updated = update(structuredClone(current));
    } catch (error) {
      // Throw before a write, never from inside a Firebase SDK transaction callback.
      throw error;
    }
    if (updated === undefined) {
      return { committed: false, snapshot: makeSnapshot(current) };
    }
    if (updated === null || typeof updated !== 'object' || Array.isArray(updated)) {
      throw httpError(500, 'Cập nhật ticket không hợp lệ.');
    }
    // Do not allow an updater to change the ticket identity.
    if (updated.id !== current.id) {
      throw httpError(500, 'Không được thay đổi mã định danh ticket.');
    }

    const write = await http(endpoint, {
      ...common,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(updated)
    });
    if (write.status === 412) continue; // The record changed: re-read before retrying.
    if (!write.ok) throw httpError(502, `Không thể lưu ticket lên Firebase (HTTP ${write.status}).`);
    return { committed: true, snapshot: makeSnapshot(updated) };
  }
  throw httpError(409, 'Ticket đang được cập nhật ở phiên khác. Vui lòng thử lại.');
}
