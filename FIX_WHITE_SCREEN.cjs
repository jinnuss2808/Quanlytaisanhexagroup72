'use strict';
/** HEXA hotfix for Firebase RTDB query.equalTo(undefined) on /it.
 * No .env or service-account.json is opened, printed, committed or uploaded.
 * Operates on the existing HEXA project (frontend/ and backend/).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = __dirname;
const frontFile = path.join(root, 'frontend', 'src', 'App.jsx');
const backFile = path.join(root, 'backend', 'src', 'app.js');
const frontDir = path.join(root, 'frontend');
const backDir = path.join(root, 'backend');
function fail(message) { console.error('[ERROR]', message); process.exit(1); }
if (!fs.existsSync(frontFile) || !fs.existsSync(backFile)) {
  fail('Dat FIX_WHITE_SCREEN.bat va FIX_WHITE_SCREEN.cjs o thu muc goc HEXA (cung cap frontend, backend).');
}
function replaceRequired(text, search, replacement, label, alreadyPattern) {
  if (alreadyPattern && text.includes(alreadyPattern)) return text;
  if (typeof search === 'string') {
    if (!text.includes(search)) fail('Khong tim thay doan code '+label+'. Source da thay doi: dung de tranh ghi de nham.');
    return text.replace(search, replacement);
  }
  if (!search.test(text)) fail('Khong tim thay doan code '+label+'. Source da thay doi: dung de tranh ghi de nham.');
  return text.replace(search, replacement);
}
let front = fs.readFileSync(frontFile, 'utf8');
let back = fs.readFileSync(backFile, 'utf8');
const originalFront = front;
const originalBack = back;
// /api/me must always return the verified Auth UID, not a stale profile UID.
back = replaceRequired(back, 'req.it = { uid: decoded.uid, ...person };',
  'req.it = { ...person, uid: decoded.uid };', 'backend IT uid', 'req.it = { ...person, uid: decoded.uid };');
back = replaceRequired(back, 'req.requester = { uid: decoded.uid, ...snap.val() };',
  'req.requester = { ...snap.val(), uid: decoded.uid };', 'backend requester uid', 'req.requester = { ...snap.val(), uid: decoded.uid };');
back = replaceRequired(back, 'requester = { uid: decoded.uid, ...snap.val() };',
  'requester = { ...snap.val(), uid: decoded.uid };', 'backend public requester uid', 'requester = { ...snap.val(), uid: decoded.uid };');
front = replaceRequired(front, 'setProfile(p); setAuthError(\'\');',
  'setProfile({ ...p, uid: firebaseUser.uid }); setAuthError(\'\');',
  'frontend profile uid', 'setProfile({ ...p, uid: firebaseUser.uid });');
const oldListener = `    const ticketsQuery = user.role === 'manager'
      ? query(ref(realtimeDb, 'tickets'), orderByChild('createdAt'), limitToLast(200))
      : query(ref(realtimeDb, 'tickets'), orderByChild('assignedTo'), equalTo(user.uid));
    const notificationQuery = query(ref(realtimeDb, \`notifications/\${user.uid}\`), orderByChild('createdAt'), limitToLast(50));
    const unsubscribeTickets = onValue(ticketsQuery, snap => setTickets(realtimeList(snap.val()).slice(0, 200)),
      err => setError('Không nhận được dữ liệu ticket trực tiếp: ' + err.message));
    const unsubscribeNotifications = onValue(notificationQuery, snap => setNotifications(realtimeList(snap.val())),
      err => setError('Không nhận được thông báo trực tiếp: ' + err.message));
    return () => { unsubscribeTickets(); unsubscribeNotifications(); };`;
const newListener = `    // Always use the signed-in Firebase Auth UID. Never call equalTo(undefined).
    const effectiveUid = auth.currentUser?.uid || user.uid;
    const validUid = typeof effectiveUid === 'string' && effectiveUid.trim().length > 0;
    const ticketsQuery = user.role === 'manager'
      ? query(ref(realtimeDb, 'tickets'), orderByChild('createdAt'), limitToLast(200))
      : validUid
        ? query(ref(realtimeDb, 'tickets'), orderByChild('assignedTo'), equalTo(effectiveUid))
        : null;
    const notificationQuery = validUid
      ? query(ref(realtimeDb, \`notifications/\${effectiveUid}\`), orderByChild('createdAt'), limitToLast(50))
      : null;
    if (!validUid) setError('Thiếu UID tài khoản Firebase, vui lòng đăng xuất rồi đăng nhập lại.');
    const unsubscribeTickets = ticketsQuery
      ? onValue(ticketsQuery, snap => setTickets(realtimeList(snap.val()).slice(0, 200)),
        err => setError('Không nhận được dữ liệu ticket trực tiếp: ' + err.message))
      : () => {};
    const unsubscribeNotifications = notificationQuery
      ? onValue(notificationQuery, snap => setNotifications(realtimeList(snap.val())),
        err => setError('Không nhận được thông báo trực tiếp: ' + err.message))
      : () => {};
    return () => { unsubscribeTickets(); unsubscribeNotifications(); };`;
front = replaceRequired(front, oldListener, newListener, 'realtime listener', 'const effectiveUid = auth.currentUser?.uid || user.uid;');
const oldRequester = `    const q = query(ref(realtimeDb, 'tickets'), orderByChild('requesterUid'), equalTo(uid));`;
const newRequester = `    const requesterUid = uid || auth.currentUser?.uid;
    if (typeof requesterUid !== 'string' || !requesterUid.trim()) {
      setError('Thiếu UID tài khoản người yêu cầu; vui lòng đăng nhập lại.');
      return;
    }
    const q = query(ref(realtimeDb, 'tickets'), orderByChild('requesterUid'), equalTo(requesterUid));`;
front = replaceRequired(front, oldRequester, newRequester, 'requester query', 'const requesterUid = uid || auth.currentUser?.uid;');
front = replaceRequired(front, '<RequesterTickets uid={requester.uid}/>',
  '<RequesterTickets uid={requester.uid || auth.currentUser?.uid}/>',
  'requester component uid', '<RequesterTickets uid={requester.uid || auth.currentUser?.uid}/>');
const changed = [];
if (front !== originalFront) changed.push([frontFile, originalFront, front]);
if (back !== originalBack) changed.push([backFile, originalBack, back]);
// Write only after all anchors were located. Back up before overwriting.
const stamp = new Date().toISOString().replace(/[.:]/g, '-');
for (const [file, oldText, newText] of changed) {
  const backup = file + '.bak-fix-uid-' + stamp;
  fs.writeFileSync(backup, oldText, 'utf8');
  fs.writeFileSync(file, newText, 'utf8');
  console.log('[OK] Patched', path.relative(root, file));
  console.log('[BACKUP]', path.relative(root, backup));
}
if (!changed.length) console.log('[OK] Code already fixed.');
console.log('Firebase .env, service-account JSON, tickets and assets remain unchanged.');
function run(cmd, args, cwd, required) {
  console.log('> ' + [cmd, ...args].join(' '));
  const win = process.platform === 'win32';
  const executable = win ? 'cmd.exe' : cmd;
  const fullArgs = win ? ['/d', '/s', '/c', cmd, ...args] : args;
  const result = spawnSync(executable, fullArgs, { cwd, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    console.error('[ERROR]', cmd + ' failed:', result.error?.message || result.status);
    if (required) process.exit(2);
    return false;
  }
  return true;
}
if (process.env.HEXA_PATCH_ONLY === '1') process.exit(0);
// Deploy frontend first so the browser crash is fixed even if backend deploy fails.
console.log('\n[VERCEL] Frontend production: ticket-asset-hexa');
run('vercel', ['link', '--yes', '--project', 'ticket-asset-hexa'], frontDir, true);
run('vercel', ['deploy', '--prod', '--yes'], frontDir, true);
console.log('\n[VERCEL] Backend production: ticket-asset-hexa-api');
if (run('vercel', ['link', '--yes', '--project', 'ticket-asset-hexa-api'], backDir, false)) {
  if (!run('vercel', ['deploy', '--prod', '--yes'], backDir, false)) {
    console.log('[WARN] Backend deploy failed. Frontend fix has been deployed; review backend env in Vercel.');
  }
} else {
  console.log('[WARN] Backend Vercel project not linked. Frontend hotfix remains deployed.');
}
// Commit just the two code files to GitHub, never env or Service Account.
if (fs.existsSync(path.join(root, '.git'))) {
  console.log('\n[GIT] Save source fix to GitHub so future Git deploy does not revert it.');
  if (run('git', ['add', '--', 'frontend/src/App.jsx', 'backend/src/app.js'], root, false)) {
    run('git', ['commit', '-m', 'fix: guard Firebase realtime queries with verified UID', '--only', '--', 'frontend/src/App.jsx', 'backend/src/app.js'], root, false);
    if (!run('git', ['push'], root, false)) console.log('[WARN] Git push failed. Push source changes later.');
  }
}
console.log('\nDONE. Open https://ticket-asset-hexa.vercel.app/it and press Ctrl+Shift+R.');
