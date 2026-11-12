'use strict';
// Source repair only. No Firebase database mutations, no deployment from this file.
// Run: node PATCH_HEXA_SAFE.cjs "C:\\path\\to\\HEXA-project"
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(process.argv[2] || process.cwd());
const front = path.join(root, 'frontend', 'src', 'App.jsx');
const back = path.join(root, 'backend', 'src', 'app.js');
function abort(msg) { console.error('[HEXA STOP]', msg); process.exit(2); }
if (!fs.existsSync(front) || !fs.existsSync(back)) abort('Thieu frontend/src/App.jsx hoac backend/src/app.js. Chon dung thu muc goc HEXA.');
const initialFront = fs.readFileSync(front, 'utf8');
const initialBack = fs.readFileSync(back, 'utf8');
let f = initialFront, b = initialBack;
function replace(oldValue, newValue, label, already) {
  if (already && (Array.isArray(already) ? already.some(x => f.includes(x)) : f.includes(already))) return;
  if (f.includes(oldValue)) { f = f.replace(oldValue, newValue); return; }
  abort('Khong nhan dien duoc ' + label + ' trong App.jsx. De an toan, khong sua ma nguon phien ban khac.');
}
function replaceBack(oldValue, newValue, label) {
  if (b.includes(newValue)) return;
  if (b.includes(oldValue)) { b = b.replace(oldValue, newValue); return; }
  // A newer version may already compute UID safely. Do not change unknown code.
  console.log('[SKIP]', label, '(khong co mau cu; vui long kiem tra source)');
}
replaceBack('req.it = { uid: decoded.uid, ...person };',
  'req.it = { ...person, uid: decoded.uid };', 'backend UID Admin/IT');
replaceBack('req.requester = { uid: decoded.uid, ...snap.val() };',
  'req.requester = { ...snap.val(), uid: decoded.uid };', 'backend UID requester');
replaceBack('requester = { uid: decoded.uid, ...snap.val() };',
  'requester = { ...snap.val(), uid: decoded.uid };', 'backend UID requester fallback');
replace("setProfile(p); setAuthError('');",
  "setProfile({ ...p, uid: firebaseUser.uid }); setAuthError('');",
  'UID ho so Firebase', 'setProfile({ ...p, uid: firebaseUser.uid });');
const listenerOld = `    const ticketsQuery = user.role === 'manager'
      ? query(ref(realtimeDb, 'tickets'), orderByChild('createdAt'), limitToLast(200))
      : query(ref(realtimeDb, 'tickets'), orderByChild('assignedTo'), equalTo(user.uid));
    const notificationQuery = query(ref(realtimeDb, \`notifications/\${user.uid}\`), orderByChild('createdAt'), limitToLast(50));
    const unsubscribeTickets = onValue(ticketsQuery, snap => setTickets(realtimeList(snap.val()).slice(0, 200)),
      err => setError('Không nhận được dữ liệu ticket trực tiếp: ' + err.message));
    const unsubscribeNotifications = onValue(notificationQuery, snap => setNotifications(realtimeList(snap.val())),
      err => setError('Không nhận được thông báo trực tiếp: ' + err.message));
    return () => { unsubscribeTickets(); unsubscribeNotifications(); };`;
const listenerNew = `    // Protect against equalTo(undefined) when Auth/profile hydration is delayed.
    const effectiveUid = auth.currentUser?.uid || user?.uid;
    const validUid = typeof effectiveUid === 'string' && effectiveUid.trim().length > 0;
    const ticketsQuery = user.role === 'manager'
      ? query(ref(realtimeDb, 'tickets'), orderByChild('createdAt'), limitToLast(200))
      : validUid
        ? query(ref(realtimeDb, 'tickets'), orderByChild('assignedTo'), equalTo(effectiveUid))
        : null;
    const notificationQuery = validUid
      ? query(ref(realtimeDb, \`notifications/\${effectiveUid}\`), orderByChild('createdAt'), limitToLast(50))
      : null;
    if (!validUid) setError('Phiên đăng nhập thiếu UID Firebase. Vui lòng đăng xuất và đăng nhập lại.');
    const unsubscribeTickets = ticketsQuery
      ? onValue(ticketsQuery, snap => setTickets(realtimeList(snap.val()).slice(0, 200)),
        err => setError('Không nhận được dữ liệu ticket trực tiếp: ' + err.message))
      : () => {};
    const unsubscribeNotifications = notificationQuery
      ? onValue(notificationQuery, snap => setNotifications(realtimeList(snap.val())),
        err => setError('Không nhận được thông báo trực tiếp: ' + err.message))
      : () => {};
    return () => { unsubscribeTickets(); unsubscribeNotifications(); };`;
