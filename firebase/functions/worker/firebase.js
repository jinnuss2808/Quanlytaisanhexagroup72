import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase, ServerValue } from 'firebase-admin/database';

if (!getApps().length) initializeApp({
  credential: applicationDefault(),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://tickethexaa-default-rtdb.firebaseio.com',
  ...(process.env.FIREBASE_PROJECT_ID ? {projectId:process.env.FIREBASE_PROJECT_ID} : {}),
});
export const db=getDatabase();
export const adminAuth=getAuth();
export { ServerValue };
