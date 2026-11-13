import express from 'express';
import assetRouter, { publicAssetHandler } from './asset-api.js';
import warehouseRouter from './warehouse-api.js';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { db, adminAuth, ServerValue } from './firebase.js';
import { TYPE, STATUS, ACTIVE_STATUS, DEADLINE_MS, isValidEmail,
  normalizeText, statusDelta, entriesToArray, newestFirst, computeWorkloads, computeCurrentAssignmentCounts } from './core.js';
import { notifyNewTicket, notifyPeople } from './notify.js';
import { reminderInterval } from './reminder-core.js';
import { createReport, yearMonth } from './report.js';
import { transactExistingTicket } from './ticket-transaction.js';
import { vietnamDate, validDate } from './workflow.js';
import { applySharedTicketStatus } from './shared-ticket.js';
import { validateRequesterEmail, validateRequesterPassword, validateRequesterProfile, isRequesterEnabled, canRequesterConfirm, requesterLevel } from './requester-account.js';
import { isITRole, mustKeepAnotherManager, countOtherManagers } from './admin-roles.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean);
// Vite can use 5174 when 5173 is occupied; support both loopback hosts in local dev.
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174');
}
app.use(cors({ origin(origin, cb) {
  if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new HttpError(403, 'Nguồn truy cập không được phép.'));
} }));
app.use(express.json({ limit: '32kb' }));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function itemPath(kind, id) {
  // Prevent slashes, periods and forbidden RTDB key characters from being supplied in URL path parameters.
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) fail(400, 'Mã định danh không hợp lệ.');
  return `${kind}/${id}`;
}
async function requireIT(req, _res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) fail(401, 'Vui lòng đăng nhập tài khoản IT.');
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token, true); }
    catch { fail(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'); }
    const snap = await db.ref(`users/${decoded.uid}`).get();
    const person = snap.val();
    if (!person || person.active !== true || !['manager', 'agent'].includes(person.role)) {
      fail(403, 'Tài khoản chưa được cấp quyền IT.');
    }
    req.it = { ...person, uid: decoded.uid };
    next();
  } catch (err) { next(err); }
}
function requireManager(req, _res, next) {
  if (req.it.role !== 'manager') return next(new HttpError(403, 'Chỉ quản lý được sử dụng chức năng này.'));
  next();
}
function canAccess(_ticket, it) { return it.active === true && ['agent', 'manager'].includes(it.role); }
async function requireSignedIn(req, _res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) fail(401, 'Bạn cần đăng nhập tài khoản người yêu cầu.');
    try { req.identity = await adminAuth.verifyIdToken(token, true); }
    catch { fail(401, 'Phiên đăng nhập không hợp lệ.'); }
    next();
  } catch (err) { next(err); }
}
async function readWorkflow() {
  const snap = await db.ref('settings/requesterWorkflowEnabled').get();
  return snap.val() === true;
}
async function requireRequester(req, _res, next) {
  try {
    if (!(await readWorkflow())) fail(403, 'Chế độ người yêu cầu đăng nhập đang tắt.');
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) fail(401, 'Bạn cần đăng nhập.');
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token, true); }
    catch { fail(401, 'Phiên đăng nhập không hợp lệ.'); }
    const snap = await db.ref(`requesters/${decoded.uid}`).get();
    if (!snap.exists()) fail(403, 'Bạn cần hoàn tất hồ sơ người yêu cầu.');
    if (!isRequesterEnabled(snap.val())) fail(403, 'Tài khoản đã bị quản lý khóa.');
    req.requester = { ...snap.val(), uid: decoded.uid };
    next();
  } catch (err) { next(err); }
}
function sanitizeTicketInput(body) {
  const type = body.type;
  const requesterName = normalizeText(body.requesterName, 100);
  const department = normalizeText(body.department, 100);
  const position = normalizeText(body.position, 100);
  const subject = normalizeText(body.subject, 160);
  const description = normalizeText(body.description, 3000);
  const contact = normalizeText(body.contact, 100);
  // New public tickets have no user-selected priority.
  const priority = 'normal';
  const itemName = normalizeText(body.itemName, 120);
  const quantity = Number(body.quantity || 1);
  if (!TYPE.includes(type)) fail(400, 'Loại yêu cầu không hợp lệ.');
  if (!requesterName || !department || !position || !subject || !description || !contact) fail(400, 'Hãy nhập đầy đủ các trường bắt buộc.');
  if (type === 'equipment' && (!itemName || !Number.isInteger(quantity) || quantity < 1 || quantity > 999)) fail(400, 'Thông tin thiết bị hoặc số lượng không hợp lệ.');
  if (type === 'support' && quantity !== 1) fail(400, 'Số lượng không hợp lệ.');
  return { type, requesterName, department, position, subject, description, contact,
    email: isValidEmail(body.email) ? body.email.trim().toLowerCase() : null,
    priority, itemName: type === 'equipment' ? itemName : null, quantity: type === 'equipment' ? quantity : null };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'hexa-it-helpdesk', database: 'firebase-realtime-database' }));
