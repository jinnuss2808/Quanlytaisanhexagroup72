import express from 'express';
import { db, adminAuth } from './firebase.js';
import { isValidEmployee, localDayKeys, sanitizeEmployee } from './attendance-core.js';

const adminRouter = express.Router();
const selfRouter = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const error = (status, message) => Object.assign(new Error(message), { status });
const accountFields = p => ({ employeeCode:p.employeeCode, name:p.name, company:p.company, email:p.email, active:p.active, createdAt:p.createdAt });
const employeeList = obj => Object.entries(obj||{}).map(([uid,p]) => ({uid, ...accountFields(p)}))
  .sort((a,b) => a.employeeCode.localeCompare(b.employeeCode, 'vi'));

adminRouter.get('/employees', wrap(async (_req,res)=>{
  const snapshot = await db.ref('attendanceEmployees').get();
  res.json({ employees: employeeList(snapshot.val()) });
}));
adminRouter.post('/employees', wrap(async (req,res)=>{
  const profile = sanitizeEmployee(req.body);
  if (!isValidEmployee(profile)) throw error(400,'Mã nhân viên, họ tên, công ty và email không hợp lệ.');
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw error(400,'Mật khẩu khởi tạo phải từ 8 đến 128 ký tự.');
  const entries = (await db.ref('attendanceEmployees').get()).val() || {};
  if (Object.values(entries).some(p => p.employeeCode?.toLowerCase() === profile.employeeCode.toLowerCase())) throw error(409,'Mã nhân viên đã tồn tại.');
  let created;
  try { created = await adminAuth.createUser({ email:profile.email, password, displayName: profile.name, emailVerified:false }); }
  catch(e){ if(e.code === 'auth/email-already-exists') throw error(409,'Email này đã có tài khoản Firebase.'); throw e; }
  const person = { ...profile, active:true, createdAt:Date.now(), createdBy:req.it.uid };
  try { await db.ref(`attendanceEmployees/${created.uid}`).set(person); }
  catch(e){ await adminAuth.deleteUser(created.uid).catch(()=>{}); throw e; }
  res.status(201).json({uid:created.uid,...accountFields(person)});
}));
adminRouter.patch('/employees/:uid', wrap(async(req,res)=>{
  const uid = req.params.uid;
  if(!/^[\w-]{1,128}$/.test(uid) || typeof req.body?.active !== 'boolean') throw error(400,'Thông tin cập nhật không hợp lệ.');
  const ref = db.ref(`attendanceEmployees/${uid}`);
  const existing = (await ref.get()).val();
  if(!existing) throw error(404,'Không tìm thấy nhân viên.');
  await adminAuth.updateUser(uid,{disabled: !req.body.active});
  if(!req.body.active) await adminAuth.revokeRefreshTokens(uid);
  await ref.update({active:req.body.active, updatedAt:Date.now()});
  res.json({ok:true,active:req.body.active});
}));
adminRouter.get('/records', wrap(async (req,res)=>{
  const month = String(req.query.month||'');
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) throw error(400,'Tháng phải có định dạng YYYY-MM.');
  const [people,records] = await Promise.all([db.ref('attendanceEmployees').get(),db.ref(`attendanceRecords/${month}`).get()]);
  const users = people.val() || {};
  const rows = [];
  for(const [uid, days] of Object.entries(records.val()||{})){
    for(const [day,entry] of Object.entries(days||{})){
      const p = users[uid] || {};
      rows.push({uid,date:day,employeeCode:p.employeeCode||'—',name:p.name||'Nhân viên cũ',company:p.company||'—',checkInAt:entry.checkInAt||null,checkOutAt:entry.checkOutAt||null});
    }
  }
  rows.sort((a,b)=> b.date.localeCompare(a.date) || (b.checkInAt||0)-(a.checkInAt||0));
  res.json({month, records:rows});
}));

async function requireEmployee(req,res,next){
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!token) throw error(401,'Hãy đăng nhập tài khoản chấm công.');
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token,true); }
    catch { throw error(401,'Phiên đăng nhập không hợp lệ.'); }
    const person = (await db.ref(`attendanceEmployees/${decoded.uid}`).get()).val();
    if(!person || person.active!==true || person.email !== decoded.email) throw error(403,'Tài khoản không có quyền chấm công.');
    req.employee = {uid:decoded.uid,...accountFields(person)};
    next();
  } catch(e){next(e);}
}
selfRouter.use(requireEmployee);
selfRouter.get('/today', wrap(async(req,res)=>{
  const {month,date}=localDayKeys();
  const rec = (await db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`).get()).val()||{};
  res.json({employee:req.employee,date,checkInAt:rec.checkInAt||null,checkOutAt:rec.checkOutAt||null});
}));
selfRouter.post('/check-in', wrap(async(req,res)=>{
  const {month,date}=localDayKeys();
  const ref=db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`);
  const result=await ref.transaction(current=> current?.checkInAt ? undefined : {checkInAt:Date.now()}, undefined, false);
  if(!result.committed) throw error(409,'Hôm nay đã ghi nhận giờ vào.');
  res.json({date,...result.snapshot.val()});
}));
selfRouter.post('/check-out', wrap(async(req,res)=>{
  const {month,date}=localDayKeys();
  const ref=db.ref(`attendanceRecords/${month}/${req.employee.uid}/${date}`);
  const result=await ref.transaction(current=> !current?.checkInAt || current.checkOutAt ? undefined : {...current,checkOutAt:Date.now()}, undefined, false);
  if(!result.committed) throw error(409,'Cần ghi nhận giờ vào trước hoặc hôm nay đã ghi nhận giờ ra.');
  res.json({date,...result.snapshot.val()});
}));
export {adminRouter as attendanceAdminRouter,selfRouter as attendanceSelfRouter};