replace(listenerOld, listenerNew, 'listener Ticket/Notification', 'const effectiveUid = auth.currentUser?.uid');
const requesterOld = `    const q = query(ref(realtimeDb, 'tickets'), orderByChild('requesterUid'), equalTo(uid));`;
const requesterNew = `    const validRequesterUid = typeof uid === 'string' && uid.trim() ? uid : auth.currentUser?.uid;
    if (typeof validRequesterUid !== 'string' || !validRequesterUid.trim()) {
      setError('Thiếu UID người yêu cầu. Vui lòng đăng nhập lại.');
      return;
    }
    const q = query(ref(realtimeDb, 'tickets'), orderByChild('requesterUid'), equalTo(validRequesterUid));`;
replace(requesterOld, requesterNew, 'truy van ticket nguoi yeu cau', ['const validRequesterUid = typeof uid', 'const requesterUid = uid || auth.currentUser?.uid;']);
replace('<RequesterTickets uid={requester.uid}/>',
  '<RequesterTickets uid={requester?.uid || auth.currentUser?.uid}/>',
  'UID tu trang Public', ['<RequesterTickets uid={requester?.uid || auth.currentUser?.uid}/>', '<RequesterTickets uid={requester.uid || auth.currentUser?.uid}/>']);
// React Error Boundary: an unforeseen render crash should never become a blank page.
if (!f.includes('class HexaErrorBoundary extends React.Component')) {
  const boundary = `class HexaErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[HEXA REACT CRASH]', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || 'Unknown React error').slice(0, 350);
    return <main style={{fontFamily:'Arial,sans-serif', maxWidth:650, margin:'10vh auto', padding:26, background:'#fff', border:'1px solid #e1e8f3', borderRadius:12, color:'#182b4b'}}>
      <h2 style={{marginTop:0}}>HEXA gặp lỗi giao diện</h2>
      <p>Ứng dụng không còn hiển thị màn hình trắng. Hãy sao chép mã lỗi dưới đây và gửi bộ phận IT.</p>
      <pre style={{whiteSpace:'pre-wrap', padding:14, background:'#f1f4fa', borderRadius:8}}>{message}</pre>
      <button onClick={() => window.location.reload()} style={{padding:'10px 18px', color:'#fff', background:'#2867e8', border:0, borderRadius:8, cursor:'pointer'}}>Tải lại trang</button>
    </main>;
  }
}
\n`;
  const anchor = 'export default function App() {';
  if (!f.includes(anchor)) abort('Khong tim thay export default function App() de them Crash Boundary.');
  f = f.replace(anchor, boundary + 'function HexaApp() {');
  f += `\nexport default function App() {\n  return <HexaErrorBoundary><HexaApp/></HexaErrorBoundary>;\n}\n`;
}
// A failed patch should not silently publish a build containing the original crash.
if (/equalTo\s*\(\s*(?:user\.uid|uid)\s*\)/.test(f)) abort('Van con equalTo(user.uid) / equalTo(uid) chua duoc bao ve.');
if (!f.includes('class HexaErrorBoundary extends React.Component')) abort('Chua bo sung React Error Boundary.');
const changed = [[front,initialFront,f],[back,initialBack,b]].filter(([_,oldContent,newContent])=>oldContent!==newContent);
if (!changed.length) { console.log('[OK] HEXA da duoc va nhu cac dieu kien can thiet.'); process.exit(0); }
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hexa-source-backup-'));
for (const [file,oldContent,newContent] of changed) {
  const relative=path.relative(root,file);
  const target=path.join(backupDir,relative);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,oldContent,'utf8');
  fs.writeFileSync(file,newContent,'utf8');
  console.log('[PATCH]',relative);
}
console.log('[BACKUP]',backupDir);
console.log('[OK] Da sua React + UID; chua dong den .env, token, data Firebase.');