// Shared IT identity: ticket and asset management use the same Firebase account.
app.get('/api/public/assets/:publicId', publicAssetHandler);
app.use('/api/assets', requireIT, assetRouter);
app.use('/api/warehouse', requireIT, warehouseRouter);
// OFF by default. This setting is persisted in Realtime Database only by a manager.
app.get('/api/public/settings', asyncRoute(async (_req, res) => {
  res.json({ requesterWorkflowEnabled: await readWorkflow() });
}));
app.get('/api/settings', requireIT, requireManager, asyncRoute(async (_req, res) => {
  res.json({ requesterWorkflowEnabled: await readWorkflow() });
}));
app.patch('/api/settings', requireIT, requireManager, asyncRoute(async (req, res) => {
  if (typeof req.body?.requesterWorkflowEnabled !== 'boolean') fail(400, 'Giá trị công tắc không hợp lệ.');
  await db.ref('settings/requesterWorkflowEnabled').set(req.body.requesterWorkflowEnabled);
  res.json({ requesterWorkflowEnabled: req.body.requesterWorkflowEnabled });
}));
// Self-service requester registration: email verification links are NOT required.
app.post('/api/requester/register', requireSignedIn, asyncRoute(async (req, res) => {
  if (!(await readWorkflow())) fail(403, 'Chế độ tài khoản người yêu cầu đang tắt.');
  if ((await db.ref(`users/${req.identity.uid}`).get()).exists()) fail(403, 'Tài khoản IT không thể đăng ký thành người yêu cầu.');
  const profile = validateRequesterProfile(req.body);
  const authUser = await adminAuth.getUser(req.identity.uid);
  if (!authUser.email || authUser.disabled) fail(403, 'Tài khoản không hợp lệ hoặc đã bị khóa.');
  const path = db.ref(`requesters/${req.identity.uid}`);
  const wanted = requesterLevel(req.body?.jobLevel);
  const initial = { ...profile, email: authUser.email, active: true, createdAt: Date.now(),
    jobLevel: 'employee', requestedJobLevel: wanted, jobLevelApproved: wanted !== 'manager' };
  await path.transaction(old => old || initial, undefined, false);
  const saved = (await path.get()).val();
  if (!isRequesterEnabled(saved)) fail(403, 'Tài khoản đã bị quản lý khóa.');
  res.json({ uid: req.identity.uid, ...saved });
}));

