import 'dotenv/config';
import { db, adminAuth } from '../src/firebase.js';

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');
if (!email || !password || password.length < 8 || !name) {
  console.error('Cách dùng: npm run seed:manager -- admin@company.com "MatKhauManh123!" "Trưởng phòng IT"');
  process.exit(1);
}
try {
  let user;
  try { user = await adminAuth.getUserByEmail(email); }
  catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    user = await adminAuth.createUser({ email, password, displayName: name });
  }
  await db.ref(`users/${user.uid}`).update({ name, email, role: 'manager', active: true,
    activeTickets: 0, totalAssigned: 0, createdAt: Date.now() });
  console.log(`Manager sẵn sàng: ${email} (UID: ${user.uid})`);
  console.log('Nếu email đã có trước đó, mật khẩu cũ được giữ nguyên.');
} catch (err) { console.error(err); process.exitCode = 1; }
