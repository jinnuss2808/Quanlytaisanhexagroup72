import 'dotenv/config';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// Tự nhận file khóa ở backend, không phụ thuộc đường dẫn máy cũ.
const bundledServiceAccount = resolve(dirname(fileURLToPath(import.meta.url)), '../service-account.json');
// The local JSON is never bundled in Vercel. Cloud credential comes from a secret env var.

if (!process.env.FIREBASE_DATABASE_URL) {
  throw new Error('Thiếu FIREBASE_DATABASE_URL trong backend/.env (URL Realtime Database của Firebase).');
}
if (!getApps().length) {
  // Local: use backend/service-account.json (never in frontend).
  // Vercel: use FIREBASE_SERVICE_ACCOUNT_BASE64 as a server-only environment variable.
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    let account;
    try { account = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not a valid base64-encoded JSON key.'); }
    if (!account.project_id || !account.private_key || !account.client_email) throw new Error('Firebase service account is missing required fields.');
    if (process.env.FIREBASE_PROJECT_ID && account.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('Service account project mismatch.');
    credential = cert(account);
  } else if (existsSync(bundledServiceAccount)) {
    credential = cert(JSON.parse(readFileSync(bundledServiceAccount, 'utf8')));
  } else {
    credential = applicationDefault();
  }
  initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
  });
}
export const db = getDatabase();
export const adminAuth = getAuth();
export { ServerValue };