// Manager-only account maintenance; passwords are never read or stored in RTDB.
app.get('/api/requesters', requireIT, requireManager, asyncRoute(async (_req, res) => {
  const snap = await db.ref('requesters').get();
  const accounts = Object.entries(snap.val() || {}).map(([uid, p]) => ({ uid, ...p }));
  res.json(accounts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
}));
app.post('/api/requesters', requireIT, requireManager, asyncRoute(async (req, res) => {
  const profile = validateRequesterProfile(req.body);
  const email = validateRequesterEmail(req.body?.email);
  const password = validateRequesterPassword(req.body?.password);
  let created;
  try { created = await adminAuth.createUser({ email, password, displayName: profile.name, emailVerified: false }); }
  catch (err) { if (err.code === 'auth/email-already-exists') fail(409, 'Email đã được đăng ký.'); throw err; }
  const jobLevel = requesterLevel(req.body?.jobLevel);
  const person = { ...profile, email, active: true, createdAt: Date.now(), createdByAdmin: true,
    jobLevel, requestedJobLevel: jobLevel, jobLevelApproved: true };
  try { await db.ref(`requesters/${created.uid}`).set(person); }
  catch (err) { await adminAuth.deleteUser(created.uid).catch(console.error); throw err; }
  res.status(201).json({ uid: created.uid, ...person });
}));
app.patch('/api/requesters/:uid', requireIT, requireManager, asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  itemPath('requesters', uid);
  const path = db.ref(`requesters/${uid}`);
  const old = (await path.get()).val();
  if (!old) fail(404, 'Không tìm thấy tài khoản người yêu cầu.');
  const profile = validateRequesterProfile(req.body);
  const email = validateRequesterEmail(req.body?.email);
  const active = req.body?.active;
  if (typeof active !== 'boolean') fail(400, 'Trạng thái tài khoản không hợp lệ.');
  if ((await db.ref(`users/${uid}`).get()).exists()) fail(403, 'Tài khoản nội bộ không thể chỉnh tại đây.');
  try { await adminAuth.updateUser(uid, { email, displayName: profile.name, disabled: !active }); }
  catch (err) { if (err.code === 'auth/email-already-exists') fail(409, 'Email đã được đăng ký.'); throw err; }
  if (!active || old.email !== email) await adminAuth.revokeRefreshTokens(uid);
  const jobLevel = requesterLevel(req.body?.jobLevel ?? old.jobLevel);
  const updated = { ...old, ...profile, email, active, jobLevel,
    requestedJobLevel: jobLevel, jobLevelApproved: true, updatedAt: Date.now() };
  await path.set(updated);
  res.json({ uid, ...updated });
}));
app.patch('/api/requesters/:uid/password', requireIT, requireManager, asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  itemPath('requesters', uid);
  if (!(await db.ref(`requesters/${uid}`).get()).exists()) fail(404, 'Không tìm thấy người yêu cầu.');
  if ((await db.ref(`users/${uid}`).get()).exists()) fail(403, 'Không thể đặt lại mật khẩu tài khoản IT tại đây.');
  const password = validateRequesterPassword(req.body?.password);
  await adminAuth.updateUser(uid, { password });
  await adminAuth.revokeRefreshTokens(uid);
  res.json({ ok: true, message: 'Đã đặt mật khẩu mới. Mật khẩu cũ không thể xem lại.' });
}));
app.delete('/api/requesters/:uid', requireIT, requireManager, asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  itemPath('requesters', uid);
  const path = db.ref(`requesters/${uid}`);
  const old = (await path.get()).val();
  if (!old) fail(404, 'Không tìm thấy tài khoản người yêu cầu.');
  if ((await db.ref(`users/${uid}`).get()).exists()) fail(403, 'Không thể xóa tài khoản IT ở đây.');
  // Immediately deny requester access even if its token has not expired.
  await path.child('active').set(false);
  try { await adminAuth.deleteUser(uid); }
  catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
  // Existing tickets retain requesterUid, name and history for reporting/audit.
  // IT can close orphaned tickets through the status endpoint.
  await path.remove();
  res.json({ ok: true, message: 'Đã xóa tài khoản. Ticket và lịch sử vẫn được giữ lại.' });
}));

