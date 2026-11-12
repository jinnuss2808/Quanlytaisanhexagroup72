import { auth } from './firebase';
const base = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

export async function api(path, { method = 'GET', body, authRequired = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authRequired) {
    if (!auth.currentUser) throw new Error('Phiên đăng nhập đã hết.');
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  let response;
  try { response = await fetch(base + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new Error('Không kết nối được máy chủ API. Kiểm tra Node.js, Tunnel và VITE_API_URL.'); }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}