app.get('/api/requester/me', requireRequester, asyncRoute(async (req, res) => res.json(req.requester)));
app.get('/api/requester/tickets', requireRequester, asyncRoute(async (req, res) => {
  const snap = await db.ref('tickets').orderByChild('requesterUid').equalTo(req.requester.uid).get();
  res.json(entriesToArray(snap.val()).sort(newestFirst).slice(0, 200));
}));
app.patch('/api/requester/tickets/:id/confirm', requireRequester, asyncRoute(async (req, res) => {
  const rating = Number(req.body?.rating);
  const review = normalizeText(req.body?.review, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Vui lòng đánh giá từ 1 đến 5 sao.');
  const ticketRef = db.ref(itemPath('tickets', req.params.id));
  const now = Date.now();
  const result = await transactExistingTicket(ticketRef, ticket => {
    if (!ticket || ticket.requesterUid !== req.requester.uid || ticket.status !== 'resolved') return;
    return { ...ticket, status: 'closed', requesterConfirmedAt: now, requesterRating: rating,
      requesterReview: review, ratedAt: now,
      ratedAgentUid: ticket.completedBy || ticket.assignedTo || null,
      ratedAgentName: ticket.completedByName || ticket.assignedToName || null,
      updatedAt: now, nextReminderAt: null };
  });
  if (!result.committed) fail(409, 'Ticket không thuộc tài khoản của bạn hoặc chưa ở trạng thái Đã xử lý.');
  const ticket = result.snapshot.val();
  const actId = db.ref(`activities/${req.params.id}`).push().key;
  await db.ref(`activities/${req.params.id}/${actId}`).set({
    actorId: req.requester.uid, actorName: req.requester.name, action: 'requester_confirmed',
    detail: `Người yêu cầu xác nhận hoàn thành và đánh giá ${rating}/5 sao` + (review ? `: ${review}` : ''), createdAt: now
  });
  const users = (await db.ref('users').get()).val() || {};
  const managers = Object.entries(users).filter(([, u]) => u.active === true && u.role === 'manager').map(([uid]) => uid);
  try { await notifyPeople([...managers, ticket.assignedTo], ticket.id, `Người gửi đã đóng · ${ticket.code}`,
    `Đánh giá: ${rating}/5 sao`); } catch (err) { console.error('[confirmation] notification:', err); }
  res.json({ ok: true, status: 'closed' });
}));
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.' } });
app.post('/api/public/tickets', publicLimiter, asyncRoute(async (req, res) => {
  const input = sanitizeTicketInput(req.body || {});
  const enabled = await readWorkflow();
  let requester = null;
  if (enabled) {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) fail(401, 'Bạn cần đăng nhập để gửi yêu cầu.');
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token, true); }
    catch { fail(401, 'Phiên đăng nhập đã hết hạn.'); }
    const snap = await db.ref(`requesters/${decoded.uid}`).get();
    if (!snap.exists()) fail(403, 'Vui lòng hoàn thiện hồ sơ người yêu cầu.');
    if (!isRequesterEnabled(snap.val())) fail(403, 'Tài khoản người yêu cầu đã bị khóa.');
    requester = { uid: decoded.uid, ...snap.val() };
  }
  // Atomic counter increment, then a multi-location write for the ticket and its initial activity.
  const counter = await db.ref('meta/ticketCounter').transaction(n => (Number(n) || 0) + 1, undefined, false);
  if (!counter.committed) fail(503, 'Không cấp được mã phiếu.');
  const code = `${input.type === 'support' ? 'IT' : 'TB'}-${String(counter.snapshot.val()).padStart(6, '0')}`;
  const ticketRef = db.ref('tickets').push();
  const activityId = db.ref(`activities/${ticketRef.key}`).push().key;
  const now = Date.now();
  const ticket = { ...input, ...(requester ? { requesterUid: requester.uid, requesterName: requester.name,
    department: requester.department, position: requester.position, contact: requester.contact, email: requester.email,
    requesterJobLevel: requester.jobLevel, requesterLevelApproved: requester.jobLevelApproved === true } : {}),
    id: ticketRef.key, code, status: 'new', assignedTo: null, assignedToName: null,
    assignmentMethod: null, assignedAt: null, createdAt: now, updatedAt: now, assignmentDeadline: null,
    nextReminderAt: now + reminderInterval(input.type), lastReminderAt: null, reminderCount: 0,
    completedAt: null, completedBy: null, completedByName: null };
  await db.ref().update({
    [`tickets/${ticketRef.key}`]: ticket,
    [`activities/${ticketRef.key}/${activityId}`]: { action: 'created', actorId: null,
      actorName: requester?.name || input.requesterName, detail: 'Yêu cầu được gửi thành công', createdAt: now },
  });
  try { await notifyNewTicket(ticket); }
  catch (err) { console.error('[notification] new ticket:', err); }
  res.status(201).json({ id: ticket.id, code: ticket.code, status: ticket.status });
}));

app.get('/api/me', requireIT, (req, res) => res.json(req.it));
app.get('/api/tickets', requireIT, asyncRoute(async (_req, res) => {
  // Shared queue for every active IT account, including Admin.
  const snap = await db.ref('tickets').get();
  res.json(entriesToArray(snap.val()).sort(newestFirst));
}));
app.get('/api/tickets/:id/activities', requireIT, asyncRoute(async (req, res) => {
  const path = itemPath('tickets', req.params.id);
  const ticket = (await db.ref(path).get()).val();
  if (!ticket) fail(404, 'Không tìm thấy yêu cầu.');
  if (!canAccess(ticket, req.it)) fail(403, 'Bạn không có quyền xem yêu cầu này.');
  const snap = await db.ref(`activities/${req.params.id}`).orderByChild('createdAt').limitToLast(150).get();
  res.json(entriesToArray(snap.val()).sort((a,b) => a.createdAt - b.createdAt));
}));
app.post('/api/tickets/:id/comments', requireIT, asyncRoute(async (req, res) => {
  const comment = normalizeText(req.body?.comment, 2000);
  if (!comment) fail(400, 'Vui lòng nhập ghi chú.');
  const path = itemPath('tickets', req.params.id);
  const now = Date.now();
  const result = await transactExistingTicket(db.ref(path), ticket => {
    if (!ticket || !canAccess(ticket, req.it)) return;
    return { ...ticket, updatedAt: now };
  });
  if (!result.committed) {
    const latest = (await db.ref(path).get()).val();
    if (!latest) fail(404, 'Không tìm thấy yêu cầu.');
    if (!canAccess(latest, req.it)) fail(403, 'Bạn không có quyền ghi chú.');
    fail(409, 'Ticket vừa được thay đổi. Vui lòng thử lại.');
  }
  const activityId = db.ref(`activities/${req.params.id}`).push().key;
  await db.ref(`activities/${req.params.id}/${activityId}`).set({ action: 'comment', actorId: req.it.uid,
    actorName: req.it.name, detail: comment, createdAt: now });
  res.status(201).json({ ok: true });
}));
app.patch('/api/tickets/:id/status', requireIT, asyncRoute(async (req, res) => {
  const newStatus = req.body?.status;
  if (!STATUS.includes(newStatus)) fail(400, 'Trạng thái không hợp lệ.');
  const path = itemPath('tickets', req.params.id);
  let before;
  const now = Date.now();
  const requesterMode = await readWorkflow();
  let requesterCanConfirm = false;
  if (newStatus === 'closed' && requesterMode) {
    const old = (await db.ref(path).get()).val();
    if (old?.requesterUid) {
      const p = (await db.ref(`requesters/${old.requesterUid}`).get()).val();
      requesterCanConfirm = canRequesterConfirm(p, requesterMode);
    }
  }
  const result = await transactExistingTicket(db.ref(path), ticket => {
    if (!ticket) return;
    const next = applySharedTicketStatus(ticket, newStatus, req.it, now, requesterCanConfirm);
    if (!next) return;
    if (ACTIVE_STATUS.has(newStatus) && !next.nextReminderAt) next.nextReminderAt = now + reminderInterval(ticket.type);
    before = { ...ticket };
    return next;
  });
  if (!result.committed) {
    const latest = (await db.ref(path).get()).val();
    if (!latest) fail(404, 'Không tìm thấy yêu cầu.');
    if (latest.status === newStatus) {
      if (!ACTIVE_STATUS.has(newStatus) && latest.completedBy && latest.completedBy !== req.it.uid) {
        fail(409, `Ticket đã được ${latest.completedByName || 'nhân viên khác'} hoàn thành.`);
      }
      return res.json({ ok:true, changed:false, completedBy:latest.completedBy || null });
    }
    if (newStatus === 'closed' && requesterCanConfirm && latest.requesterUid) fail(409, 'Người yêu cầu phải xác nhận đóng ticket.');
    if (!ACTIVE_STATUS.has(latest.status) && ACTIVE_STATUS.has(newStatus) && req.it.role !== 'manager') {
      fail(403, 'Chỉ Admin có thể mở lại ticket đã hoàn thành.');
    }
    fail(409, 'Trạng thái ticket vừa thay đổi. Vui lòng tải lại.');
  }
  const ticket = result.snapshot.val();
  const activityId = db.ref(`activities/${req.params.id}`).push().key;
  await db.ref(`activities/${req.params.id}/${activityId}`).set({
    action: ACTIVE_STATUS.has(before.status) && !ACTIVE_STATUS.has(newStatus) ? 'completed' : 'status_changed',
    actorId:req.it.uid, actorName:req.it.name,
    detail: ACTIVE_STATUS.has(before.status) && !ACTIVE_STATUS.has(newStatus)
      ? `${req.it.name} đã hoàn thành ticket (${before.status} → ${newStatus})`
      : `${before.status} → ${newStatus}`,
    createdAt:now
  });
  try {
    const people = (await db.ref('users').get()).val() || {};
    const targets = Object.entries(people).filter(([, p]) => p.active === true && ['agent','manager'].includes(p.role)).map(([uid])=>uid);
    await notifyPeople(targets, req.params.id, `Ticket cập nhật · ${ticket.code}`,
      !ACTIVE_STATUS.has(newStatus) ? `${ticket.completedByName || req.it.name} đã hoàn thành ticket.` : `Trạng thái mới: ${newStatus}`);
  } catch (err) { console.error('[notifications] status:', err); }
  res.json({ ok:true, changed:true, completedBy:ticket.completedBy || null });
}));

// The old individual assignment / accept / reject workflow is retired.
// Return a clear response to clients that still have a cached old build.
app.patch('/api/tickets/:id/assign', requireIT, (_req, res) => res.status(410).json({ error:'HEXA đã chuyển sang hàng chờ chung, không còn giao việc.' }));
app.post('/api/tickets/:id/decision', requireIT, (_req, res) => res.status(410).json({ error:'HEXA không còn yêu cầu Tiếp nhận/Từ chối.' }));

// Leave is self-service and inclusive by Vietnam local date (00:00–23:59 UTC+7).
app.get('/api/me/leaves', requireIT, asyncRoute(async (req, res) => {
  const snap = await db.ref(`users/${req.it.uid}/leavePeriods`).get();
  res.json(entriesToArray(snap.val()).sort((a,b) => b.startDate.localeCompare(a.startDate)));
}));
app.post('/api/me/leaves', requireIT, asyncRoute(async (req, res) => {
  if (req.it.role !== 'agent') fail(403, 'Chỉ nhân viên IT đăng ký ngày nghỉ.');
  const { startDate, endDate } = req.body || {};
  const note = normalizeText(req.body?.note, 300);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) fail(400, 'Khoảng ngày nghỉ không hợp lệ.');
  const duration = (Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000 + 1;
  if (duration > 366 || endDate < vietnamDate()) fail(400, 'Chỉ cho phép đăng ký tối đa 366 ngày và chưa kết thúc.');
  const node = db.ref(`users/${req.it.uid}/leavePeriods`).push();
  await node.set({ startDate, endDate, note, createdAt: Date.now() });
  res.status(201).json({ id: node.key, startDate, endDate, note });
}));
app.delete('/api/me/leaves/:id', requireIT, asyncRoute(async (req, res) => {
  itemPath('leavePeriods', req.params.id);
  const ref = db.ref(`users/${req.it.uid}/leavePeriods/${req.params.id}`);
  if (!(await ref.get()).exists()) fail(404, 'Không tìm thấy lịch nghỉ.');
  await ref.remove();
  res.json({ ok: true });
}));

// Keep role mutations ordered within this Node.js instance. The last-manager
// invariant is also checked against a fresh RTDB snapshot inside each mutation.
let accountMutationQueue = Promise.resolve();
function serializeAccountMutation(action) {
  const running = accountMutationQueue.then(action);
  accountMutationQueue = running.catch(() => {});
  return running;
}
async function assertActorStillManager(uid) {
  const current = (await db.ref(`users/${uid}`).get()).val();
  if (!current || current.active !== true || current.role !== 'manager') {
    fail(403, 'Quyền Admin của bạn đã thay đổi. Vui lòng đăng nhập lại.');
  }
}
async function assertManagerSafety(uid, old, role, active) {
  if (!mustKeepAnotherManager(old, role, active)) return;
  const current = (await db.ref('users').get()).val() || {};
  if (countOtherManagers(current, uid) < 1) {
    fail(409, 'Cần giữ lại ít nhất một Admin đang hoạt động. Hãy tạo hoặc kích hoạt Admin khác trước.');
  }
}
async function writeAdminAudit(actorUid, action, targetUid, changes = {}) {
  // Never write passwords, password hashes or tokens to Realtime Database.
  try {
    await db.ref('adminAudit').push({ actorUid, action, targetUid, changes, createdAt: Date.now() });
  } catch (err) { console.error('[admin-audit]', err); }
}

app.get('/api/users', requireIT, requireManager, asyncRoute(async (_req, res) => {
  const [people, tickets] = await Promise.all([db.ref('users').get(), db.ref('tickets').get()]);
  const counts = {};
  for (const t of entriesToArray(tickets.val())) {
    if (!['resolved', 'closed'].includes(t.status)) continue;
    const uid = t.completedBy || t.assignedTo; // historical fallback
    if (uid) counts[uid] = (counts[uid] || 0) + 1;
  }
  res.json(Object.entries(people.val() || {}).map(([uid, u]) => ({ ...u, uid,
    completedTickets: counts[uid] || 0 })));
}));
app.post('/api/users', requireIT, requireManager, asyncRoute(async (req, res) => {
  const email = normalizeText(req.body?.email, 254).toLowerCase();
  const password = req.body?.password;
  const name = normalizeText(req.body?.name, 100);
  const role = req.body?.role ?? 'agent';
  if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8 || password.length > 128 || !name || !isITRole(role)) {
    fail(400, 'Tên, email, vai trò và mật khẩu ít nhất 8 ký tự là bắt buộc.');
  }
  let created;
  try { created = await adminAuth.createUser({ email, password, displayName: name }); }
  catch (err) { if (err.code === 'auth/email-already-exists') fail(409, 'Email đã được sử dụng.'); throw err; }
  const now = Date.now();
  const person = { name, email, role, active: true,
    activeTickets: 0, totalAssigned: 0, createdAt: now,
    passwordManagedIn: 'firebase-auth', passwordChangedAt: now };
  try { await db.ref(`users/${created.uid}`).set(person); }
  catch (err) { await adminAuth.deleteUser(created.uid).catch(console.error); throw err; }
  await writeAdminAudit(req.it.uid, 'create_it_account', created.uid, { role, email });
  res.status(201).json({ uid: created.uid, name, email, role });
}));

// Every active manager has the same API permissions. Promotion/demotion is
// protected against accidentally removing the final active administrator.
app.patch('/api/users/:uid', requireIT, requireManager, asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  itemPath('users', uid);
  const result = await serializeAccountMutation(async () => {
    await assertActorStillManager(req.it.uid);
    const old = (await db.ref(`users/${uid}`).get()).val();
    if (!old || !isITRole(old.role)) fail(404, 'Không tìm thấy tài khoản IT.');
    const name = req.body?.name === undefined ? old.name : normalizeText(req.body.name, 100);
    const email = req.body?.email === undefined ? old.email : normalizeText(req.body.email, 254).toLowerCase();
    const active = req.body?.active === undefined ? old.active : req.body.active;
    const role = req.body?.role === undefined ? old.role : req.body.role;
    if (!name || !isValidEmail(email) || typeof active !== 'boolean' || !isITRole(role)) {
      fail(400, 'Họ tên, email, vai trò hoặc trạng thái không hợp lệ.');
    }
    if (uid === req.it.uid && (!active || role !== 'manager')) {
      fail(403, 'Không thể tự khóa hoặc hạ quyền Admin của chính mình. Hãy dùng Admin khác.');
    }
    await assertManagerSafety(uid, old, role, active);
    const ticketSnap = await db.ref('tickets').orderByChild('assignedTo').equalTo(uid).get();
    const assignedTickets = entriesToArray(ticketSnap.val());
    try {
      await adminAuth.updateUser(uid, { displayName: name, email, disabled: !active });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') fail(409, 'Email đã được sử dụng.');
      throw err;
    }
    const now = Date.now();
    const updates = {
      [`users/${uid}/name`]: name, [`users/${uid}/email`]: email,
      [`users/${uid}/role`]: role, [`users/${uid}/active`]: active,
      [`users/${uid}/updatedAt`]: now
    };
    if (name !== old.name) for (const t of assignedTickets) {
      if (ACTIVE_STATUS.has(t.status)) updates[`tickets/${t.id}/assignedToName`] = name;
    }
    await db.ref().update(updates);
    if (!active || email !== old.email || role !== old.role) {
      await adminAuth.revokeRefreshTokens(uid);
    }
    return { uid, name, email, role, active, ok: true, previousRole: old.role };
  });
  await writeAdminAudit(req.it.uid, 'update_it_account', uid,
    { email: result.email, role: result.role, active: result.active });
  const { previousRole, ...safeResult } = result;
  res.json(safeResult);
}));

app.delete('/api/users/:uid', requireIT, requireManager, asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  itemPath('users', uid);
  await serializeAccountMutation(async () => {
    await assertActorStillManager(req.it.uid);
    const old = (await db.ref(`users/${uid}`).get()).val();
    if (!old || !isITRole(old.role)) fail(404, 'Không tìm thấy tài khoản IT.');
    if (uid === req.it.uid) fail(403, 'Không thể tự xóa tài khoản đang đăng nhập.');
    await assertManagerSafety(uid, old, null, false);
    await db.ref(`users/${uid}/active`).set(false);
    try { await adminAuth.deleteUser(uid); }
    catch (err) { if (err.code !== 'auth/user-not-found') throw err; }
    // Preserve tickets, completedBy, rating and activity records for reports.
    await db.ref().update({ [`users/${uid}`]: null, [`notifications/${uid}`]: null });
  });
  await writeAdminAudit(req.it.uid, 'delete_it_account', uid);
  res.json({ ok: true });
}));

app.patch('/api/users/:uid/password', requireIT, requireManager, asyncRoute(async (req, res) => {
  await assertActorStillManager(req.it.uid);
  const uid = req.params.uid;
  itemPath('users', uid);
  if (uid === req.it.uid) {
    fail(400, 'Để đổi mật khẩu của chính mình, hãy dùng chức năng Đổi mật khẩu và nhập mật khẩu hiện tại.');
  }
  const old = (await db.ref(`users/${uid}`).get()).val();
  if (!old || !isITRole(old.role)) fail(404, 'Không tìm thấy tài khoản IT.');
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    fail(400, 'Mật khẩu phải dài từ 8 đến 128 ký tự.');
  }
  await adminAuth.updateUser(uid, { password });
  await adminAuth.revokeRefreshTokens(uid);
  // Record only safe metadata. Password never appears in RTDB, logs or response.
  await db.ref(`users/${uid}`).update({ passwordManagedIn: 'firebase-auth',
    passwordChangedAt: Date.now(), passwordChangedBy: req.it.uid });
  await writeAdminAudit(req.it.uid, 'reset_it_password', uid);
  res.json({ ok: true, message: 'Đã đặt lại mật khẩu. Tài khoản cần đăng nhập lại.' });
}));

// Completion reports use backend Admin access so agents need no broad RTDB read rights.
app.get('/api/reports/completions', requireIT, asyncRoute(async (req, res) => {
  const localNow = yearMonth(Date.now());
  const year = req.query.year === undefined ? localNow.year : Number(req.query.year);
  const month = req.query.month === undefined ? localNow.month : Number(req.query.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    fail(400, 'Năm hoặc tháng không hợp lệ.');
  }
  const [ticketSnap, userSnap] = await Promise.all([db.ref('tickets').get(), db.ref('users').get()]);
  const users = Object.entries(userSnap.val() || {}).map(([uid, details]) => ({ uid, ...details }));
  const onlyUid = req.it.role === 'manager' ? null : req.it.uid;
  res.json(createReport(entriesToArray(ticketSnap.val()), users, year, month, onlyUid));
}));

app.get('/api/notifications', requireIT, asyncRoute(async (req, res) => {
  const snap = await db.ref(`notifications/${req.it.uid}`).orderByChild('createdAt').limitToLast(50).get();
  res.json(entriesToArray(snap.val()).sort(newestFirst));
}));
app.patch('/api/notifications/:id/read', requireIT, asyncRoute(async (req, res) => {
  const path = itemPath(`notifications/${req.it.uid}`, req.params.id);
  const ref = db.ref(path);
  const snapshot = await ref.get();
  if (!snapshot.exists()) fail(404, 'Thông báo không tồn tại.');
  await ref.child('read').set(true);
  res.json({ ok: true });
}));

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ error: 'JSON không hợp lệ.' });
  const status = err.status && Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ error: status >= 500 ? 'Lỗi hệ thống. Vui lòng thử lại.' : err.message });
});
export default app;
